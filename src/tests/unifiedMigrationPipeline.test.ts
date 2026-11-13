import { describe, it, expect, beforeEach } from "vitest";
import {
  executeUnifiedMigration,
  retryVerification,
  getMigrationContext,
  clearOrchestratorCache,
  detectFramework,
} from "../api/orchestrator";
import {
  validateRustSyntaxAndCompilation,
  validateSemanticEquivalence,
  validateArchitectureAndFramework,
  validateSecurity,
  validateMigrationCompleteness,
  calculateVerificationReadiness,
  runAllVerificationAgents,
} from "../lib/verification";
import type {
  VerificationAgentType,
  VerificationResult,
} from "../types/contracts";

describe("ALCHEMI — Unified Migration & Automated Verification Pipeline", () => {
  beforeEach(() => {
    clearOrchestratorCache();
    if (typeof window !== "undefined") {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    }
  });

  const sampleJavaBillingController = `
package com.acme.billing;

import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {
    private List<String> invoices = new ArrayList<>();

    @PostMapping("/invoice")
    public String createInvoice(@RequestBody String invoiceId) {
        invoices.add(invoiceId);
        return "Invoice created: " + invoiceId;
    }
}
`;

  // 1. One migration request produces one stored artifact
  it("Requirement 1: One migration request produces one stored artifact", async () => {
    const projectId = "proj-req-1";
    const context = await executeUnifiedMigration(
      projectId,
      sampleJavaBillingController,
      { fileName: "BillingController.java" }
    );

    expect(context).toBeDefined();
    expect(context.project_id).toBe(projectId);
    expect(context.migration_id).toMatch(/^mig-proj-req-1-/);
    expect(context.generated_rust_source).toBeDefined();
    expect(context.generated_rust_source.length).toBeGreaterThan(20);
    expect(context.generation_call_count).toBe(1);
    expect(context.migration_status).toBe("completed");

    // Persisted in storage & cache
    const retrieved = getMigrationContext(projectId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.migration_id).toBe(context.migration_id);
    expect(retrieved?.generated_rust_source).toBe(context.generated_rust_source);
  });

  // 2. Multiple verification agents receive the same artifact
  it("Requirement 2: Multiple verification agents receive the same artifact", async () => {
    const projectId = "proj-req-2";
    const context = await executeUnifiedMigration(
      projectId,
      sampleJavaBillingController,
      { fileName: "BillingController.java" }
    );

    const results = context.verification_results;
    expect(results).toBeDefined();

    // All 5 verification agents must be present
    const expectedAgents: VerificationAgentType[] = [
      "syntax_compilation",
      "semantic_equivalence",
      "architecture_framework",
      "security",
      "migration_completeness",
    ];

    for (const agent of expectedAgents) {
      expect(results[agent]).toBeDefined();
      expect(results[agent].agent).toBe(agent);
      expect(typeof results[agent].status).toBe("string");
      expect(Array.isArray(results[agent].issues)).toBe(true);
      expect(results[agent].metrics).toBeDefined();
    }
  });

  // 3. Verification retries do not regenerate Rust code
  it("Requirement 3: Verification retries do not regenerate Rust code", async () => {
    const projectId = "proj-req-3";

    // Step 1: Initial generation
    const initialContext = await executeUnifiedMigration(
      projectId,
      sampleJavaBillingController,
      { fileName: "BillingController.java" }
    );

    const initialRust = initialContext.generated_rust_source;
    const initialCalls = initialContext.generation_call_count;
    expect(initialCalls).toBe(1);

    // Step 2: Retry verification
    const retriedContext = await retryVerification(projectId, {
      fileName: "BillingController.java",
    });

    // The generated Rust artifact must remain IDENTICAL
    expect(retriedContext.generated_rust_source).toBe(initialRust);
    // Generation call count must remain 1 — NO re-generation allowed
    expect(retriedContext.generation_call_count).toBe(initialCalls);
    expect(retriedContext.verification_results).toBeDefined();
    expect(retriedContext.readiness_score).toBeGreaterThan(0);
  });

  // 4. Semantic verification detects placeholder methods (println! placeholder instead of users.add)
  it("Requirement 4: Semantic verification detects placeholder methods", () => {
    const javaCode = `
public class UserManager {
    private List<String> users = new ArrayList<>();

    public void addUser(String name) {
        users.add(name);
    }
}
`;

    // Rust code where business logic was replaced with placeholder println! statement
    const placeholderRust = `
pub struct UserManager {
    pub users: Vec<String>,
}

impl UserManager {
    pub fn add_user(&mut self, name: String) -> Result<(), Box<dyn std::error::Error>> {
        println!("Executed add_user");
        Ok(())
    }
}
`;

    const result = validateSemanticEquivalence(javaCode, placeholderRust);

    expect(result.status).toBe("failed");
    expect(result.metrics.placeholder_methods_detected).toBeGreaterThan(0);

    const criticalIssues = result.issues.filter((i) => i.severity === "critical");
    expect(criticalIssues.length).toBeGreaterThan(0);

    const logicIssue = criticalIssues.find((i) => i.category === "missing_business_logic");
    expect(logicIssue).toBeDefined();
    expect(logicIssue?.description).toContain("placeholder");
  });

  // 5. Semantic verification detects missing business logic (loops/conditionals omitted)
  it("Requirement 5: Semantic verification detects missing business logic", () => {
    const javaCodeWithLoop = `
public class OrderBatch {
    public int processOrders(List<Integer> orders) {
        int count = 0;
        for (int order : orders) {
            if (order > 100) {
                count++;
            }
        }
        return count;
    }
}
`;

    // Rust code that omitted loop entirely
    const stubRustWithoutLoop = `
pub struct OrderBatch;

impl OrderBatch {
    pub fn process_orders(&self, orders: Vec<i64>) -> i64 {
        0
    }
}
`;

    const result = validateSemanticEquivalence(javaCodeWithLoop, stubRustWithoutLoop);

    expect(result.status).toBe("failed");
    const loopIssue = result.issues.find(
      (i) => i.category === "missing_loop_logic" || i.category === "placeholder_implementation"
    );
    expect(loopIssue).toBeDefined();
  });

  // 6. Compilation failures are correctly reported
  it("Requirement 6: Compilation failures are correctly reported", () => {
    const unclosedRust = `
pub struct PaymentService {
    pub id: String,
// Missing closing braces and invalid Java leftovers
public class LeakedJavaClass {
    void doThing() {
        System.out.println("Unconverted Java syntax");
    }
`;

    const result = validateRustSyntaxAndCompilation(unclosedRust);

    expect(result.status).toBe("failed");
    expect(result.metrics.compilable).toBe(false);
    expect(result.metrics.syntax_errors).toBeGreaterThan(0);

    const unclosedIssue = result.issues.find((i) => i.category.includes("unclosed") || i.category.includes("leftover_java"));
    expect(unclosedIssue).toBeDefined();
  });

  // 7. Agent failures do not erase successful results
  it("Requirement 7: Agent failures do not erase successful results", async () => {
    const javaSource = sampleJavaBillingController;
    const validRust = `
use axum::{routing::post, Router, Json};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct InvoicePayload { pub id: String }

pub fn create_router() -> Router {
    Router::new()
}
`;

    const results = await runAllVerificationAgents(javaSource, validRust);

    expect(results.syntax_compilation).toBeDefined();
    expect(results.semantic_equivalence).toBeDefined();
    expect(results.architecture_framework).toBeDefined();
    expect(results.security).toBeDefined();
    expect(results.migration_completeness).toBeDefined();

    // Verify syntax validator succeeded independently
    expect(results.syntax_compilation.status).toBe("passed");
  });

  // 8. Readiness scores reflect critical failures
  it("Requirement 8: Readiness scores reflect critical failures", () => {
    const mockFailingResults: Record<VerificationAgentType, VerificationResult> = {
      syntax_compilation: {
        agent: "syntax_compilation",
        status: "failed",
        confidence: 0.95,
        issues: [
          {
            severity: "critical",
            file: "src/main.rs",
            category: "syntax_error",
            description: "Unparseable syntax",
            recommendation: "Fix syntax",
          },
        ],
        metrics: { compilable: false, syntax_errors: 2 },
      },
      semantic_equivalence: {
        agent: "semantic_equivalence",
        status: "failed",
        confidence: 0.95,
        issues: [
          {
            severity: "critical",
            file: "src/main.rs",
            category: "missing_business_logic",
            description: "Placeholder println! used instead of logic",
            recommendation: "Implement logic",
          },
        ],
        metrics: { placeholder_methods_detected: 1 },
      },
      architecture_framework: {
        agent: "architecture_framework",
        status: "passed",
        confidence: 0.95,
        issues: [],
        metrics: { routes_detected: 1 },
      },
      security: {
        agent: "security",
        status: "failed",
        confidence: 0.95,
        issues: [
          {
            severity: "critical",
            file: "src/main.rs",
            category: "unsafe_rust_block",
            description: "Unsafe block detected",
            recommendation: "Remove unsafe",
          },
        ],
        metrics: { unsafe_blocks_count: 1 },
      },
      migration_completeness: {
        agent: "migration_completeness",
        status: "warning",
        confidence: 0.90,
        issues: [],
        metrics: { completeness_percentage: 60 },
      },
    };

    const failingReadiness = calculateVerificationReadiness(mockFailingResults);

    // Readiness score must drop severely due to critical compilation (-40), semantic (-30), and security (-20) penalties
    expect(failingReadiness.overall).toBeLessThan(35);
    expect(failingReadiness.breakdown.critical_penalty).toBeGreaterThanOrEqual(70);
    expect(failingReadiness.breakdown.details.length).toBeGreaterThanOrEqual(3);

    // Pristine passing results comparison
    const mockPassingResults: Record<VerificationAgentType, VerificationResult> = {
      syntax_compilation: { agent: "syntax_compilation", status: "passed", confidence: 0.99, issues: [], metrics: { compilable: true } },
      semantic_equivalence: { agent: "semantic_equivalence", status: "passed", confidence: 0.95, issues: [], metrics: { semantic_parity_score: 100 } },
      architecture_framework: { agent: "architecture_framework", status: "passed", confidence: 0.95, issues: [], metrics: { routes_detected: 1 } },
      security: { agent: "security", status: "passed", confidence: 0.98, issues: [], metrics: { unsafe_blocks_count: 0 } },
      migration_completeness: { agent: "migration_completeness", status: "passed", confidence: 0.98, issues: [], metrics: { completeness_percentage: 100 } },
    };

    const passingReadiness = calculateVerificationReadiness(mockPassingResults);
    expect(passingReadiness.overall).toBeGreaterThanOrEqual(95);
    expect(passingReadiness.breakdown.critical_penalty).toBe(0);
  });

  // 9. SSE responses are completely accumulated before verification
  it("Requirement 9: SSE responses are completely accumulated before verification", () => {
    // Simulate SSE tokens streaming in chunks
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"use axum::{Router, Json};\\n"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"pub struct HealthResponse { pub ok: bool }\\n"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"pub fn app() -> Router { Router::new() }"}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    let accumulatedRustCode = "";
    for (const chunk of sseChunks) {
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && !line.includes("[DONE]")) {
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || "";
            accumulatedRustCode += delta;
          } catch {}
        }
      }
    }

    expect(accumulatedRustCode).toContain("use axum::{Router, Json};");
    expect(accumulatedRustCode).toContain("pub struct HealthResponse");
    expect(accumulatedRustCode).toContain("pub fn app() -> Router");

    // Static verification executes ONLY after full stream accumulation
    const verification = validateRustSyntaxAndCompilation(accumulatedRustCode);
    expect(verification.status).toBe("passed");
    expect(verification.metrics.compilable).toBe(true);
  });

  // 10. Duplicate migration requests are handled safely (idempotent / deduplication)
  it("Requirement 10: Duplicate migration requests are handled safely", async () => {
    const projectId = "proj-req-10-dedup";

    // Launch two parallel migration requests concurrently for the exact same project
    const [p1, p2] = await Promise.all([
      executeUnifiedMigration(projectId, sampleJavaBillingController, { fileName: "Billing.java" }),
      executeUnifiedMigration(projectId, sampleJavaBillingController, { fileName: "Billing.java" }),
    ]);

    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    // Must share identical migration ID and generated source
    expect(p1.migration_id).toBe(p2.migration_id);
    expect(p1.generated_rust_source).toBe(p2.generated_rust_source);
    // Generation engine must only be called ONCE
    expect(p1.generation_call_count).toBe(1);
  });
});
