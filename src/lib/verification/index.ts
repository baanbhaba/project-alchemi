import type {
  VerificationAgentType,
  VerificationResult,
  VerificationReadinessBreakdown,
} from "../../types/contracts";
import { validateRustSyntaxAndCompilation } from "./syntaxCompilationValidator";
import { validateSemanticEquivalence } from "./semanticEquivalenceValidator";
import { validateArchitectureAndFramework } from "./architectureValidator";
import { validateSecurity } from "./securityValidator";
import { validateMigrationCompleteness } from "./completenessValidator";

export {
  validateRustSyntaxAndCompilation,
  validateSemanticEquivalence,
  validateArchitectureAndFramework,
  validateSecurity,
  validateMigrationCompleteness,
};

export interface VerificationPipelineOptions {
  fileName?: string;
  cargoToml?: string;
  relatedFiles?: Record<string, string>;
}

export async function runAllVerificationAgents(
  javaCode: string,
  rustCode: string,
  options: VerificationPipelineOptions = {}
): Promise<Record<VerificationAgentType, VerificationResult>> {
  const fileName = options.fileName || "src/main.rs";

  // Execute all 5 verification validators in parallel with complete isolation
  const tasks = [
    Promise.resolve().then(() =>
      validateRustSyntaxAndCompilation(rustCode, {
        fileName,
        cargoToml: options.cargoToml,
        relatedFiles: options.relatedFiles,
      })
    ),
    Promise.resolve().then(() =>
      validateSemanticEquivalence(javaCode, rustCode, fileName)
    ),
    Promise.resolve().then(() =>
      validateArchitectureAndFramework(javaCode, rustCode, fileName)
    ),
    Promise.resolve().then(() =>
      validateSecurity(rustCode, javaCode, fileName)
    ),
    Promise.resolve().then(() =>
      validateMigrationCompleteness(javaCode, rustCode, fileName)
    ),
  ];

  const results = await Promise.allSettled(tasks);

  const fallbackResult = (
    agent: VerificationAgentType,
    errorMsg: string
  ): VerificationResult => ({
    agent,
    status: "error",
    confidence: 0.5,
    issues: [
      {
        severity: "critical",
        file: fileName,
        category: "agent_execution_error",
        description: `Verification agent '${agent}' encountered an unexpected internal error: ${errorMsg}`,
        recommendation: "Inspect agent logs or retry verification without regenerating source.",
      },
    ],
    metrics: { error: true, agent_failed: true },
    execution_time_ms: 0,
  });

  const getResult = (
    index: number,
    agent: VerificationAgentType
  ): VerificationResult => {
    const outcome = results[index];
    if (outcome.status === "fulfilled") {
      return outcome.value;
    } else {
      const err = outcome.reason;
      return fallbackResult(
        agent,
        err instanceof Error ? err.message : String(err)
      );
    }
  };

  return {
    syntax_compilation: getResult(0, "syntax_compilation"),
    semantic_equivalence: getResult(1, "semantic_equivalence"),
    architecture_framework: getResult(2, "architecture_framework"),
    security: getResult(3, "security"),
    migration_completeness: getResult(4, "migration_completeness"),
  };
}

/**
 * Consensus & Readiness Engine calculation for verification pipeline results.
 * Applies evidence-based deductions:
 * - Syntax/compilation failure: -40 points
 * - Semantic equivalence failure: -30 points
 * - Security failure: -20 points
 * - Completeness / Architecture issues: proportional deductions
 */
export function calculateVerificationReadiness(
  verificationResults: Record<VerificationAgentType, VerificationResult>
): {
  overall: number;
  breakdown: VerificationReadinessBreakdown;
} {
  const syntax = verificationResults.syntax_compilation;
  const semantic = verificationResults.semantic_equivalence;
  const arch = verificationResults.architecture_framework;
  const sec = verificationResults.security;
  const comp = verificationResults.migration_completeness;

  const details: string[] = [];

  // Base scores (0-100)
  let compilationScore = syntax.status === "passed" ? 100 : syntax.status === "warning" ? 75 : 10;
  let semanticScore = semantic.status === "passed" ? 100 : semantic.status === "warning" ? 70 : 15;
  let archScore = arch.status === "passed" ? 100 : arch.status === "warning" ? 80 : 40;
  let secScore = sec.status === "passed" ? 100 : sec.status === "warning" ? 75 : 20;

  const compMetric = comp.metrics?.completeness_percentage;
  let compScore = typeof compMetric === "number" ? compMetric : comp.status === "passed" ? 100 : 50;

  // Critical deductions
  let criticalPenalty = 0;

  if (syntax.status === "failed") {
    criticalPenalty += 40;
    details.push("Compilation/Syntax failure detected (-40pts): Generated Rust contains unparseable syntax or unclosed delimiters.");
  }

  if (semantic.status === "failed") {
    criticalPenalty += 30;
    details.push("Critical semantic divergence detected (-30pts): Business logic or collection mutations replaced with placeholder stubs.");
  }

  if (sec.status === "failed") {
    criticalPenalty += 20;
    details.push("Critical security vulnerability detected (-20pts): Unsafe blocks, SQL injection, or hardcoded secrets found.");
  }

  if (comp.status === "failed") {
    criticalPenalty += 10;
    details.push("Incomplete migration (-10pts): Missing classes/methods or unimplemented!()/todo!() macros present.");
  }

  // Weighted calculation (Weights sum to 100%)
  // Compilation: 25%, Semantic: 25%, Architecture: 20%, Security: 15%, Completeness: 15%
  const weighted =
    compilationScore * 0.25 +
    semanticScore * 0.25 +
    archScore * 0.20 +
    secScore * 0.15 +
    compScore * 0.15;

  const overall = Math.max(0, Math.min(100, Math.round(weighted - criticalPenalty)));

  if (details.length === 0) {
    details.push("All verification stages passed with zero critical violations. Ready for production compilation.");
  }

  return {
    overall,
    breakdown: {
      compilation: compilationScore,
      semantic_equivalence: semanticScore,
      completeness: compScore,
      architecture: archScore,
      security: secScore,
      critical_penalty: criticalPenalty,
      details,
    },
  };
}
