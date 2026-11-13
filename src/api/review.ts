import type { Blueprint, BlueprintStep } from "../types/contracts";
import { BlueprintSchema, BlueprintStepSchema } from "../types/contracts";
import { fetchApi } from "./client";
import { useAuthStore } from "../store/useAuthStore";
import { generateBlueprintWithNvidia } from "./nvidiaEngine";
import { getProjectSourceCode } from "./project";

let localBlueprintsStore: Record<string, Blueprint> = {};

const saveLocalBlueprint = (projectId: string, bp: Blueprint) => {
  localBlueprintsStore[projectId] = bp;
  try {
    sessionStorage.setItem(`ema_blueprint_${projectId}`, JSON.stringify(bp));
  } catch {}
};

export const getLocalBlueprint = (projectId: string): Blueprint | null => {
  if (localBlueprintsStore[projectId]) return localBlueprintsStore[projectId];
  try {
    const raw = sessionStorage.getItem(`ema_blueprint_${projectId}`) || localStorage.getItem(`ema_blueprint_${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      localBlueprintsStore[projectId] = parsed;
      return parsed;
    }
  } catch {}
  return null;
};

export const getBlueprint = async (projectId: string): Promise<Blueprint> => {
  const cached = getLocalBlueprint(projectId);
  try {
    const data = await fetchApi<Blueprint>(`/projects/${projectId}/blueprint`);
    if (data && data.steps && Array.isArray(data.steps)) {
      saveLocalBlueprint(projectId, data);
      return BlueprintSchema.parse(data);
    }
  } catch {
    console.warn(`[OFFLINE] Backend GET /projects/${projectId}/blueprint unavailable — building local blueprint.`);
  }

  if (cached) {
    return BlueprintSchema.parse(cached);
  }

  try {
    const data = await fetchApi<Blueprint>(`/projects/${projectId}/blueprint`);
    localBlueprintsStore[projectId] = data;
    return BlueprintSchema.parse(data);
  } catch {
    const srcMap = getProjectSourceCode(projectId);
    const codeFiles = Object.keys(srcMap);
    const primaryFile = codeFiles[0] || "src/Main.java";

    const steps: BlueprintStep[] = codeFiles.length > 0
      ? codeFiles.map((filename, idx) => ({
          id: `step-${idx + 1}`,
          file_or_module: filename,
          what_changes: `Migrate ${filename} to Rust Axum 0.7 microservice architecture`,
          why: `Modernize ${filename} for high concurrency and performance on Tokio runtime`,
          target_pattern: "",
          risk_level: idx === 0 ? "high" : "medium",
          depends_on: idx === 0 ? [] : [`step-${idx}`],
          status: "pending",
        }))
      : [
          {
            id: "step-1",
            file_or_module: primaryFile,
            what_changes: "Migrate REST Controller and legacy packages to Rust Axum 0.7 handlers",
            why: "Convert legacy Java OOP controller to high-performance Rust Axum service",
            target_pattern: "",
            risk_level: "high",
            depends_on: [],
            status: "pending",
          },
        ];

    localBlueprintsStore[projectId] = {
      project_id: projectId,
      steps,
    };
    return BlueprintSchema.parse(localBlueprintsStore[projectId]);
  }
};

export const regenerateBlueprintWithNvidiaAI = async (projectId: string): Promise<Blueprint> => {
  const { isDevMode } = useAuthStore.getState();
  const srcMap = getProjectSourceCode(projectId);
  const code = Object.values(srcMap).join("\n") || "public class Main { public static void main(String[] args) {} }";

  if (isDevMode) {
    const aiBlueprint = await generateBlueprintWithNvidia(projectId, projectId, code);
    if (aiBlueprint && aiBlueprint.steps && aiBlueprint.steps.length > 0) {
      localBlueprintsStore[projectId] = aiBlueprint;
      return BlueprintSchema.parse(aiBlueprint);
    }
  }
  return getBlueprint(projectId);
};

export const approveBlueprintStep = async (
  projectId: string,
  stepId: string
): Promise<BlueprintStep> => {
  try {
    const data = await fetchApi<BlueprintStep>(
      `/projects/${projectId}/blueprint/steps/${stepId}/approve`,
      { method: "POST" }
    );
    if (localBlueprintsStore[projectId]) {
      const idx = localBlueprintsStore[projectId].steps.findIndex((s) => s.id === stepId);
      if (idx !== -1) localBlueprintsStore[projectId].steps[idx] = data;
    }
    return BlueprintStepSchema.parse(data);
  } catch {
    const blueprint = await getBlueprint(projectId);
    const step = blueprint.steps.find((s) => s.id === stepId);
    if (!step) throw new Error(`Step '${stepId}' not found`);
    step.status = "approved";
    step.rejection_reason = undefined;
    if (localBlueprintsStore[projectId]) {
      const idx = localBlueprintsStore[projectId].steps.findIndex((s) => s.id === stepId);
      if (idx !== -1) localBlueprintsStore[projectId].steps[idx] = step;
    }
    return BlueprintStepSchema.parse(step);
  }
};

export const rejectBlueprintStep = async (
  projectId: string,
  stepId: string,
  reason: string
): Promise<BlueprintStep> => {
  if (!reason || reason.trim().length === 0) {
    throw new Error("Rejection reason is required when rejecting a blueprint step.");
  }
  try {
    const data = await fetchApi<BlueprintStep>(
      `/projects/${projectId}/blueprint/steps/${stepId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      }
    );
    if (localBlueprintsStore[projectId]) {
      const idx = localBlueprintsStore[projectId].steps.findIndex((s) => s.id === stepId);
      if (idx !== -1) localBlueprintsStore[projectId].steps[idx] = data;
    }
    return BlueprintStepSchema.parse(data);
  } catch {
    const blueprint = await getBlueprint(projectId);
    const step = blueprint.steps.find((s) => s.id === stepId);
    if (!step) throw new Error(`Step '${stepId}' not found`);
    step.status = "rejected";
    step.rejection_reason = reason.trim();
    if (localBlueprintsStore[projectId]) {
      const idx = localBlueprintsStore[projectId].steps.findIndex((s) => s.id === stepId);
      if (idx !== -1) localBlueprintsStore[projectId].steps[idx] = step;
    }
    return BlueprintStepSchema.parse(step);
  }
};

