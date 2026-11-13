import { prisma } from "../lib/prisma.js";
import { calculateReadinessScore } from "../lib/analysis.js";

function toSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function toSnakeCaseKeys(value: any): any {
  if (Array.isArray(value)) return value.map(toSnakeCaseKeys);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[toSnakeKey(k)] = toSnakeCaseKeys(v);
    }
    return out;
  }
  return value;
}

export function normalizeCoreAudit(raw: any) {
  if (!raw) return null;
  const audit = toSnakeCaseKeys(raw);
  return {
    architecture_summary: audit.architecture_summary || "Architecture audit",
    detected_stack: audit.detected_stack || [],
    deprecated_usages: audit.deprecated_usages || [],
    dependency_graph: audit.dependency_graph || { nodes: [], edges: [] },
    diagrams: audit.diagrams || [],
    confidence: typeof audit.confidence === "number" ? audit.confidence : 0.9,
  };
}

export function normalizeImpactAudit(raw: any) {
  if (!raw) return null;
  const audit = toSnakeCaseKeys(raw);
  return {
    api_surface: audit.api_surface || [],
    database_impacts: audit.database_impacts || [],
    config_impacts: audit.config_impacts || [],
    dependency_risks: audit.dependency_risks || [],
    blast_radius: audit.blast_radius || [],
    confidence: typeof audit.confidence === "number" ? audit.confidence : 0.9,
  };
}

export async function refreshProjectReadiness(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      coreAudit: true,
      impactAudit: true,
      blueprint: { include: { steps: true } },
    },
  });

  if (!project) return;

  const coreAudit = normalizeCoreAudit(project.coreAudit);
  const impactAudit = normalizeImpactAudit(project.impactAudit);
  const blueprint = project.blueprint
    ? {
        project_id: projectId,
        steps: project.blueprint.steps.map((s: any) => ({
          id: s.id,
          status: s.status,
        })),
      }
    : null;

  const readiness = calculateReadinessScore(coreAudit, impactAudit, blueprint);

  await prisma.project.update({
    where: { id: projectId },
    data: { stage: "readiness", readinessScore: readiness.overall },
  }).catch(() => null);

  return readiness;
}
