import type { VercelRequest, VercelResponse } from "@vercel/node";

const FALLBACK_NVIDIA_KEY = "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";
const FALLBACK_AIML_KEY = "a89e74ba7f517327fd7481a118053119";

/**
 * POST /api/v1/ai/chat
 * Server-side AI proxy that directly invokes NVIDIA NIM / AIML API.
 * Guarantees ZERO predefined, synthetic, or mock outputs.
 * Directly returns generated model output or reports honest upstream errors.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {}
  }
  let { model, messages, temperature, max_tokens, provider } = body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const useAiml = provider === "aiml";
  const apiKey = useAiml
    ? (process.env.AIML_API_KEY || FALLBACK_AIML_KEY)
    : (process.env.NVIDIA_API_KEY || FALLBACK_NVIDIA_KEY);

  const endpoint = useAiml
    ? "https://api.aimlapi.com/v1/chat/completions"
    : "https://integrate.api.nvidia.com/v1/chat/completions";

  if (!apiKey) {
    return res.status(500).json({
      error: "AI API key is not configured. Please configure NVIDIA_API_KEY.",
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75000);
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: model || (useAiml ? "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" : "minimaxai/minimax-m3.1-flash"),
        messages,
        temperature: temperature ?? 0.1,
        max_tokens: max_tokens ?? 4096,
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

        return res.status(200).json({
          id: json.id || `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: json.created || Math.floor(Date.now() / 1000),
          model: json.model || model || "minimaxai/minimax-m3.1-flash",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: cleanContent,
              },
              finish_reason: choice.finish_reason || "stop",
            },
          ],
          usage: json.usage,
        });
      }
      return res.status(502).json({
        error: "Upstream AI provider returned an invalid response structure. No predefined outputs allowed.",
      });
    } else {
      const upstreamErr = await upstream.text().catch(() => upstream.statusText);
      return res.status(upstream.status || 502).json({
        error: `Upstream AI provider error (${upstream.status}): ${upstreamErr}`,
      });
    }
  } catch (err: any) {
    return res.status(504).json({
      error: `AI provider request failed: ${err?.message || "Timeout"}`,
    });
  }
}
