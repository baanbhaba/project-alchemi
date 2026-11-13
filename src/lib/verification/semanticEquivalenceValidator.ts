import type { VerificationIssue, VerificationResult } from "../../types/contracts";

interface ExtractedMethod {
  name: string;
  signature: string;
  body: string;
  hasCollectionMutation: boolean;
  hasLoop: boolean;
  hasConditionals: boolean;
  hasExceptions: boolean;
  hasReturn: boolean;
  collectionMutationTarget?: string;
}

function extractJavaMethods(javaCode: string): ExtractedMethod[] {
  const methods: ExtractedMethod[] = [];
  // Match method signature and roughly capture body
  const methodRegex = /(?:public|protected|private|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(javaCode)) !== null) {
    const name = match[1];
    if (name === "if" || name === "while" || name === "for" || name === "switch" || name === "catch") {
      continue;
    }

    const startIndex = match.index + match[0].length - 1;
    let depth = 0;
    let endIndex = startIndex;
    for (let i = startIndex; i < javaCode.length; i++) {
      if (javaCode[i] === "{") depth++;
      else if (javaCode[i] === "}") {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    const body = javaCode.slice(startIndex + 1, endIndex);
    const hasCollectionMutation =
      /(\w+)\.(?:add|put|push|set|remove|clear|addAll)\s*\(/i.test(body);
    const collMatch = body.match(/(\w+)\.(?:add|put|push|set|remove|clear|addAll)\s*\(/i);
    const hasLoop = /\b(for\s*\(|while\s*\(|\.forEach\(|\.stream\(\))/i.test(body);
    const hasConditionals = /\b(if\s*\(|switch\s*\(|\?\s*[^:]+:)/i.test(body);
    const hasExceptions = /\b(throw\s+new|throws\b|try\s*\{)/i.test(body);
    const hasReturn = /\breturn\b\s+[^;]+;/.test(body);

    methods.push({
      name,
      signature: match[0].trim(),
      body,
      hasCollectionMutation,
      hasLoop,
      hasConditionals,
      hasExceptions,
      hasReturn,
      collectionMutationTarget: collMatch ? collMatch[1] : undefined,
    });
  }

  return methods;
}

function extractRustFunctions(rustCode: string): ExtractedMethod[] {
  const functions: ExtractedMethod[] = [];
  const fnRegex = /(?:pub\s+)?(?:async\s+)?fn\s+([a-z0-9_]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?:->\s*[^\{]+)?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(rustCode)) !== null) {
    const name = match[1];
    const startIndex = match.index + match[0].length - 1;
    let depth = 0;
    let endIndex = startIndex;
    for (let i = startIndex; i < rustCode.length; i++) {
      if (rustCode[i] === "{") depth++;
      else if (rustCode[i] === "}") {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    const body = rustCode.slice(startIndex + 1, endIndex);
    const hasCollectionMutation = /(\w+)\.(?:push|insert|entry|extend|remove|retain)\s*\(/i.test(body);
    const hasLoop = /\b(for\s+\w+\s+in|while\s+|\.iter\(\)|\.into_iter\(\)|\.map\()/i.test(body);
    const hasConditionals = /\b(if\s+|match\s+)/i.test(body);
    const hasExceptions = /\b(Result<|Err\(|None|\.ok_or\(|\.unwrap_or\()/i.test(body);
    const hasReturn = /\b(return\b|Ok\([^)]+\)|Some\([^)]+\))/.test(body);

    functions.push({
      name,
      signature: match[0].trim(),
      body,
      hasCollectionMutation,
      hasLoop,
      hasConditionals,
      hasExceptions,
      hasReturn,
    });
  }

  return functions;
}

export function validateSemanticEquivalence(
  javaCode: string,
  rustCode: string,
  fileName: string = "src/main.rs"
): VerificationResult {
  const startTime = Date.now();
  const issues: VerificationIssue[] = [];

  const javaMethods = extractJavaMethods(javaCode);
  const rustFunctions = extractRustFunctions(rustCode);

  let methodsPassed = 0;
  let methodsFailed = 0;
  let placeholderCount = 0;

  for (const jm of javaMethods) {
    // Match Java method name to Rust function (e.g., addUser -> add_user, processPayment -> process_payment)
    const normalizedJavaName = jm.name.toLowerCase().replace(/_/g, "");
    const matchingRustFn = rustFunctions.find((rf) => {
      const normalizedRustName = rf.name.toLowerCase().replace(/_/g, "");
      return (
        normalizedRustName === normalizedJavaName ||
        normalizedRustName.includes(normalizedJavaName) ||
        normalizedJavaName.includes(normalizedRustName)
      );
    });

    if (!matchingRustFn) {
      // Check if function was omitted entirely
      issues.push({
        severity: "warning",
        file: fileName,
        category: "omitted_method",
        description: `Java method '${jm.name}' has no matching Rust function equivalent.`,
        recommendation: `Implement Rust equivalent function 'fn ${jm.name.replace(/([A-Z])/g, "_$1").toLowerCase()}'.`,
      });
      methodsFailed++;
      continue;
    }

    // Inspect body for placeholder behavior
    const trimmedRustBody = matchingRustFn.body.trim();
    const isOnlyPrintln =
      /^(?:println!\([^;]+\);\s*)*(?:Ok\(\(\)\)|Ok\(\w+\))?;?$/.test(
        trimmedRustBody.replace(/\/\/.*$/gm, "").trim()
      ) ||
      (trimmedRustBody.includes("println!") &&
        !trimmedRustBody.includes("push") &&
        !trimmedRustBody.includes("insert") &&
        !trimmedRustBody.includes("let ") &&
        !trimmedRustBody.includes("for ") &&
        !trimmedRustBody.includes("match ") &&
        !trimmedRustBody.includes("if "));

    const isUnimplemented =
      trimmedRustBody.includes("unimplemented!()") ||
      trimmedRustBody.includes("todo!()") ||
      trimmedRustBody.includes("panic!(");

    // CRITICAL CHECK: Java has collection mutation, but Rust only has println! or no mutation
    if (jm.hasCollectionMutation && (isOnlyPrintln || isUnimplemented || !matchingRustFn.hasCollectionMutation)) {
      issues.push({
        severity: "critical",
        file: fileName,
        category: "missing_business_logic",
        description: `Original Java method '${jm.name}' modified collection '${jm.collectionMutationTarget || "data"}', but generated Rust only contains a placeholder statement (${isOnlyPrintln ? "println!" : "unimplemented stub"}).`,
        recommendation: `Implement true state mutation using Rust collection APIs (e.g. self.${jm.collectionMutationTarget || "items"}.push(value) or .insert()).`,
      });
      placeholderCount++;
      methodsFailed++;
      continue;
    }

    // Check loops preservation
    if (jm.hasLoop && !matchingRustFn.hasLoop && !trimmedRustBody.includes(".iter()")) {
      issues.push({
        severity: "critical",
        file: fileName,
        category: "missing_loop_logic",
        description: `Java method '${jm.name}' contains loop/iteration logic that was omitted in the Rust implementation.`,
        recommendation: "Translate the iteration into an idiomatic Rust 'for' loop or iterator combinator (.iter().map()).",
      });
      methodsFailed++;
      continue;
    }

    // Check placeholder stub without logic
    if (isOnlyPrintln && (jm.hasConditionals || jm.hasReturn)) {
      issues.push({
        severity: "critical",
        file: fileName,
        category: "placeholder_implementation",
        description: `Method '${jm.name}' logic was replaced with placeholder println! and dummy return.`,
        recommendation: "Translate original algorithm and return computations into Rust.",
      });
      placeholderCount++;
      methodsFailed++;
      continue;
    }

    // Check conditionals
    if (jm.hasConditionals && !matchingRustFn.hasConditionals) {
      issues.push({
        severity: "warning",
        file: fileName,
        category: "missing_conditional_logic",
        description: `Java method '${jm.name}' contains conditional branching ('if' / 'switch') not clearly mirrored in Rust.`,
        recommendation: "Verify that all edge conditions and branching paths are implemented using 'if' or 'match'.",
      });
    }

    methodsPassed++;
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let status: "passed" | "failed" | "warning" = "passed";
  if (criticalCount > 0) {
    status = "failed";
  } else if (warningCount > 0) {
    status = "warning";
  }

  const totalMethods = javaMethods.length || 1;
  const semanticParityScore = Math.max(
    0,
    Math.min(100, Math.round(((totalMethods - methodsFailed) / totalMethods) * 100))
  );

  return {
    agent: "semantic_equivalence",
    status,
    confidence: criticalCount > 0 ? 0.95 : 0.92,
    issues,
    metrics: {
      methods_checked: totalMethods,
      methods_passed: methodsPassed,
      methods_failed: methodsFailed,
      placeholder_methods_detected: placeholderCount,
      semantic_parity_score: semanticParityScore,
    },
    execution_time_ms: Date.now() - startTime,
  };
}
