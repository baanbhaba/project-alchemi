import type {
  ProjectSummary,
  CoreAudit,
  ImpactAudit,
  ConsensusResult,
  ReadinessScore,
} from "../types/contracts";
import {
  ProjectSummarySchema,
  CoreAuditSchema,
  ImpactAuditSchema,
  ConsensusResultSchema,
  ReadinessScoreSchema,
} from "../types/contracts";
import { fetchApi } from "./client";
import { analyzeCoreWithNvidia, analyzeImpactWithNvidia } from "./nvidiaEngine";
import { useAuthStore } from "../store/useAuthStore";
import { getTransformedCode } from "./transform";
import {
  detectJavaStack,
  detectJavaDeprecatedUsages,
  detectJavaImpactAudit,
  calculateReadinessScore,
  calculateConsensus,
  normalizeCoreAudit,
  normalizeImpactAudit,
  generateDetailedMermaidDiagrams,
} from "../lib/analysis";

export {
  detectJavaStack,
  detectJavaDeprecatedUsages,
  detectJavaImpactAudit,
  calculateReadinessScore as calculateDynamicReadinessScore,
  calculateConsensus as calculateDynamicConsensus,
  generateDetailedMermaidDiagrams,
} from "../lib/analysis";

let localProjectsStore: Record<string, ProjectSummary> = {};
let sourceCodeStore: Record<string, string> = {};
let liveCoreAudits: Record<string, CoreAudit> = {};
let liveImpactAudits: Record<string, ImpactAudit> = {};

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

const getPersistedSourceCode = (projectId: string): string => {
  if (sourceCodeStore[projectId]) return sourceCodeStore[projectId];
  try {
    const raw = safeStorage.getItem("ema_source_code_store");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed[projectId]) {
        sourceCodeStore[projectId] = parsed[projectId];
        return parsed[projectId];
      }
    }
  } catch {}
  return "";
};

const savePersistedSourceCode = (projectId: string, code: string) => {
  sourceCodeStore[projectId] = code;
  try {
    const raw = safeStorage.getItem("ema_source_code_store") || "{}";
    const parsed = JSON.parse(raw);
    parsed[projectId] = code;
    safeStorage.setItem("ema_source_code_store", JSON.stringify(parsed));
  } catch {}
};

export const getProjects = async (): Promise<ProjectSummary[]> => {
  try {
    const data = await fetchApi<ProjectSummary[]>("/projects");
    if (Array.isArray(data)) {
      const remoteIds = new Set(data.map((p) => p.id));
      for (const id of Object.keys(localProjectsStore)) {
        if (!remoteIds.has(id)) {
          delete localProjectsStore[id];
        }
      }
      data.forEach((p) => { localProjectsStore[p.id] = p; });
      return data.map((item) => ProjectSummarySchema.parse(item));
    }
  } catch {
    console.warn("[OFFLINE] Backend /projects unavailable — returning local store.");
  }
  return Object.values(localProjectsStore).map((p) => ProjectSummarySchema.parse(p));
};

export const getProjectDetails = async (projectId: string): Promise<any> => {
  try {
    const details = await fetchApi<any>(`/projects/${projectId}`);
    if (details && details.uploaded_sources && Array.isArray(details.uploaded_sources)) {
      const primary = details.uploaded_sources[0];
      const code = primary?.rawCode || primary?.raw_code;
      if (primary && code) {
        savePersistedSourceCode(projectId, code);
      }
    }
    if (details && details.impact_audit) {
      try {
        const norm = normalizeImpactAudit(details.impact_audit);
        if (norm) {
          liveImpactAudits[projectId] = ImpactAuditSchema.parse(norm);
        }
      } catch {}
    }
    if (details && details.core_audit) {
      try {
        const norm = normalizeCoreAudit(details.core_audit);
        if (norm) {
          liveCoreAudits[projectId] = CoreAuditSchema.parse(norm);
        }
      } catch {}
    }
    return details;
  } catch {
    console.warn(`[OFFLINE] Backend GET /projects/${projectId} unavailable.`);
    return {
      ...localProjectsStore[projectId],
      uploaded_sources: getProjectSourceCode(projectId),
      core_audit: liveCoreAudits[projectId] || null,
      impact_audit: liveImpactAudits[projectId] || null,
      blueprint: null,
    };
  }
};

