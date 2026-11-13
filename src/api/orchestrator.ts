import type { MigrationContext } from "../types/contracts";
import {
  triggerTransformation,
  saveTransformedCode,
  generateRustCodeFromJava,
  isJavaSourceCode,
} from "./transform";
import { sanitizeRustCode } from "../utils/exportRustCode";
import {
  runAllVerificationAgents,
  calculateVerificationReadiness,
} from "../lib/verification";

// In-memory cache for fast retrieval & lambda resilience
const memoryContextCache: Map<string, MigrationContext> = new Map();

// In-flight deduplication tracker (handles concurrent requests safely)
const inFlightRequests: Map<string, Promise<MigrationContext>> = new Map();

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


export interface UnifiedMigrationOptions {
  fileName?: string;
  forceRegenerate?: boolean;
  onProgress?: (stage: string, percent: number) => void;
  cargoToml?: string;
  relatedFiles?: Record<string, string>;
}

export function detectFramework(javaSource: string): { detected: string; target: string } {
  let detected = "Java Standard Edition";
  if (javaSource.includes("@SpringBootApplication") || javaSource.includes("@RestController") || javaSource.includes("@Service")) {
    detected = "Spring Boot 3.x / Web MVC";
  } else if (javaSource.includes("javax.servlet") || javaSource.includes("jakarta.servlet") || javaSource.includes("HttpServlet")) {
    detected = "Java EE / Servlet API";
  } else if (javaSource.includes("static void main")) {
    detected = "Java CLI / Core Application";
  }

  return {
    detected,
    target: "Rust Axum 0.7 / Tokio Runtime",
  };
}

