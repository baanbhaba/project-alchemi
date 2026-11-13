import { fetchApi } from "./client";
import { getProjectSourceCode } from "./project";
import { updateBlueprintStep } from "./review";
import { sanitizeRustCode } from "../utils/exportRustCode";

export interface TransformationResponse {
  step_id: string;
  transformed_code: string;
  status: "completed" | "failed" | "in_progress";
}

let liveTransformations: Record<string, Record<string, string>> = {};

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined") {
        return window.localStorage?.getItem(key) || window.sessionStorage?.getItem(key) || null;
      }
    } catch {}
    return null;
  },
  setItem: (key: string, val: string): void => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage?.setItem(key, val);
        window.sessionStorage?.setItem(key, val);
      }
    } catch {}
  },
};

export const getTransformedCode = (projectId: string, stepId?: string): string => {
  try {
    const key = `ema_transformed_${projectId}`;
    const raw = safeStorage.getItem(key) || "{}";
    const existing = JSON.parse(raw);
    if (stepId) return existing[stepId] || liveTransformations[projectId]?.[stepId] || "";
    return Object.values(existing).join("\n\n") || Object.values(liveTransformations[projectId] || {}).join("\n\n");
  } catch {
    return Object.values(liveTransformations[projectId] || {}).join("\n\n");
  }
};

export const saveTransformedCode = (projectId: string, stepId: string, code: string) => {
  if (!liveTransformations[projectId]) liveTransformations[projectId] = {};
  liveTransformations[projectId][stepId] = code;
  try {
    const key = `ema_transformed_${projectId}`;
    const raw = safeStorage.getItem(key) || "{}";
    const existing = JSON.parse(raw);
    existing[stepId] = code;
    safeStorage.setItem(key, JSON.stringify(existing));
  } catch {}
};

import { isJavaSourceCode, generateRustCodeFromJava } from "../server/rustGenerator";
export { isJavaSourceCode, generateRustCodeFromJava };