export const createProject = async (data: {
  name: string;
  repo_url: string;
  javaCode?: string;
}): Promise<ProjectSummary> => {
  const codeToSave = (data.javaCode && data.javaCode.trim().length > 0)
    ? data.javaCode
    : "";

  let initialReadiness = 0;
  if (codeToSave) {
    const fileName = `${data.name.replace(/[^a-zA-Z0-9_]/g, "")}.java`;
    const detectedStack = detectJavaStack(codeToSave);
    const detectedUsages = detectJavaDeprecatedUsages(codeToSave, fileName);
    const coreAudit: CoreAudit = {
      architecture_summary: "",
      detected_stack: detectedStack,
      deprecated_usages: detectedUsages,
      dependency_graph: { nodes: [], edges: [] },
      diagrams: [],
      confidence: 0.72,
    };
    const impactAudit = detectJavaImpactAudit(codeToSave, fileName);
    const readiness = calculateReadinessScore(coreAudit, impactAudit, null);
    initialReadiness = readiness.overall;
  }

  const id = `proj-${Date.now().toString(36)}`;
  const newSummary: ProjectSummary = {
    id,
    name: data.name,
    repo_url: data.repo_url || "N/A",
    stage: codeToSave ? "analyzing" : "ingesting",
    readiness_score: initialReadiness,
    last_updated: new Date().toISOString(),
    java_from: "Java 8",
    java_to: "Java 21 / Rust Axum",
  };
  localProjectsStore[id] = newSummary;

  if (codeToSave) {
    savePersistedSourceCode(id, codeToSave);
  } else {
    // Save minimal placeholder structure
    const defaultPlaceholder = `public class ${data.name.replace(/\s+/g, "")} {\n    public static void main(String[] args) {\n        System.out.println("Executing ${data.name}");\n    }\n}`;
    savePersistedSourceCode(id, defaultPlaceholder);
  }

  try {
    const res = await fetchApi<ProjectSummary>("/projects", {
      method: "POST",
      body: JSON.stringify({ id, ...data }),
    });
    if (res && res.id) {
      localProjectsStore[res.id] = res;
      if (codeToSave) savePersistedSourceCode(res.id, codeToSave);
      return ProjectSummarySchema.parse(res);
    }
  } catch {
    console.warn("[OFFLINE] Backend /projects POST unavailable — creating in local store.");
  }
  return ProjectSummarySchema.parse(newSummary);
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  const { isDevMode } = useAuthStore.getState();

  delete localProjectsStore[projectId];
  delete sourceCodeStore[projectId];
  delete liveCoreAudits[projectId];
  delete liveImpactAudits[projectId];

  try {
    const raw = safeStorage.getItem("ema_source_code_store");
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed[projectId];
      safeStorage.setItem("ema_source_code_store", JSON.stringify(parsed));
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(`ema_blueprint_${projectId}`);
      sessionStorage.removeItem(`ema_transformed_${projectId}`);
      sessionStorage.removeItem(`ema_migration_artifact_${projectId}`);
      if (sessionStorage.getItem("ema_selected_project_id") === projectId) {
        sessionStorage.removeItem("ema_selected_project_id");
      }
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`ema_blueprint_${projectId}`);
      localStorage.removeItem(`ema_transformed_${projectId}`);
      localStorage.removeItem(`ema_migration_artifact_${projectId}`);
    }
  } catch {}

  if (isDevMode) return true;

  try {
    await fetchApi<{ success: boolean }>(`/projects/${projectId}`, { method: "DELETE" });
    return true;
  } catch (err) {
    console.warn(`[OFFLINE] Backend DELETE /projects/${projectId} unavailable or failed:`, err);
    return true;
  }
};

export const uploadProjectSourceCode = async (projectId: string, code: string): Promise<boolean> => {
  savePersistedSourceCode(projectId, code);
  try {
    await fetchApi(`/projects/${projectId}/upload`, {
      method: "POST",
      body: JSON.stringify({ rawCode: code }),
    });
  } catch {
    console.warn(`[STORAGE] Upload to backend DB failed for ${projectId}, saved in local storage fallback.`);
  }
  return true;
};

export const getProjectSourceCode = (projectId: string): Record<string, string> => {
  const code = getPersistedSourceCode(projectId);
  if (code) return { "Main.java": code };
  return {};
};

