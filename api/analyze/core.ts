import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../src/lib/prisma";
import { detectJavaStack, detectJavaDeprecatedUsages } from "../../src/lib/analysis";
import { completeJson } from "../../src/server/llm";
import { refreshProjectReadiness } from "../../src/server/auditMapping";
import { generateRustCodeFromJava } from "../../src/api/transform";

const CORE_SYSTEM_PROMPT = `You are the CORE ANALYSIS AGENT in ALCHEMI (Automated Legacy Code Transformation Engine),
a multi-agent system that migrates legacy Java codebases to idiomatic Rust.

Your SOLE responsibility is static architectural analysis. You do NOT migrate, rewrite,
or suggest Rust code in this step. You produce a structured audit that downstream agents
(Impact Analysis, Blueprint, Migration) will consume as ground truth.

=====================================================================
INPUT VALIDATION
=====================================================================
1. If the input is not valid Java source (conversational text, another language, empty,
   truncated mid-statement, or binary/garbage), respond with ONLY this JSON and nothing else:
   {"error": "INVALID_INPUT", "reason": "<one short sentence explaining what was wrong>"}
2. If the input is Java but incomplete (e.g. a fragment with unresolved braces), still
   analyze what is parseable and set "confidence" low (<0.5). Do not fabricate missing
   context — flag it in "architecture_summary" instead.
3. Never execute, simulate, or "run" the code. This is static analysis only.

=====================================================================
OUTPUT CONTRACT
=====================================================================
Return ONLY valid JSON — no markdown fences, no prose before or after, no trailing commas,
no comments inside the JSON. The response must parse with a standard JSON parser on the
first attempt. Escape all string content properly (newlines as \\n, quotes as \\").

Schema (all fields required, use empty arrays/objects rather than omitting fields):
{
  "architecture_summary": "string — 3-6 sentences describing the overall design: layering (controller/service/repo etc.), concurrency model, entry points, and notable patterns (singleton, factory, observer, DI framework in use)",
  "detected_stack": [
    {
      "technology": "string — e.g. 'Java', 'Spring Boot', 'Hibernate', 'Log4j', 'JUnit 4'",
      "version": "string — exact version if determinable from imports/build files/comments, otherwise 'unknown'",
      "status": "current | deprecated | eol",
      "evidence": "string — the specific import, annotation, or code line that led to this detection, e.g. 'import org.apache.log4j.Logger;'"
    }
  ],
  "deprecated_usages": [
    {
      "file": "string — filename as given, or 'input.java' if unnamed",
      "line": "integer — best-effort line number",
      "pattern": "string — the exact deprecated construct, e.g. 'Vector<T>', 'synchronized method', 'Date/Calendar API', 'raw type usage', 'checked exception swallowing'",
      "severity": "low | medium | high — impact on migration difficulty",
      "recommended_replacement": "string — the CONCEPTUAL Java-side modernization, not Rust code (Rust equivalents belong to the Migration Agent), e.g. 'java.time API' not 'chrono crate'"
    }
  ],
  "dependency_graph": {
    "nodes": ["string — class/interface names discovered"],
    "edges": [
      { "from": "ClassA", "to": "ClassB", "relationship": "extends | implements | composes | calls | injects" }
    ]
  },
  "concurrency_model": {
    "uses_threads": "boolean",
    "uses_executor_service": "boolean",
    "shared_mutable_state": ["string — fields/classes with unsynchronized or synchronized shared state that will need explicit ownership design in Rust"],
    "notes": "string"
  },
  "diagrams": [
    { "type": "component | sequence | class", "format": "mermaid", "content": "string — valid mermaid syntax, escaped for JSON" }
  ],
  "migration_complexity": {
    "score": "1-10 integer, 10 = hardest",
    "drivers": ["string — specific reasons, e.g. 'reflection-based DI', 'JNI calls', 'unbounded recursion without tail-call equivalent'"]
  },
  "confidence": "float 0.0-1.0 — your calibrated confidence in this analysis given input completeness"
}

=====================================================================
ANALYSIS RULES
=====================================================================
- Detect stack from imports, Maven/Gradle snippets if present, annotations (@SpringBootApplication, @Entity, @RestController, etc.), and idioms (System.out vs SLF4J, java.util.Date vs java.time).
- status="eol": Java 8 (post Jan 2030 policies vary — flag Java <11 as deprecated, Java 8 itself only eol under specific vendor timelines — when uncertain, use "deprecated" not "eol").
- Never invent a dependency that isn't evidenced in the source. If build files are absent, infer only from import statements and lower confidence and say so in architecture_summary.
- Flag reflection, unsafe casts, native/JNI calls, and finalizers explicitly — these are the highest-risk constructs for a Rust port and must appear in migration_complexity.drivers.
- Keep diagrams small and readable (≤15 nodes). If the class count exceeds that, diagram only the top-level packages/modules, not every class.
- Do not include personal opinions, recommendations for business logic changes, or anything outside architecture/stack/dependency scope — that belongs to Impact Analysis or Blueprint.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed. Use POST.` });
  }

  const { project_id, code, ingestion_manifest } = req.body || {};

  try {
    let fileName = "Main.java";
    let javaCode = typeof code === "string" ? code : "";

    // Load from DB if no code provided
    if (project_id && !javaCode) {
      try {
        const project = await prisma.project.findUnique({
          where: { id: project_id },
          include: { uploadedSources: true },
        });
        if (!project) {
          return res.status(404).json({ error: `Project '${project_id}' not found` });
        }
        fileName = project.uploadedSources[0]?.fileName || `${project.name}.java`;
        javaCode = project.uploadedSources[0]?.rawCode || "";
      } catch (dbErr) {
        console.warn("Could not query project from database:", dbErr);
      }
    }

    if (!javaCode && typeof ingestion_manifest === "string") {
      javaCode = ingestion_manifest;
    }

    if (!javaCode.trim()) {
      return res.status(400).json({
        error: "No Java source code provided. Include 'code' in the request body or upload source via project creation.",
      });
    }

    // ── Tier 1: AI analysis ────────────────────────────────────────────────
    let audit: any = null;

    try {
      audit = await completeJson(CORE_SYSTEM_PROMPT, javaCode, { maxTokens: 1800 });
      if (audit && (!audit.architecture_summary || !Array.isArray(audit.detected_stack))) {
        audit = null;
      }
    } catch (llmErr) {
      console.warn("AI analysis failed in /analyze/core, falling back to static analysis:", llmErr);
      audit = null;
    }

    // ── Tier 2: Static analysis (real analysis, not predefined data) ───────
    if (!audit) {
      const detectedStack = detectJavaStack(javaCode);
      const detectedUsages = detectJavaDeprecatedUsages(javaCode, fileName);
      const classNames = [...(javaCode.matchAll(/(?:public\s+)?class\s+(\w+)/g))].map(m => m[1]);
      const nodes = classNames.length > 0 ? classNames : [fileName.replace(/\.java$/, "")];
      const edges = nodes.length > 1
        ? nodes.slice(0, -1).map((n: string, i: number) => ({ from: n, to: nodes[i + 1] }))
        : [];

      audit = {
        architecture_summary: `Static analysis of '${fileName}'. Detected ${classNames.length} class(es), ${detectedUsages.length} deprecated pattern(s). ${!process.env.NVIDIA_API_KEY && !process.env.AIML_API_KEY ? "Note: AI analysis unavailable — configure NVIDIA_API_KEY or AIML_API_KEY for deeper insights." : "AI analysis returned no result — falling back to static scan."}`,
        detected_stack: detectedStack,
        deprecated_usages: detectedUsages,
        dependency_graph: { nodes, edges },
        diagrams: [{
          type: "component",
          format: "mermaid",
          content: classNames.length > 0
            ? `graph TD\n${classNames.map((c: string, i: number) => i === 0 ? `  ${c}["${c}"]` : `  ${classNames[i - 1]} --> ${c}["${c}"]`).join("\n")}`
            : `graph TD\n  Source["${fileName}"] --> Target["Java 21 / Rust Axum"]`,
        }],
        confidence: 0.72,
      };
    }

    // ── Persist to DB if project_id provided ──────────────────────────────
    if (project_id) {
      try {
        await prisma.coreAudit.upsert({
          where: { projectId: project_id },
          update: {
            architectureSummary: audit.architecture_summary,
            detectedStack: audit.detected_stack,
            deprecatedUsages: audit.deprecated_usages,
            dependencyGraph: audit.dependency_graph,
            diagrams: audit.diagrams,
            confidence: audit.confidence,
          },
          create: {
            projectId: project_id,
            architectureSummary: audit.architecture_summary,
            detectedStack: audit.detected_stack,
            deprecatedUsages: audit.deprecated_usages,
            dependencyGraph: audit.dependency_graph,
            diagrams: audit.diagrams,
            confidence: audit.confidence,
          },
        });
        await refreshProjectReadiness(project_id);
      } catch (dbErr) {
        console.warn("Failed to persist core audit to DB (offline/db unreachable):", dbErr);
      }
    }

    if (audit) {
      audit.java_code = javaCode;
      audit.rust_code = generateRustCodeFromJava(javaCode, "step-1");
    }

    return res.status(200).json(audit);
  } catch (error: any) {
    console.error("POST /api/analyze/core error:", error);
    return res.status(500).json({
      error: "Core analysis failed",
      detail: error?.message || "Unknown server error",
    });
  }
}
