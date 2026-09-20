import type { CoreAudit, ImpactAudit, Blueprint } from "../types/contracts";

// All AI calls go through /api/v1/ai/chat — a server-side proxy that holds
// the actual API key. No key is ever exposed to the browser.
const AI_PROXY = "/api/v1/ai/chat";

const extractJsonBlock = (rawText: string): string => {
  const text = rawText.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
};

async function callAiProxy(messages: { role: string; content: string }[], max_tokens = 900): Promise<string> {
  const res = await fetch(AI_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "meta/llama-3.2-11b-vision-instruct",
      messages,
      temperature: 0.1,
      max_tokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`AI proxy error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export const analyzeCoreWithNvidia = async (
  projectName: string,
  javaCode: string
): Promise<CoreAudit> => {
  const rawContent = await callAiProxy([
    {
      role: "system",
      content: `You are the EMA Core Analysis Agent. Your sole task is to analyze Java source code.
STRICT INPUT GUARDRAIL: Inspect the source code. If the input is NOT valid Java source code (e.g., conversational text, general questions, or non-Java code), return JSON with "architecture_summary": "ERROR: Invalid input. Only valid Java source code can be analyzed.", confidence: 0.0, detected_stack: [], deprecated_usages: [], dependency_graph: {"nodes": [], "edges": []}, diagrams: [].

If it IS valid Java source code, analyze it and return ONLY valid JSON matching this schema:
{
  "architecture_summary": "string",
  "detected_stack": [{"technology": "string", "version": "string", "status": "eol|deprecated|current"}],
  "deprecated_usages": [{"file": "string", "line": 1, "pattern": "string", "recommended_replacement": "string"}],
  "dependency_graph": {"nodes": ["string"], "edges": [{"from": "string", "to": "string"}]},
  "diagrams": [{"type": "string", "format": "mermaid", "content": "string"}],
  "confidence": 0.92
}`,
    },
    {
      role: "user",
      content: `Project Name: ${projectName}\nSource Code:\n${javaCode || "public class App { public static void main(String[] args) {} }"}`,
    },
  ]);

  return JSON.parse(extractJsonBlock(rawContent)) as CoreAudit;
};

export const analyzeImpactWithNvidia = async (
  projectName: string,
  javaCode: string
): Promise<ImpactAudit> => {
  const rawContent = await callAiProxy([
    {
      role: "system",
      content: `You are the EMA Impact Analysis Agent. Your sole task is to analyze breaking changes for Java source code migration.
STRICT INPUT GUARDRAIL: Inspect the source code. If the input is NOT valid Java source code (e.g., conversational text, general questions, or non-Java code), return JSON with "confidence": 0.0, api_surface: [], database_impacts: [], config_impacts: [], dependency_risks: [], blast_radius: [].

If it IS valid Java source code, analyze it and return ONLY valid JSON matching this schema:
{
  "api_surface": [{"endpoint_or_interface": "string", "consumers": ["string"], "breaking_change_risk": "low|medium|high"}],
  "database_impacts": [{"component": "string", "risk": "low|medium|high", "notes": "string"}],
  "config_impacts": [{"file": "string", "risk": "low|medium|high", "notes": "string"}],
  "dependency_risks": [{"library": "string", "current_version": "string", "target_version": "string", "known_breaking_changes": ["string"]}],
  "blast_radius": [{"change": "string", "affected_files": ["string"], "severity": "low|medium|high"}],
  "confidence": 0.89
}`,
    },
    {
      role: "user",
      content: `Project Name: ${projectName}\nSource Code:\n${javaCode || "public class App {}"}`,
    },
  ]);

  return JSON.parse(extractJsonBlock(rawContent)) as ImpactAudit;
};

export const generateBlueprintWithNvidia = async (
  projectId: string,
  projectName: string,
  javaCode: string
): Promise<Blueprint> => {
  const rawContent = await callAiProxy(
    [
      {
        role: "system",
        content: `You are the EMA Blueprint Agent. Your sole task is to generate migration blueprint steps for Java source code.
STRICT INPUT GUARDRAIL: Inspect the source code. If the input is NOT valid Java source code, return JSON with "project_id": "${projectId}" and "steps": [{"id": "step-1", "file_or_module": "InvalidInput", "what_changes": "Rejected", "why": "ERROR: Input is not valid Java source code", "target_pattern": "// ERROR: Please provide valid Java source code.", "risk_level": "high", "depends_on": [], "status": "rejected"}].

If it IS valid Java source code, generate a 3-step migration blueprint matching this schema:
{
  "project_id": "${projectId}",
  "steps": [
    {
      "id": "step-1",
      "file_or_module": "string (exact Java class name from code)",
      "what_changes": "string (specific code changes)",
      "why": "string (migration rationale)",
      "target_pattern": "string (actual rewritten Rust/Java 21 snippet for this class)",
      "risk_level": "medium",
      "depends_on": [],
      "status": "pending"
    }
  ]
}`,
      },
      {
        role: "user",
        content: `Project ID: ${projectId}\nProject Name: ${projectName}\nSource Code:\n${javaCode || "public class Main { public static void main(String[] args){} }"}`,
      },
    ],
    1000
  );

  const parsed = JSON.parse(extractJsonBlock(rawContent)) as Blueprint;
  parsed.project_id = projectId;

  if (parsed.steps) {
    parsed.steps = parsed.steps.map((s, idx) => ({
      id: s.id || `step-${idx + 1}`,
      file_or_module: s.file_or_module || "src/Main.java",
      what_changes: s.what_changes || "Migrate Java code",
      why: s.why || "Modernization",
      target_pattern: s.target_pattern || "// Transformed target code",
      risk_level: (["low", "medium", "high"] as const).includes(s.risk_level as any)
        ? (s.risk_level as "low" | "medium" | "high")
        : "medium",
      depends_on: Array.isArray(s.depends_on) ? s.depends_on : [],
      status: "pending" as const,
    }));
  }

  return parsed;
};
