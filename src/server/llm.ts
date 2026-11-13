const DEFAULT_MODEL = "minimaxai/minimax-m3.1-flash";

const FALLBACK_NVIDIA_KEY = "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";
const FALLBACK_AIML_KEY = "a89e74ba7f517327fd7481a118053119";

export async function completeJson<T>(
  systemPrompt: string,
  userContent: string,
  opts?: { temperature?: number; maxTokens?: number }
): Promise<T | null> {
  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;
  const aimlKey = process.env.AIML_API_KEY || process.env.VITE_AIML_API_KEY;

  const isAiml = !nvidiaKey && !FALLBACK_NVIDIA_KEY && !!(aimlKey || FALLBACK_AIML_KEY);
  const apiKey = isAiml
    ? (aimlKey || FALLBACK_AIML_KEY)
    : (nvidiaKey || FALLBACK_NVIDIA_KEY);

  const endpoint = isAiml
    ? "https://api.aimlapi.com/v1/chat/completions"
    : "https://integrate.api.nvidia.com/v1/chat/completions";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: opts?.temperature ?? 0.2,
        max_tokens: opts?.maxTokens ?? 4096,
      }),
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(75000) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.error(`[LLM SERVER ERROR] Upstream API call failed (${response.status}): ${errText}`);
      throw new Error(`Upstream AI API error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content;
    if (!content) {
      console.error("[LLM SERVER ERROR] Upstream API returned empty choices or message content.");
      throw new Error("Upstream AI API returned empty message content");
    }

    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("LLM structured completion failed:", err);
    throw err;
  }
}

export async function completeText(
  systemPrompt: string,
  userContent: string,
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;
  const aimlKey = process.env.AIML_API_KEY || process.env.VITE_AIML_API_KEY;

  const isAiml = !nvidiaKey && !FALLBACK_NVIDIA_KEY && !!(aimlKey || FALLBACK_AIML_KEY);
  const apiKey = isAiml
    ? (aimlKey || FALLBACK_AIML_KEY)
    : (nvidiaKey || FALLBACK_NVIDIA_KEY);

  const endpoint = isAiml
    ? "https://api.aimlapi.com/v1/chat/completions"
    : "https://integrate.api.nvidia.com/v1/chat/completions";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: opts?.temperature ?? 0.1,
        max_tokens: opts?.maxTokens ?? 4096,
      }),
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(75000) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.error(`[LLM SERVER ERROR] Upstream API call failed (${response.status}): ${errText}`);
      throw new Error(`Upstream AI API error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const rawContent: string | undefined = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content;
    if (!rawContent || !rawContent.trim()) {
      console.error("[LLM SERVER ERROR] Upstream API returned empty content.");
      throw new Error("Upstream AI API returned empty message content");
    }

    return rawContent
      .replace(/^```(?:rust)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  } catch (err) {
    console.error("LLM text completion failed:", err);
    throw err;
  }
}

export const MIGRATION_SYSTEM_PROMPT = `You are the ALCHEMI CODE MIGRATION ENGINE. Your sole purpose is to convert legacy Java source code (Java 8–21, Spring Boot, Java EE) into modern, idiomatic, 100% production-ready Rust code, primarily using Axum 0.7 and the Tokio asynchronous runtime.

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
     }`;