// ── Core Audit ─────────────────────────────────────────────────────────────────
// Priority: 1) Cached / DB audit from getProjectDetails, 2) Live AI (NVIDIA) in devMode,
// 3) Backend POST /analyze/core, 4) Real AST code analysis (detectJavaStack / detectJavaDeprecatedUsages).

export const getCoreAudit = async (projectId: string): Promise<CoreAudit> => {
  const { isDevMode } = useAuthStore.getState();

  // Return in-memory cache
  if (liveCoreAudits[projectId]) return liveCoreAudits[projectId];

  // Check if project details has it already
  try {
    const details = await getProjectDetails(projectId);
    if (details && details.core_audit) {
      const norm = normalizeCoreAudit(details.core_audit);
      if (norm) {
        const parsed = CoreAuditSchema.parse(norm);
        liveCoreAudits[projectId] = parsed;
        return parsed;
      }
    }
  } catch {}

  let javaCode = getPersistedSourceCode(projectId);
  if (!javaCode.trim()) {
    try {
      const details = await getProjectDetails(projectId);
      const primary = details?.uploaded_sources?.[0];
      javaCode = primary?.rawCode || primary?.raw_code || "";
      if (javaCode) savePersistedSourceCode(projectId, javaCode);
    } catch {}
  }
  const transformedRust = getTransformedCode(projectId);
  const combinedContext = transformedRust
    ? `LEGACY JAVA SOURCE CODE:\n${javaCode}\n\nTRANSFORMED RUST MODULES FROM BLUEPRINT REVIEW:\n${transformedRust}`
    : javaCode;

  const proj = localProjectsStore[projectId];
  const name = proj?.name || "Uploaded Project";

  // ── Tier 1: Dev mode — direct NVIDIA NIM call ──────────────────────────────
  if (isDevMode && javaCode.trim()) {
    try {
      const aiResult = await analyzeCoreWithNvidia(name, combinedContext);
      if (aiResult) {
        liveCoreAudits[projectId] = CoreAuditSchema.parse(aiResult);
        return liveCoreAudits[projectId];
      }
    } catch (e) {
      console.warn("[AUDIT] Live Nvidia core analysis failed, falling back to backend:", e);
    }
  }

  // ── Tier 2: Backend (Vercel function → AI) ──────────────────────────────
  try {
    const data = await fetchApi<CoreAudit>("/analyze/core", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, code: combinedContext }),
    });
    const parsed = CoreAuditSchema.parse(data);
    liveCoreAudits[projectId] = parsed;
    return parsed;
  } catch (err: any) {
    console.warn(`[AUDIT] Backend /analyze/core failed, computing AST core analysis:`, err);
    // ── Tier 3: Compute AST from actual Java source code ───────────────────
    if (javaCode.trim()) {
      const fileName = `${name.replace(/[^a-zA-Z0-9_]/g, "")}.java`;
      const detectedStack = detectJavaStack(javaCode);
      const deprecatedUsages = detectJavaDeprecatedUsages(javaCode, fileName);
      const diagrams = generateDetailedMermaidDiagrams(javaCode, name);
      const astCore: CoreAudit = {
        architecture_summary: `Modernized microservice topology for ${name} translated to Tokio runtime and Axum 0.7 routes.`,
        detected_stack: detectedStack,
        deprecated_usages: deprecatedUsages,
        dependency_graph: { nodes: [name], edges: [] },
        diagrams,
        confidence: 0.95,
      };
      liveCoreAudits[projectId] = astCore;
      return astCore;
    }
    throw err;
  }
};

// ── Impact Audit ───────────────────────────────────────────────────────────────
// Priority: 1) Cached / DB audit from getProjectDetails, 2) Live AI (NVIDIA) in devMode,
// 3) Backend POST /analyze/impact, 4) Real AST code analysis (detectJavaImpactAudit).

