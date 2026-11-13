import type { VerificationIssue, VerificationResult } from "../../types/contracts";

export function validateArchitectureAndFramework(
  javaCode: string,
  rustCode: string,
  fileName: string = "src/main.rs"
): VerificationResult {
  const startTime = Date.now();
  const issues: VerificationIssue[] = [];

  const isJavaRest =
    javaCode.includes("@RestController") ||
    javaCode.includes("@RequestMapping") ||
    javaCode.includes("@GetMapping") ||
    javaCode.includes("@PostMapping") ||
    javaCode.includes("HttpServlet");

  const hasJavaDi =
    javaCode.includes("@Autowired") ||
    javaCode.includes("@Inject") ||
    javaCode.includes("@Resource");

  let routesDetected = 0;
  let handlersDetected = 0;
  let serdeModelsCount = 0;
  let stateInjectionPresent = false;

  // 1. Axum 0.7 Route & Router Validation
  const routeMatches = [...rustCode.matchAll(/\.route\s*\(\s*["']([^"']+)["']\s*,\s*([a-z0-9_:]+)\s*\(/g)];
  routesDetected = routeMatches.length;

  const hasRouter = rustCode.includes("Router::new()") || rustCode.includes("Router<");
  const hasIntoResponse = rustCode.includes("IntoResponse") || rustCode.includes("impl IntoResponse");
  const hasJsonExtractor = rustCode.includes("Json(") || rustCode.includes("Json<");

  // Serde DTO models check
  const structMatches = [...rustCode.matchAll(/(?:#\[derive\([^)]*\)\]\s+)?(?:pub\s+)?struct\s+([A-Za-z0-9_]+)/g)];
  for (const sm of structMatches) {
    const fullSnippet = sm[0];
    if (fullSnippet.includes("Serialize") || fullSnippet.includes("Deserialize")) {
      serdeModelsCount++;
    }
  }

  // AppState & DI replacement check
  stateInjectionPresent =
    rustCode.includes("State(") ||
    rustCode.includes("State<") ||
    rustCode.includes("AppState") ||
    rustCode.includes("Arc<");

  if (isJavaRest) {
    if (!hasRouter) {
      issues.push({
        severity: "critical",
        file: fileName,
        category: "missing_axum_router",
        description: "Source code contains Spring REST endpoints, but the migrated Rust code does not construct an Axum 0.7 Router.",
        recommendation: "Construct an Axum Router using Router::new().route('/endpoint', method(handler)).",
      });
    }

    if (routesDetected === 0 && !rustCode.includes("fn create_")) {
      issues.push({
        severity: "warning",
        file: fileName,
        category: "no_routes_defined",
        description: "No HTTP route mappings (.route(...)) detected in the Axum service.",
        recommendation: "Map each Spring @GetMapping / @PostMapping to an Axum route handler.",
      });
    }

    if (!hasJsonExtractor && structMatches.length > 0) {
      issues.push({
        severity: "warning",
        file: fileName,
        category: "missing_json_extractor",
        description: "No Axum Json(...) extractor found for parsing HTTP request/response payloads.",
        recommendation: "Use axum::Json extractor in your async route handlers.",
      });
    }

    // Check DI replacement
    if (hasJavaDi && !stateInjectionPresent) {
      issues.push({
        severity: "warning",
        file: fileName,
        category: "missing_state_injection",
        description: "Java source used dependency injection (@Autowired/@Inject), but Rust code does not use Axum State/Arc for shared dependencies.",
        recommendation: "Wrap shared service dependencies in an AppState struct and pass via axum::extract::State.",
      });
    }
  }

  // 2. Concurrency and Shared State Thread-Safety
  if (rustCode.includes("static mut ")) {
    issues.push({
      severity: "critical",
      file: fileName,
      category: "unsafe_global_state",
      description: "Detected 'static mut' variable which is inherently thread-unsafe in Rust.",
      recommendation: "Replace 'static mut' with thread-safe std::sync::Arc<tokio::sync::Mutex<T>> or tokio::sync::RwLock.",
    });
  }

  // 3. Blocking calls in async handlers
  if (rustCode.includes("async fn") && (rustCode.includes("std::thread::sleep") || rustCode.includes("thread::sleep"))) {
    issues.push({
      severity: "critical",
      file: fileName,
      category: "blocking_async_call",
      description: "Synchronous thread::sleep used inside async context, which blocks Tokio worker threads.",
      recommendation: "Use tokio::time::sleep instead of std::thread::sleep in async functions.",
    });
  }

  // Count handlers
  const handlerMatches = [...rustCode.matchAll(/(?:pub\s+)?async\s+fn\s+(handle_[a-z0-9_]+|[a-z0-9_]+_handler)\s*\(/g)];
  handlersDetected = handlerMatches.length;

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let status: "passed" | "failed" | "warning" = "passed";
  if (criticalCount > 0) {
    status = "failed";
  } else if (warningCount > 0) {
    status = "warning";
  }

  return {
    agent: "architecture_framework",
    status,
    confidence: 0.94,
    issues,
    metrics: {
      routes_detected: routesDetected,
      handlers_detected: handlersDetected,
      serde_models_count: serdeModelsCount,
      state_injection_present: stateInjectionPresent,
      axum_router_valid: isJavaRest ? hasRouter : true,
      has_into_response: hasIntoResponse,
    },
    execution_time_ms: Date.now() - startTime,
  };
}
