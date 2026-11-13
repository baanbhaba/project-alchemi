import type { VerificationIssue, VerificationResult } from "../../types/contracts";

export interface SyntaxValidationOptions {
  cargoToml?: string;
  relatedFiles?: Record<string, string>;
  fileName?: string;
}

export function validateRustSyntaxAndCompilation(
  rustCode: string,
  options: SyntaxValidationOptions = {}
): VerificationResult {
  const startTime = Date.now();
  const fileName = options.fileName || "src/main.rs";
  const issues: VerificationIssue[] = [];

  if (!rustCode || rustCode.trim().length === 0) {
    return {
      agent: "syntax_compilation",
      status: "failed",
      confidence: 1.0,
      issues: [
        {
          severity: "critical",
          file: fileName,
          category: "empty_source",
          description: "Generated Rust code artifact is empty.",
          recommendation: "Ensure the migration engine generated non-empty Rust code.",
        },
      ],
      metrics: {
        syntax_errors: 1,
        compilable: false,
        balanced_delimiters: false,
        lines_count: 0,
      },
      execution_time_ms: Date.now() - startTime,
    };
  }

  const lines = rustCode.split("\n");

  // 1. Check for Balanced Delimiters
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let inChar = false;
  let inBlockComment = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const ch = line[charIdx];
      const nextCh = charIdx + 1 < line.length ? line[charIdx + 1] : "";
      const prevCh = charIdx > 0 ? line[charIdx - 1] : "";

      if (inBlockComment) {
        if (ch === "*" && nextCh === "/") {
          inBlockComment = false;
          charIdx++;
        }
        continue;
      }

      if (inString) {
        if (ch === '"' && prevCh !== "\\") {
          inString = false;
        }
        continue;
      }

      if (inChar) {
        if (ch === "'" && prevCh !== "\\") {
          inChar = false;
        }
        continue;
      }

      if (ch === "/" && nextCh === "/") {
        break; // rest of line is comment
      }

      if (ch === "/" && nextCh === "*") {
        inBlockComment = true;
        charIdx++;
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "'" && nextCh !== "" && charIdx + 2 < line.length && line[charIdx + 2] === "'") {
        inChar = true;
        continue;
      }

      if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth--;
      else if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth--;
      else if (ch === "[") bracketDepth++;
      else if (ch === "]") bracketDepth--;

      if (braceDepth < 0) {
        issues.push({
          severity: "critical",
          file: fileName,
          line: lineIdx + 1,
          category: "syntax_delimiter_mismatch",
          description: "Unexpected closing brace '}' without matching opening brace.",
          recommendation: "Ensure all block scopes are properly opened and closed.",
        });
        braceDepth = 0;
      }
      if (parenDepth < 0) {
        issues.push({
          severity: "critical",
          file: fileName,
          line: lineIdx + 1,
          category: "syntax_delimiter_mismatch",
          description: "Unexpected closing parenthesis ')' without matching opening parenthesis.",
          recommendation: "Balance parentheses in function signatures and expressions.",
        });
        parenDepth = 0;
      }
      if (bracketDepth < 0) {
        issues.push({
          severity: "critical",
          file: fileName,
          line: lineIdx + 1,
          category: "syntax_delimiter_mismatch",
          description: "Unexpected closing bracket ']' without matching opening bracket.",
          recommendation: "Balance brackets in array indexing or attribute macros.",
        });
        bracketDepth = 0;
      }
    }
  }

  if (braceDepth > 0) {
    issues.push({
      severity: "critical",
      file: fileName,
      line: lines.length,
      category: "unclosed_brace",
      description: `Unclosed curly brace: ${braceDepth} open brace(s) remaining at EOF.`,
      recommendation: "Close all unclosed struct, impl, or function scopes.",
    });
  }
  if (parenDepth > 0) {
    issues.push({
      severity: "critical",
      file: fileName,
      line: lines.length,
      category: "unclosed_parenthesis",
      description: `Unclosed parenthesis: ${parenDepth} open parenthesis(es) remaining at EOF.`,
      recommendation: "Close all open function parameters or expression tuples.",
    });
  }

  // 2. Detect Leftover Java Constructs
  const javaKeywordsRegex = [
    { regex: /\bpublic\s+class\s+([A-Za-z0-9_]+)/g, cat: "leftover_java_class", msg: "Found Java 'public class' declaration instead of Rust 'pub struct'." },
    { regex: /\bvoid\s+([A-Za-z0-9_]+)\s*\(/g, cat: "leftover_java_void", msg: "Found Java 'void' return type instead of Rust unit type '()'." },
    { regex: /System\.(?:out|err)\.print/g, cat: "leftover_java_system_out", msg: "Found Java 'System.out.println' call instead of Rust 'println!'." },
    { regex: /\bextends\s+([A-Za-z0-9_]+)/g, cat: "leftover_java_inheritance", msg: "Found Java 'extends' keyword. Rust does not have class inheritance." },
    { regex: /\bimplements\s+([A-Za-z0-9_]+)/g, cat: "leftover_java_implements", msg: "Found Java 'implements' keyword. In Rust, use 'impl Trait for Struct'." },
    { regex: /@(?:Override|Autowired|RestController|GetMapping|PostMapping|Service|Component)\b/g, cat: "leftover_java_annotation", msg: "Found unconverted Java annotation." },
    { regex: /\bnew\s+([A-Za-z0-9_]+)\s*\(/g, cat: "leftover_java_new_operator", msg: "Found Java 'new' keyword. In Rust, use 'Type::new()' or struct initialization." },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of javaKeywordsRegex) {
      if (rule.regex.test(line)) {
        issues.push({
          severity: "critical",
          file: fileName,
          line: i + 1,
          category: rule.cat,
          description: rule.msg,
          recommendation: "Ensure the migration engine converts all Java constructs into native Rust equivalents.",
        });
      }
      rule.regex.lastIndex = 0;
    }
  }

  // 3. Check for Required Imports (Unresolved symbols)
  const hasUseAxum = rustCode.includes("use axum::") || rustCode.includes("axum::");
  const usesAxumSymbols = rustCode.includes("Router") || rustCode.includes("IntoResponse") || rustCode.includes("Json(");
  if (usesAxumSymbols && !hasUseAxum) {
    issues.push({
      severity: "warning",
      file: fileName,
      category: "unresolved_import",
      description: "Axum types (e.g. Router, Json) are referenced without 'use axum::...'.",
      recommendation: "Add 'use axum::{Router, Json, response::IntoResponse};' to the top of the file.",
    });
  }

  const hasUseSerde = rustCode.includes("use serde::") || rustCode.includes("serde::");
  const usesSerdeSymbols = rustCode.includes("Serialize") || rustCode.includes("Deserialize");
  if (usesSerdeSymbols && !hasUseSerde) {
    issues.push({
      severity: "warning",
      file: fileName,
      category: "unresolved_import",
      description: "Serde traits (Serialize/Deserialize) referenced without 'use serde::{Serialize, Deserialize};'.",
      recommendation: "Add 'use serde::{Serialize, Deserialize};' to imports.",
    });
  }

  const hasUseHashMap = rustCode.includes("use std::collections::HashMap") || rustCode.includes("std::collections::HashMap");
  const usesHashMap = /\bHashMap<[A-Za-z0-9_,\s<>]+>/.test(rustCode);
  if (usesHashMap && !hasUseHashMap) {
    issues.push({
      severity: "warning",
      file: fileName,
      category: "unresolved_import",
      description: "HashMap referenced without importing std::collections::HashMap.",
      recommendation: "Add 'use std::collections::HashMap;' or use fully qualified path.",
    });
  }

  // 4. Structural validity check
  const hasStructOrFn = rustCode.includes("struct ") || rustCode.includes("fn ") || rustCode.includes("enum ");
  if (!hasStructOrFn) {
    issues.push({
      severity: "critical",
      file: fileName,
      category: "missing_rust_declarations",
      description: "Rust artifact does not contain any struct, fn, or enum declarations.",
      recommendation: "Generate valid Rust declarations representing the source Java entities.",
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

  const confidence = criticalCount > 0 ? 0.95 : warningCount > 0 ? 0.9 : 0.98;

  return {
    agent: "syntax_compilation",
    status,
    confidence,
    issues,
    metrics: {
      lines_count: lines.length,
      syntax_errors: criticalCount,
      warnings_count: warningCount,
      compilable: criticalCount === 0,
      balanced_delimiters: braceDepth === 0 && parenDepth === 0 && bracketDepth === 0,
    },
    execution_time_ms: Date.now() - startTime,
  };
}
