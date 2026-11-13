import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../src/lib/prisma.js";
import { detectJavaImpactAudit } from "../../src/lib/analysis.js";
import { completeJson } from "../../src/server/llm.js";
import { refreshProjectReadiness } from "../../src/server/auditMapping.js";

const IMPACT_SYSTEM_PROMPT = `You are the IMPACT ANALYSIS AGENT in ALCHEMI (Automated Legacy Code Transformation Engine).
Your job is to assess the BLAST RADIUS of migrating the given Java source to Rust — what
breaks, what needs coordinated changes, and where the operational risk concentrates. You do
NOT write migration code and you do NOT re-describe the architecture (that's Core Analysis's
job) — you focus on downstream/operational consequences.

=====================================================================
INPUT VALIDATION
=====================================================================
Same as Core Analysis Agent: if input is not valid Java, return ONLY:
{"error": "INVALID_INPUT", "reason": "<one short sentence>"}

=====================================================================
OUTPUT CONTRACT
=====================================================================
Return ONLY valid JSON — no markdown fences, no prose, parses on first attempt.

{
  "api_surface": [
    {
      "endpoint_or_interface": "string — HTTP route, public method signature, or exposed interface",
      "consumers": ["string — inferred callers: 'Web Client', 'Internal Service X', 'Batch Job', 'Unknown/External' — mark 'Unknown/External' rather than guessing when there's no evidence"],
      "breaking_change_risk": "low | medium | high",
      "risk_reason": "string — concrete reason, e.g. 'return type changes from nullable Long to non-nullable i64, JSON shape identical' or 'exception-based error signaling replaced by Result — consumers checking for specific exception types will need a contract change'"
    }
  ],
  "database_impacts": [
    { "component": "string — table/entity name", "risk": "low | medium | high",
      "notes": "string — e.g. schema-compatible ORM swap vs. required migration script" }
  ],
  "config_impacts": [
    { "file": "string — e.g. 'application.properties', 'pom.xml'", "risk": "low | medium | high",
      "notes": "string — what specifically must change and why" }
  ],
  "dependency_risks": [
    { "dependency": "string", "risk": "low | medium | high",
      "mitigation": "string — concrete next step, framed conceptually (e.g. 'replace with a maintained logging crate'), not literal Rust code" }
  ],
  "concurrency_and_state_risks": [
    { "issue": "string — e.g. 'unsynchronized static counter accessed from multiple request threads'", "risk": "low | medium | high",
      "notes": "string — operational consequence if unaddressed" }
  ],
  "blast_radius": [
    { "change": "string — the specific migration change under consideration",
      "affected_files": ["string"],
      "affected_systems": ["string — e.g. 'downstream billing service', 'nightly batch job'"],
      "severity": "low | medium | high" }
  ],
  "rollout_recommendation": {
    "strategy": "big_bang | strangler_fig | parallel_run",
    "reasoning": "string — 1-3 sentences justifying the choice given the risks found above"
  },
  "confidence": "float 0.0-1.0"
}

=====================================================================
ANALYSIS RULES
=====================================================================
- Ground every risk rating in something observable in the source (a specific method, field, annotation, or exception type) — reference it in the "notes"/"risk_reason" field. Never assign "high" risk without a concrete reason attached.
- If no database or web framework annotations are present, return empty arrays for those sections rather than fabricating impacts — an empty array is a valid, honest answer.
- Treat any use of reflection, dynamic class loading, serialization of arbitrary objects, or JNI as automatic "high" dependency/blast-radius risk — these rarely have a clean Rust equivalent and need explicit human review.
- For rollout_recommendation: default to "strangler_fig" for anything with external API consumers or a database; use "parallel_run" when correctness parity is critical (e.g. financial calculations) and results can be diffed; reserve "big_bang" for small, low-risk, self-contained CLI utilities with no external consumers.
- Do not duplicate the dependency_graph or architecture_summary content from Core Analysis — assume the reader already has that document; only add impact-specific information here.
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

    if (project_id && !javaCode) {
      const project = await prisma.project.findUnique({
        where: { id: project_id },
        include: { uploadedSources: true },
      });
      if (!project) {
        return res.status(404).json({ error: `Project '${project_id}' not found` });
      }
      fileName = project.uploadedSources[0]?.fileName || `${project.name}.java`;
      javaCode = project.uploadedSources[0]?.rawCode || "";
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

    audit = await completeJson(IMPACT_SYSTEM_PROMPT, javaCode, { maxTokens: 1800 });
    if (audit && !Array.isArray(audit.api_surface)) {
      audit = null;
    }

    // ── Tier 2: Static impact analysis on real uploaded code ───────────────
    if (!audit) {
      audit = detectJavaImpactAudit(javaCode, fileName);
    }

    // ── Persist to DB ──────────────────────────────────────────────────────
    if (project_id) {
      await prisma.impactAudit.upsert({
        where: { projectId: project_id },
        update: {
          apiSurface: audit.api_surface,
          databaseImpacts: audit.database_impacts,
          configImpacts: audit.config_impacts,
          dependencyRisks: audit.dependency_risks,
          blastRadius: audit.blast_radius,
          confidence: audit.confidence,
        },
        create: {
          projectId: project_id,
          apiSurface: audit.api_surface,
          databaseImpacts: audit.database_impacts,
          configImpacts: audit.config_impacts,
          dependencyRisks: audit.dependency_risks,
          blastRadius: audit.blast_radius,
          confidence: audit.confidence,
        },
      });
      await refreshProjectReadiness(project_id);
    }

    return res.status(200).json(audit);
  } catch (error: any) {
    console.error("POST /api/analyze/impact error:", error);
    return res.status(500).json({
      error: "Impact analysis failed",
      detail: error?.message || "Unknown server error",
    });
  }
}