export const updateBlueprintStep = async (
  projectId: string,
  stepId: string,
  patch: Partial<BlueprintStep>
): Promise<BlueprintStep> => {
  try {
    const data = await fetchApi<BlueprintStep>(
      `/projects/${projectId}/blueprint/steps/${stepId}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      }
    );
    if (localBlueprintsStore[projectId]) {
      const idx = localBlueprintsStore[projectId].steps.findIndex((s) => s.id === stepId);
      if (idx !== -1) localBlueprintsStore[projectId].steps[idx] = data;
    }
    return BlueprintStepSchema.parse(data);
  } catch {
    const blueprint = await getBlueprint(projectId);
    const stepIndex = blueprint.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) throw new Error(`Step '${stepId}' not found`);
    blueprint.steps[stepIndex] = { ...blueprint.steps[stepIndex], ...patch };
    if (localBlueprintsStore[projectId]) {
      localBlueprintsStore[projectId].steps[stepIndex] = blueprint.steps[stepIndex];
    }
    return BlueprintStepSchema.parse(blueprint.steps[stepIndex]);
  }
};

export const approveAllBlueprintSteps = async (projectId: string): Promise<Blueprint> => {
  try {
    const data = await fetchApi<Blueprint>(`/projects/${projectId}/blueprint/approve-all`, {
      method: "POST",
    });
    localBlueprintsStore[projectId] = data;
    return BlueprintSchema.parse(data);
  } catch {
    const blueprint = await getBlueprint(projectId);
    blueprint.steps = blueprint.steps.map((s) => ({
      ...s,
      status: "approved",
      rejection_reason: undefined,
    }));
    localBlueprintsStore[projectId] = blueprint;
    return BlueprintSchema.parse(blueprint);
  }
};