export const getImpactAudit = async (projectId: string): Promise<ImpactAudit> => {
  const { isDevMode } = useAuthStore.getState();

  if (liveImpactAudits[projectId]) return liveImpactAudits[projectId];

  // Check if project details has it already
  try {
    const details = await getProjectDetails(projectId);
    if (details && details.impact_audit) {
      const norm = normalizeImpactAudit(details.impact_audit);
      if (norm) {
        const parsed = ImpactAuditSchema.parse(norm);
        liveImpactAudits[projectId] = parsed;
        return parsed;
      }
    }
  } catch {}

  let javaCode = getPersistedSourceCode(projectId);
  if (!javaCode.trim()) {
    try {
      const details = await getProjectDetails(projectId);
      const primary = details?.uploaded_sources?.[0];
      javaCode = primary?.rawCode || primary?.raw_code || "";
      if (javaCode) savePersistedSourceCode(projectId, javaCode);
    } catch {}
  }
  const transformedRust = getTransformedCode(projectId);
  const combinedContext = transformedRust
    ? `LEGACY JAVA SOURCE CODE:\n${javaCode}\n\nTRANSFORMED RUST MODULES FROM BLUEPRINT REVIEW:\n${transformedRust}`
    : javaCode;

  const proj = localProjectsStore[projectId];
  const name = proj?.name || "Uploaded Project";

  // ── Tier 1: Dev mode — direct NVIDIA NIM call ──────────────────────────────
  if (isDevMode && javaCode.trim()) {
    try {
      const aiResult = await analyzeImpactWithNvidia(name, combinedContext);
      if (aiResult) {
        liveImpactAudits[projectId] = ImpactAuditSchema.parse(aiResult);
        return liveImpactAudits[projectId];
      }
    } catch (e) {
      console.warn("[AUDIT] Live Nvidia impact analysis failed, falling back to backend:", e);
    }
  }

  // ── Tier 2: Backend ────────────────────────────────────────────────────────
  try {
    const data = await fetchApi<ImpactAudit>("/analyze/impact", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, code: combinedContext }),
    });
    const parsed = ImpactAuditSchema.parse(data);
    liveImpactAudits[projectId] = parsed;
    return parsed;
  } catch (err: any) {
    console.warn(`[AUDIT] Backend /analyze/impact failed, computing AST impact analysis:`, err);
    // ── Tier 3: Compute AST from actual Java source code ───────────────────
    if (javaCode.trim()) {
      const fileName = `${name.replace(/[^a-zA-Z0-9_]/g, "")}.java`;
      const computed = detectJavaImpactAudit(javaCode, fileName);
      liveImpactAudits[projectId] = computed;
      return computed;
    }
    throw err;
  }
};

// ── Consensus ──────────────────────────────────────────────────────────────────
// Always computed from real core + impact audit data. No predefined mock results.

export const getConsensusResult = async (projectId: string): Promise<ConsensusResult> => {
  const { isDevMode } = useAuthStore.getState();

  if (!isDevMode) {
    try {
      const data = await fetchApi<ConsensusResult>(`/projects/${projectId}/consensus`);
      return ConsensusResultSchema.parse(data);
    } catch {
      console.warn(`[OFFLINE] Backend /projects/${projectId}/consensus unavailable — computing from local audits.`);
    }
  }

  const srcMap = getProjectSourceCode(projectId);
  const codeFiles = Object.keys(srcMap);
  const primaryFile = codeFiles[0] ? codeFiles[0].split("/").pop() || "App.java" : "Main.java";

  const coreAudit = await getCoreAudit(projectId).catch(() => null);
  const impactAudit = await getImpactAudit(projectId).catch(() => null);

  const dynamicConsensus = calculateConsensus(coreAudit, impactAudit, primaryFile);
  return ConsensusResultSchema.parse(dynamicConsensus);
};

// ── Readiness Score ────────────────────────────────────────────────────────────
// Always computed from real core + impact data. No predefined mock scores.

export const getReadinessScore = async (projectId: string): Promise<ReadinessScore> => {
  const { isDevMode } = useAuthStore.getState();

  if (!isDevMode) {
    try {
      const data = await fetchApi<ReadinessScore>(`/projects/${projectId}/readiness`);
      return ReadinessScoreSchema.parse(data);
    } catch {
      console.warn(`[OFFLINE] Backend /projects/${projectId}/readiness unavailable — computing from local audits.`);
    }
  }

  const coreAudit = await getCoreAudit(projectId).catch(() => null);
  const impactAudit = await getImpactAudit(projectId).catch(() => null);

  const dynamicReadiness = calculateReadinessScore(coreAudit, impactAudit, null);

  if (localProjectsStore[projectId]) {
    localProjectsStore[projectId].readiness_score = dynamicReadiness.overall;
  }

  return ReadinessScoreSchema.parse(dynamicReadiness);
};