export function getMigrationContext(projectId: string): MigrationContext | null {
  if (memoryContextCache.has(projectId)) {
    return memoryContextCache.get(projectId)!;
  }

  try {
    const raw = safeStorage.getItem(`ema_migration_artifact_${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as MigrationContext;
      memoryContextCache.set(projectId, parsed);
      return parsed;
    }
  } catch {}

  return null;
}

export function saveMigrationContext(context: MigrationContext): void {
  memoryContextCache.set(context.project_id, context);
  try {
    safeStorage.setItem(
      `ema_migration_artifact_${context.project_id}`,
      JSON.stringify(context)
    );
  } catch {}
}

/**
 * Primary entry point for the Unified Migration & Automated Verification Pipeline.
 *
 * Guarantees:
 * 1. Performs EXACTLY ONE migration generation request per code submission.
 * 2. Captures and persists the complete Rust artifact.
 * 3. Automatically distributes the identical artifact to all downstream verification agents.
 * 4. Deduplicates simultaneous calls for the same project.
 * 5. Downstream verification NEVER triggers code regeneration.
 */
export async function executeUnifiedMigration(
  projectId: string,
  javaSource: string,
  options: UnifiedMigrationOptions = {}
): Promise<MigrationContext> {
  // Deduplication: if an execution is already in flight for this projectId, reuse the existing promise
  if (inFlightRequests.has(projectId)) {
    return inFlightRequests.get(projectId)!;
  }

  const executionPromise = (async () => {
    const notify = (stage: string, percent: number) => {
      if (options.onProgress) {
        options.onProgress(stage, percent);
      }
    };

    const fileName = options.fileName || "src/main.rs";
    const { detected, target } = detectFramework(javaSource);

    // Check if we already have a valid stored artifact for this project & code
    const existing = getMigrationContext(projectId);
    let rustCode: string = "";
    let generationCount = 0;

    const canReuseExistingArtifact =
      !options.forceRegenerate &&
      existing &&
      existing.generated_rust_source &&
      existing.generated_rust_source.trim().length > 0 &&
      existing.original_java_source === javaSource;

    if (canReuseExistingArtifact) {
      notify("Reusing existing stored migration artifact...", 20);
      rustCode = existing.generated_rust_source;
      generationCount = existing.generation_call_count || 1;
    } else {
      // Step 1: Execute ONE primary migration generation request
      notify("Initiating primary code migration generation...", 15);

      if (!isJavaSourceCode(javaSource)) {
        throw new Error("Invalid input: Please provide valid Java source code for migration.");
      }

      generationCount = (existing?.generation_call_count || 0) + 1;

      try {
        const transRes = await triggerTransformation(projectId, "step-1", javaSource);
        rustCode = sanitizeRustCode(transRes.transformed_code);
      } catch (err) {
        // Fallback to deterministic AST migration engine
        console.warn("[ORCHESTRATOR] Migration engine fallback engaged:", err);
        const fallbackCode = generateRustCodeFromJava(javaSource);
        rustCode = sanitizeRustCode(fallbackCode);
        saveTransformedCode(projectId, "step-1", rustCode);
      }

      notify("Migration generation complete. Storing artifact...", 40);
    }

    // Step 2: Persist the complete generated Rust artifact
    saveTransformedCode(projectId, "step-1", rustCode);

    // Step 3: Automatically distribute the SAME artifact to all downstream verification agents
    notify("Distributing artifact to downstream verification validators...", 55);

    const verificationResults = await runAllVerificationAgents(
      javaSource,
      rustCode,
      {
        fileName,
        cargoToml: options.cargoToml,
        relatedFiles: options.relatedFiles,
      }
    );

    notify("Evaluating consensus & readiness scoring...", 85);

    // Step 4: Consensus & Readiness calculation using actual verification evidence
    const readiness = calculateVerificationReadiness(verificationResults);

    const migrationId =
      existing?.migration_id ||
      `mig-${projectId}-${Date.now().toString(36)}`;

    const context: MigrationContext = {
      migration_id: migrationId,
      project_id: projectId,
      original_java_source: javaSource,
      generated_rust_source: rustCode,
      migration_timestamp: new Date().toISOString(),
      source_file_mapping: {
        [fileName]: rustCode,
      },
      detected_framework: detected,
      target_framework: target,
      migration_status: "completed",
      verification_results: verificationResults,
      readiness_score: readiness.overall,
      readiness_breakdown: readiness.breakdown,
      generation_call_count: generationCount,
    };

    // Step 5: Persist complete migration context
    saveMigrationContext(context);

    notify("Migration pipeline completed successfully.", 100);
    return context;
  })();

  inFlightRequests.set(projectId, executionPromise);

  try {
    return await executionPromise;
  } finally {
    inFlightRequests.delete(projectId);
  }
}

/**
 * Retries the verification pipeline against the EXISTING persisted migration artifact.
 * Under NO circumstances does this regenerate Rust code.
 */
export async function retryVerification(
  projectId: string,
  options: { fileName?: string; cargoToml?: string } = {}
): Promise<MigrationContext> {
  const existing = getMigrationContext(projectId);
  if (!existing || !existing.generated_rust_source) {
    throw new Error(
      `No existing migration artifact found for project '${projectId}'. Verification retry requires an existing artifact.`
    );
  }

  const fileName = options.fileName || "src/main.rs";

  // Re-run the verification pipeline against the EXACT existing artifact
  const verificationResults = await runAllVerificationAgents(
    existing.original_java_source,
    existing.generated_rust_source,
    {
      fileName,
      cargoToml: options.cargoToml,
    }
  );

  const readiness = calculateVerificationReadiness(verificationResults);

  const updatedContext: MigrationContext = {
    ...existing,
    migration_timestamp: new Date().toISOString(),
    verification_results: verificationResults,
    readiness_score: readiness.overall,
    readiness_breakdown: readiness.breakdown,
    // Note: generation_call_count remains unchanged — NO code was generated!
  };

  saveMigrationContext(updatedContext);
  return updatedContext;
}

/**
 * Resets the in-memory cache and in-flight tracking (primarily for testing and clean teardown).
 */
export function clearOrchestratorCache(): void {
  memoryContextCache.clear();
  inFlightRequests.clear();
}
