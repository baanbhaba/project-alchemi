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

              const apiKey = process.env.NVIDIA_API_KEY || "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";
              if (apiKey) {
                try {
                  const controller = new AbortController();
                  const timer = setTimeout(() => controller.abort(), 75000);
                  const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                      Accept: "application/json",
                    },
                    body: JSON.stringify({
                      model,
                      messages,
                      temperature: 0.1,
                      max_tokens: 4096,
                      stream: false,
                    }),
                    signal: controller.signal,
                  });
                  clearTimeout(timer);
                  if (upstream.ok) {
                    const json: any = await upstream.json().catch(() => null);
                    if (json && json.choices?.[0]?.message) {
                      const choice = json.choices[0];
                      let rawContent = choice.message.content || choice.message.reasoning_content || "";
                      let cleanContent = rawContent
                        .replace(/^```(?:rust|json)?\s*/i, "")
                        .replace(/\s*```$/, "")
                        .trim();

                      res.setHeader("Content-Type", "application/json");
                      res.statusCode = 200;
                      res.end(
                        JSON.stringify({
                          id: json.id || `chatcmpl-${Date.now()}`,
                          object: "chat.completion",
                          created: json.created || Math.floor(Date.now() / 1000),
                          model: json.model || model,
                          choices: [
                            {
                              index: 0,
                              message: { role: "assistant", content: cleanContent },
                              finish_reason: choice.finish_reason || "stop",
                            },
                          ],
                          usage: json.usage,
                        })
                      );
                      return;
                    }
                  } else {
                    const errText = await upstream.text().catch(() => upstream.statusText);
                    res.setHeader("Content-Type", "application/json");
                    res.statusCode = upstream.status || 502;
                    res.end(JSON.stringify({ error: `Upstream AI error (${upstream.status}): ${errText}` }));
                    return;
                  }
                } catch (err: any) {
                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = 504;
                  res.end(JSON.stringify({ error: `AI request failed: ${err?.message || "Timeout"}` }));
                  return;
                }
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "NVIDIA_API_KEY is not configured. Live AI output required." }));
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
