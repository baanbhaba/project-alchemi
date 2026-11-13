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
        max_tokens: opts?.maxTokens ?? 1600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.error(`[LLM SERVER ERROR] Upstream API call failed (${response.status}): ${errText}`);
      throw new Error(`Upstream AI API error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
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
