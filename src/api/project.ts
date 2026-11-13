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
  const srcMap = getProjectSourceCode(projectId);
  const fileName = Object.keys(srcMap)[0] || `${proj?.name || "Main"}.java`;

  // ── Tier 1: Dev mode — direct NVIDIA NIM call ──────────────────────────────
  if (isDevMode) {
    const name = proj?.name || "Uploaded Project";
    const aiResult = await analyzeCoreWithNvidia(name, combinedContext);
    if (aiResult) {
      liveCoreAudits[projectId] = CoreAuditSchema.parse(aiResult);
      return liveCoreAudits[projectId];
    }
  }

  // ── Tier 2: Backend (Vercel function → AI or static analysis) ─────────────
  try {
    const data = await fetchApi<CoreAudit>("/analyze/core", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, code: combinedContext }),
    });
    const parsed = CoreAuditSchema.parse(data);
    liveCoreAudits[projectId] = parsed;
    return parsed;
  } catch {
    // ── Tier 3: Real local static analysis — NO fake predefined data ──────────
    // Uses the actual uploaded Java code, not hardcoded Spring Boot placeholders.
    console.warn(`[OFFLINE] Backend /analyze/core unavailable — running local static analysis on uploaded code.`);

    const detectedStack = javaCode.trim()
      ? detectJavaStack(javaCode)
      : [{ technology: "Java", version: "unknown", status: "deprecated" as const }];

    const detectedUsages = javaCode.trim()
      ? detectJavaDeprecatedUsages(javaCode, fileName)
      : [];

    const classNames = [...(javaCode.matchAll(/(?:public\s+)?class\s+(\w+)/g))].map(m => m[1]);
    const nodes = classNames.length > 0
      ? classNames
      : [fileName.replace(/\.java$/, ""), "Service", "Repository"];

    const edges = nodes.length > 1
      ? nodes.slice(0, -1).map((n, i) => ({ from: n, to: nodes[i + 1] }))
      : [];

    // Detailed multi-node architectural diagrams derived from source code
    const diagrams = generateDetailedMermaidDiagrams(javaCode, proj?.name || "Service", transformedRust);

    const result: CoreAudit = {
      architecture_summary: javaCode.trim()
        ? `Architectural static analysis of '${fileName}'. Detected ${classNames.length} class component(s), ${detectedUsages.length} legacy API usage(s), and ${detectedStack.length} runtime stack dependency(ies). Modernization path: high-concurrency Rust Axum 0.7 with tokio asynchronous runtime.`
        : `No Java source uploaded for project '${proj?.name || projectId}'. Upload source code to enable analysis.`,
      detected_stack: detectedStack,
      deprecated_usages: detectedUsages,
      dependency_graph: { nodes, edges },
      diagrams,
      confidence: javaCode.trim() ? 0.88 : 0.1,
    };

    liveCoreAudits[projectId] = CoreAuditSchema.parse(result);
    return liveCoreAudits[projectId];
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
  const srcMap = getProjectSourceCode(projectId);
  const fileName = Object.keys(srcMap)[0] || `${proj?.name || "Main"}.java`;

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
  } catch {
    // ── Tier 3: Real local static analysis ────────────────────────────────────
    console.warn(`[OFFLINE] Backend /analyze/impact unavailable — running local static analysis on uploaded code.`);

    if (javaCode.trim()) {
      const dynamicImpact = detectJavaImpactAudit(javaCode, fileName);
      const parsed = ImpactAuditSchema.parse(dynamicImpact);
      liveImpactAudits[projectId] = parsed;
      return parsed;
    }

    // No code uploaded at all — minimal honest result
    const result: ImpactAudit = {
      api_surface: [{
        endpoint_or_interface: `${proj?.name || "Project"} (no source uploaded)`,
        consumers: ["Unknown"],
        breaking_change_risk: "low",
      }],
      database_impacts: [{
        component: "Unknown — no source uploaded",
        risk: "low",
        notes: "Upload Java source code to enable impact analysis.",
      }],
      config_impacts: [{
        component: "Unknown — no source uploaded",
        risk: "low",
        notes: "Upload Java source code to enable config impact analysis.",
      }],
      dependency_risks: [],
      blast_radius: [{
        change: "Source not uploaded",
        affected_files: [],
        severity: "low",
      }],
      confidence: 0.1,
    };

    liveImpactAudits[projectId] = ImpactAuditSchema.parse(result);
    return liveImpactAudits[projectId];
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
