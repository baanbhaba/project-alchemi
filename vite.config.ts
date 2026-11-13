import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function aiDevMiddleware() {
  return {
    name: "ai-dev-middleware",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || "";
        if ((url === "/api/v1/ai/chat" || url === "/api/ai/chat" || url.startsWith("/api/v1/ai/chat?") || url.startsWith("/api/ai/chat?")) && req.method === "POST") {
          let bodyStr = "";
          req.on("data", (chunk: any) => {
            bodyStr += chunk;
          });
          req.on("end", async () => {
            try {
              let parsedBody: any = {};
              try {
                parsedBody = JSON.parse(bodyStr);
              } catch {}
              const messages = parsedBody.messages || [];
              const model = parsedBody.model || "minimaxai/minimax-m3.1-flash";
              const sysMsg = messages.find((m: any) => m.role === "system")?.content || "";
              const userMsg = messages.filter((m: any) => m.role === "user").map((m: any) => m.content).join("\n\n");

              let content = "";
              if (sysMsg.includes("Core Analysis Agent") || sysMsg.includes("CoreAudit")) {
                const classNames = [...userMsg.matchAll(/(?:public\s+)?(?:class|interface|enum)\s+(\w+)/g)].map((m) => m[1]);
                const primaryClass = classNames[0] || "PaymentGateway";
                content = JSON.stringify({
                  architecture_summary: `Architectural analysis of Java source '${primaryClass}'. Detected ${classNames.length || 1} class unit(s). Modernization path target: Rust Axum with memory safety.`,
                  detected_stack: [
                    { technology: "Java", version: "1.8.0", status: "eol" },
                    { technology: "Spring Boot", version: "2.7.0", status: "eol" },
                  ],
                  deprecated_usages: [
                    {
                      file: `${primaryClass}.java`,
                      line: 12,
                      pattern: "Deprecated API pattern",
                      recommended_replacement: "Rust memory-safe equivalent",
                    },
                  ],
                  dependency_graph: { nodes: classNames.length ? classNames : [primaryClass], edges: [] },
                  diagrams: [
                    {
                      type: "component",
                      format: "mermaid",
                      content: `graph TD\n  Client --> ${primaryClass}\n  ${primaryClass} --> RustAxum`,
                    },
                  ],
                  confidence: 0.95,
                });
              } else if (sysMsg.includes("Impact Analysis Agent") || sysMsg.includes("ImpactAudit")) {
                content = JSON.stringify({
                  api_surface: [
                    {
                      endpoint_or_interface: "/api/v1/payments",
                      consumers: ["Web Client"],
                      breaking_change_risk: "medium",
                    },
                  ],
                  database_impacts: [
                    { component: "JPA Entities", risk: "medium", notes: "Convert to SQLx structs" },
                  ],
                  config_impacts: [
                    { file: "application.properties", risk: "low", notes: "Port to config.rs" },
                  ],
                  dependency_risks: [],
                  blast_radius: [
                    { change: "Migrate endpoints", affected_files: ["Main.java"], severity: "medium" },
                  ],
                  confidence: 0.92,
                });
              } else if (sysMsg.includes("Blueprint Agent") || sysMsg.includes("Blueprint")) {
                content = JSON.stringify({
                  project_id: "blueprint-active",
                  steps: [
                    {
                      id: "step-1",
                      file_or_module: "Models.java",
                      what_changes: "Data structures to Rust Serde",
                      why: "Memory safety",
                      target_pattern: "#[derive(Serialize, Deserialize)]",
                      risk_level: "low",
                      depends_on: [],
                      status: "pending",
                    },
                    {
                      id: "step-2",
                      file_or_module: "Service.java",
                      what_changes: "Business logic to async Rust",
                      why: "High concurrency",
                      target_pattern: "pub async fn execute()",
                      risk_level: "medium",
                      depends_on: ["step-1"],
                      status: "pending",
                    },
                    {
                      id: "step-3",
                      file_or_module: "Controller.java",
                      what_changes: "REST endpoints to Axum router",
                      why: "High throughput",
                      target_pattern: "Router::new()",
                      risk_level: "medium",
                      depends_on: ["step-2"],
                      status: "pending",
                    },
                  ],
                });
              } else if (
                sysMsg.includes("Code Migration Engine") ||
                sysMsg.includes("Rust Axum") ||
                userMsg.includes("Migrate to Rust")
              ) {
                content =
                  "// Migrated to Rust Axum\nuse axum::{routing::post, Router};\n\npub fn app() -> Router {\n    Router::new()\n}";
              } else {
                content =
                  "ALCHEMI Migration AI Engine: Inspection of input Java source completed successfully.";
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  id: `chatcmpl-${Date.now()}`,
                  object: "chat.completion",
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [
                    {
                      index: 0,
                      message: { role: "assistant", content },
                      finish_reason: "stop",
                    },
                  ],
                  usage: { prompt_tokens: 100, completion_tokens: 300, total_tokens: 400 },
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), aiDevMiddleware()],
  define: {
    "process.env": {},
  },
  base: "./", // Use relative base path for desktop file:// protocol loading in Electron
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/nvidia-api": {
        target: "https://integrate.api.nvidia.com/v1",
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/nvidia-api/, ""),
      },
      "/aiml-api": {
        target: "https://api.aimlapi.com/v1",
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => path.replace(/^\/aiml-api/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
  },
} as any);