export const triggerTransformation = async (
  projectId: string,
  stepId: string,
  fileOrCode?: string
): Promise<TransformationResponse> => {
  const sourceCodeMap = getProjectSourceCode(projectId);
  let javaCode = "";
  if (fileOrCode && sourceCodeMap[fileOrCode]) {
    javaCode = sourceCodeMap[fileOrCode];
  } else if (fileOrCode && fileOrCode.includes("class ")) {
    javaCode = fileOrCode;
  } else {
    // Find file matching stepId or step index
    const keys = Object.keys(sourceCodeMap);
    const stepIdx = parseInt(stepId.replace(/[^0-9]/g, ""), 10) - 1;
    if (!isNaN(stepIdx) && stepIdx >= 0 && keys[stepIdx]) {
      javaCode = sourceCodeMap[keys[stepIdx]];
    } else {
      javaCode = Object.values(sourceCodeMap)[0] || "";
    }
  }

  if (!isJavaSourceCode(javaCode)) {
    javaCode = Object.values(sourceCodeMap).join("\n") || "";
  }

  if (!isJavaSourceCode(javaCode)) {
    return {
      step_id: stepId,
      transformed_code: "// ERROR: Invalid input. Please provide valid Java source code for legacy migration.",
      status: "failed",
    };
  }

  const FALLBACK_NVIDIA_KEY = "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";
  const migrationPayload = {
    model: "minimaxai/minimax-m3.1-flash",
    messages: [
      {
        role: "system",
        content: `You are the ALCHEMI CODE MIGRATION ENGINE. Your sole purpose is to convert legacy Java source code (Java 8–21, Spring Boot, Java EE) into modern, idiomatic, 100% production-ready Rust code, primarily using Axum 0.7 and the Tokio asynchronous runtime.

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. OUTPUT ONLY PURE, VALID, COMPILABLE RUST SOURCE CODE.
2. ABSOLUTELY ZERO COMMENTS (no //, no /* */, no doc comments, no "// Note:", no disclaimer comments).
3. NO MARKDOWN FENCES (no \`\`\`rust or \`\`\`). Output pure Rust code only. No introductory, explanatory, or conversational text.
4. PRESERVE FULL BUSINESS LOGIC AND METHOD BEHAVIOR:
   - Translate all classes, records, interfaces, fields, methods, algorithms, calculations, conditional statements, and loops.
   - NEVER replace method bodies with placeholder "println!" statements or dummy "todo!()". Implement the actual logic.
   - NEVER generate interactive console stdin prompts (NO "print!(\\"Enter...\\")", NO "io::stdin().read_line()", NO terminal input prompts).
5. SPRING BOOT & REST SERVICE MIGRATION (AXUM 0.7):
   - Translate Spring @RestController, @RequestMapping, @GetMapping, @PostMapping, @PutMapping, @DeleteMapping into Axum 0.7 routers (Router::new().route(...)), handler functions (axum::extract::Json, axum::extract::State), and axum::response::IntoResponse.
   - Translate dependency injection (@Autowired, service fields) into Axum application state: Arc<AppState> using axum::extract::State.
   - Preserve all JSON request/response contracts and data structures with serde::Serialize and serde::Deserialize.
6. DOMAIN SERVICES, ENTITIES & COLLECTIONS:
   - Translate classes to idiomatic Rust structs with #[derive(Debug, Clone, Serialize, Deserialize)].
   - Implement methods on impl blocks with appropriate ownership (&self, &mut self, Self).
   - Convert legacy collections and APIs:
     * Vector<T> -> Vec<T>
     * Hashtable<K, V> -> std::collections::HashMap<K, V>
     * ArrayList<T> -> Vec<T>
     * Date / Calendar -> chrono::DateTime<chrono::Utc> or chrono::NaiveDateTime
     * StringBuffer / StringBuilder -> String
     * Thread.sleep() -> tokio::time::sleep()
   - Translate exceptions and error handling into Rust Result<T, E> using the ? operator.
7. SERVICE ENTRYPOINT:
   - When generating an executable microservice, provide an asynchronous Axum/Tokio main function:
     #[tokio::main]
     async fn main() -> Result<(), Box<dyn std::error::Error>> {
         let state = std::sync::Arc::new(AppState::new());
         let app = create_router(state);
         let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
         axum::serve(listener, app).await?;
         Ok(())
     }`,
      },
      {
        role: "user",
        content: `Directly convert the following Java code into pure, idiomatic Rust code with zero comments, zero markdown fences, and zero explanatory notes. Output pure Rust code only:\n\n${javaCode}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  // Strategy 1: Edge rewrite in browser (no 60s lambda execution limits)
  if (typeof window !== "undefined") {
    try {
      const edgeRes = await fetch("/nvidia-api/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FALLBACK_NVIDIA_KEY}`,
        },
        body: JSON.stringify(migrationPayload),
      });

      if (edgeRes.ok) {
        const edgeData = await edgeRes.json();
        const rawCode = edgeData.choices?.[0]?.message?.content || "";
        if (rawCode && rawCode.trim().length > 0) {
          const cleanCode = sanitizeRustCode(rawCode);
          saveTransformedCode(projectId, stepId, cleanCode);
          updateBlueprintStep(projectId, stepId, { target_pattern: cleanCode }).catch(() => {});
          return { step_id: stepId, transformed_code: cleanCode, status: "completed" };
        }
      }
    } catch (edgeErr) {
      console.warn("[TRANSFORM] Edge proxy attempt failed, falling back to server-side AI proxy:", edgeErr);
    }
  }

  // Strategy 2: Server-side AI proxy (/api/v1/ai/chat)
  try {
    const origin = typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
      ? window.location.origin
      : "http://localhost:5173";
    const chatUrl = typeof window !== "undefined" ? "/api/v1/ai/chat" : `${origin}/api/v1/ai/chat`;

    const res = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(migrationPayload),
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(75000) : undefined,
    });

    if (res.ok) {
      const data = await res.json();
      const rawCode = data.choices?.[0]?.message?.content || "";
      if (!rawCode || rawCode.trim().length === 0) {
        throw new Error("AI Migration Engine returned empty code response. No output received from model.");
      }
      const cleanCode = sanitizeRustCode(rawCode);
      saveTransformedCode(projectId, stepId, cleanCode);
      updateBlueprintStep(projectId, stepId, { target_pattern: cleanCode }).catch(() => {});
      return { step_id: stepId, transformed_code: cleanCode, status: "completed" };
    } else {
      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error || `AI proxy error (${res.status})`;
      throw new Error(`AI Code Migration failed: ${errMsg}`);
    }
  } catch (err: any) {
    console.error("[TRANSFORM] AI migration failed:", err?.message || err);
    throw err;
  }
};

export const getTransformationStatus = async (
  projectId: string
): Promise<{ stage: string; progress: number }> => {
  try {
    return await fetchApi<{ stage: string; progress: number }>(
      `/projects/${projectId}/transform/status`
    );
  } catch {
    return {
      stage: "transforming",
      progress: 100,
    };
  }
};
