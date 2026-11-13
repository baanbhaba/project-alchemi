import type { VerificationIssue, VerificationResult } from "../../types/contracts";

export function validateMigrationCompleteness(
  javaCode: string,
  rustCode: string,
  fileName: string = "src/main.rs"
): VerificationResult {
  const startTime = Date.now();
  const issues: VerificationIssue[] = [];

  // Extract Java Classes and Interfaces
  const javaClassMatches = [...javaCode.matchAll(/(?:public\s+)?(?:class|interface|record|enum)\s+([A-Za-z0-9_]+)/g)];
  const javaClasses = javaClassMatches.map((m) => m[1]);

  // Extract Java Methods
  const javaMethodMatches = [
    ...javaCode.matchAll(/(?:public|protected|private|static|\s)+[\w<>\[\]]+\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g),
  ];
  const javaMethods = javaMethodMatches
    .map((m) => m[1])
    .filter((name) => !["if", "while", "for", "switch", "catch"].includes(name));

  // Extract Rust Structs / Enums
  const rustStructMatches = [...rustCode.matchAll(/(?:pub\s+)?(?:struct|enum)\s+([A-Za-z0-9_]+)/g)];
  const rustStructs = rustStructMatches.map((m) => m[1]);

  // Extract Rust Functions
  const rustFnMatches = [...rustCode.matchAll(/(?:pub\s+)?(?:async\s+)?fn\s+([a-z0-9_]+)\s*\(/g)];
  const rustFunctions = rustFnMatches.map((m) => m[1]);

  // Check for unimplemented!() and todo!() macros in Rust
  const lines = rustCode.split("\n");
  let unimplementedCount = 0;
  let todoCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    if (/\bunimplemented!\s*\(/.test(line)) {
      unimplementedCount++;
      issues.push({
        severity: "critical",
        file: fileName,
        line: lineNum,
        category: "unimplemented_macro",
        description: "Found 'unimplemented!()' macro stub in generated Rust code.",
        recommendation: "Provide complete production implementation instead of a panic stub.",
      });
    }
    if (/\btodo!\s*\(/.test(line)) {
      todoCount++;
      issues.push({
        severity: "critical",
        file: fileName,
        line: lineNum,
        category: "todo_macro",
        description: "Found 'todo!()' macro stub in generated Rust code.",
        recommendation: "Implement the required business logic before deployment.",
      });
    }
  }

  // Calculate Class Parity
  let classesMigrated = 0;
  for (const jc of javaClasses) {
    const found = rustStructs.some(
      (rs) =>
        rs.toLowerCase() === jc.toLowerCase() ||
        rs.toLowerCase().includes(jc.toLowerCase()) ||
        jc.toLowerCase().includes(rs.toLowerCase())
    );
    if (found) {
      classesMigrated++;
    } else {
      issues.push({
        severity: "warning",
        file: fileName,
        category: "missing_class",
        description: `Java class '${jc}' was not mapped to a corresponding Rust struct or enum.`,
        recommendation: `Define 'pub struct ${jc}' with equivalent fields.`,
      });
    }
  }

  // Calculate Method Parity
  let methodsMigrated = 0;
  for (const jm of javaMethods) {
    const normJm = jm.toLowerCase().replace(/_/g, "");
    const found = rustFunctions.some((rf) => {
      const normRf = rf.toLowerCase().replace(/_/g, "");
      return normRf === normJm || normRf.includes(normJm) || normJm.includes(normRf);
    });
    if (found) {
      methodsMigrated++;
    } else {
      issues.push({
        severity: "warning",
        file: fileName,
        category: "missing_method",
        description: `Java method '${jm}' has no matching Rust function implementation.`,
        recommendation: `Implement Rust function 'pub fn ${jm.replace(/([A-Z])/g, "_$1").toLowerCase()}'.`,
      });
    }
  }

  const totalElements = (javaClasses.length || 1) + (javaMethods.length || 1);
  const totalMigrated = classesMigrated + methodsMigrated;
  const rawCompleteness = Math.min(100, Math.round((totalMigrated / totalElements) * 100));

  // Deduct penalty for unimplemented!() and todo!() stubs
  const completenessPercentage = Math.max(
    0,
    rawCompleteness - unimplementedCount * 20 - todoCount * 15
  );

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let status: "passed" | "failed" | "warning" = "passed";
  if (criticalCount > 0 || completenessPercentage < 50) {
    status = "failed";
  } else if (warningCount > 0 || completenessPercentage < 85) {
    status = "warning";
  }

  return {
    agent: "migration_completeness",
    status,
    confidence: 0.95,
    issues,
    metrics: {
      classes_total: javaClasses.length,
      classes_migrated: classesMigrated,
      methods_total: javaMethods.length,
      methods_migrated: methodsMigrated,
      unimplemented_count: unimplementedCount,
      todo_count: todoCount,
      completeness_percentage: completenessPercentage,
    },
    execution_time_ms: Date.now() - startTime,
  };
}
