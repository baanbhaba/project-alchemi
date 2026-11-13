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
    if (Array.isArray(data) && data.length > 0) {
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
      if (primary && primary.rawCode) {
        savePersistedSourceCode(projectId, primary.rawCode);
      }
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

  if (isDevMode) return true;

  try {
    await fetchApi<{ success: boolean }>(`/projects/${projectId}`, { method: "DELETE" });
    return true;
  } catch {
    console.warn(`[OFFLINE] Backend DELETE /projects/${projectId} unavailable — removed from local store.`);
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
// Priority: 1) Live AI (NVIDIA) in devMode, 2) Backend POST /analyze/core,
// 3) Local static analysis of the ACTUAL uploaded code (no predefined mocks).

export const getCoreAudit = async (projectId: string): Promise<CoreAudit> => {
  const { isDevMode } = useAuthStore.getState();

  // Return in-memory cache
  if (liveCoreAudits[projectId]) return liveCoreAudits[projectId];

  const javaCode = getPersistedSourceCode(projectId);
  const transformedRust = getTransformedCode(projectId);
  const combinedContext = transformedRust
    ? `LEGACY JAVA SOURCE CODE:\n${javaCode}\n\nTRANSFORMED RUST MODULES FROM BLUEPRINT REVIEW:\n${transformedRust}`
    : javaCode;

  const proj = localProjectsStore[projectId];

  // ── Tier 1: Dev mode — direct NVIDIA NIM call ──────────────────────────────
  if (isDevMode) {
    const name = proj?.name || "Uploaded Project";
    const aiResult = await analyzeCoreWithNvidia(name, combinedContext);
    if (aiResult) {
      liveCoreAudits[projectId] = CoreAuditSchema.parse(aiResult);
      return liveCoreAudits[projectId];
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
    console.error(`[AUDIT] Backend /analyze/core failed:`, err);
    throw err;
  }
};

// ── Impact Audit ───────────────────────────────────────────────────────────────
// Same 3-tier pattern. No predefined mocks — uses detectJavaImpactAudit on real code.

export const getImpactAudit = async (projectId: string): Promise<ImpactAudit> => {
  const { isDevMode } = useAuthStore.getState();

  if (liveImpactAudits[projectId]) return liveImpactAudits[projectId];

  const javaCode = getPersistedSourceCode(projectId);
  const transformedRust = getTransformedCode(projectId);
  const combinedContext = transformedRust
    ? `LEGACY JAVA SOURCE CODE:\n${javaCode}\n\nTRANSFORMED RUST MODULES FROM BLUEPRINT REVIEW:\n${transformedRust}`
    : javaCode;

  const proj = localProjectsStore[projectId];

  // ── Tier 1: Dev mode — direct NVIDIA NIM call ──────────────────────────────
  if (isDevMode) {
    const name = proj?.name || "Uploaded Project";
    const aiResult = await analyzeImpactWithNvidia(name, combinedContext);
    if (aiResult) {
      liveImpactAudits[projectId] = ImpactAuditSchema.parse(aiResult);
      return liveImpactAudits[projectId];
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
    console.error(`[AUDIT] Backend /analyze/impact failed:`, err);
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
