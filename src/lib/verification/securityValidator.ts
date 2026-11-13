import type { VerificationIssue, VerificationResult } from "../../types/contracts";

export function validateSecurity(
  rustCode: string,
  javaCode: string = "",
  fileName: string = "src/main.rs"
): VerificationResult {
  const startTime = Date.now();
  const issues: VerificationIssue[] = [];

  const lines = rustCode.split("\n");

  let unsafeBlocksCount = 0;
  let sqlInjectionRisks = 0;
  let hardcodedSecretsCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 1. Detect Unsafe Rust Blocks
    if (/\bunsafe\s*\{/.test(line) || /\bunsafe\s+fn\b/.test(line)) {
      unsafeBlocksCount++;
      issues.push({
        severity: "critical",
        file: fileName,
        line: lineNum,
        category: "unsafe_rust_block",
        description: "Detected 'unsafe' block or function. Memory safety guarantees are disabled.",
        recommendation: "Refactor using safe Rust abstractions or well-audited standard library types.",
      });
    }

    // 2. Detect SQL Injection Risks (e.g., format!("SELECT ... {}", id))
    if (/format!\s*\(\s*["']\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b[^"']*\{\}/i.test(line)) {
      sqlInjectionRisks++;
      issues.push({
        severity: "critical",
        file: fileName,
        line: lineNum,
        category: "sql_injection_risk",
        description: "Potential SQL injection vulnerability: query string formatted with string interpolation instead of query parameters.",
        recommendation: "Use sqlx parameterized queries with .bind(...) or the sqlx::query! macro.",
      });
    }

    // 3. Detect Hardcoded Secrets / API Keys / Passwords
    const hasSecretPattern =
      /nvapi-[A-Za-z0-9_-]{20,}/.test(line) ||
      /Bearer\s+[A-Za-z0-9_\-\.]{25,}/i.test(line) ||
      /(?:api_key|secret_key|private_key|db_password)\s*=\s*["'][A-Za-z0-9_\-!@#$%^&*]{8,}["']/i.test(line);

    if (hasSecretPattern) {
      hardcodedSecretsCount++;
      issues.push({
        severity: "critical",
        file: fileName,
        line: lineNum,
        category: "hardcoded_secret",
        description: "Hardcoded secret or credential detected directly in source code.",
        recommendation: "Store secrets in environment variables and access via std::env::var().",
      });
    }
  }

  // 4. Java Auth to Rust Auth Parity Check
  const javaHasAuth =
    javaCode.includes("@PreAuthorize") ||
    javaCode.includes("@Secured") ||
    javaCode.includes("@RolesAllowed") ||
    javaCode.includes("SecurityContextHolder");

  const rustHasAuth =
    rustCode.includes("Auth") ||
    rustCode.includes("auth") ||
    rustCode.includes("jwt") ||
    rustCode.includes("token") ||
    rustCode.includes("Authorization");

  if (javaHasAuth && !rustHasAuth) {
    issues.push({
      severity: "warning",
      file: fileName,
      category: "missing_authorization_check",
      description: "Java application enforces role-based authorization (@PreAuthorize/@Secured), but Rust route handlers have no authentication extractor or middleware.",
      recommendation: "Implement Axum middleware or an AuthClaims extractor to protect restricted endpoints.",
    });
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let status: "passed" | "failed" | "warning" = "passed";
  if (criticalCount > 0) {
    status = "failed";
  } else if (warningCount > 0) {
    status = "warning";
  }

  const securityScore = Math.max(
    0,
    Math.min(100, 100 - criticalCount * 30 - warningCount * 10)
  );

  return {
    agent: "security",
    status,
    confidence: 0.95,
    issues,
    metrics: {
      unsafe_blocks_count: unsafeBlocksCount,
      sql_injection_risks: sqlInjectionRisks,
      hardcoded_secrets_count: hardcodedSecretsCount,
      security_score: securityScore,
    },
    execution_time_ms: Date.now() - startTime,
  };
}
