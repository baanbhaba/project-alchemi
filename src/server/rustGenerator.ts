export const isJavaSourceCode = (code: string): boolean => {
  if (!code || code.trim().length === 0) return false;
  const javaPattern = /\b(class|interface|enum|record|public|private|protected|import\s+java|package|void|static\s+void\s+main|System\.out|@SpringBootApplication|@RestController|@Service|@Component|@Entity|@Table|@Id|@Column)\b/;
  return javaPattern.test(code);
};

export const generateRustCodeFromJava = (javaCode: string, _stepId?: string): string => {
  if (!javaCode || javaCode.trim().length === 0 || !isJavaSourceCode(javaCode)) {
    return `// ERROR: Invalid input. Please provide valid Java source code for legacy migration.`;
  }

  const classMatch =
    javaCode.match(/(?:public\s+)?(?:class|interface|record)\s+([A-Za-z0-9_]+)/) ||
    javaCode.match(/(?:class|interface|record)\s+([A-Za-z0-9_]+)/);
  const className = classMatch ? classMatch[1] : "MigratedService";
  const slugName = className.toLowerCase();

  // Extract fields matching typed Java variables: e.g. private String orderId; private double total;
  const fieldMatches = [
    ...javaCode.matchAll(
      /(?:(?:private|protected|public)\s+)?(?:final\s+)?(?:static\s+)?\b(int|Integer|long|Long|short|byte|double|Double|float|Float|boolean|Boolean|String|List<[^>]+>|Set<[^>]+>|Map<[^>]+>|Vector<[^>]+>|Hashtable<[^>]+>|[A-Z][A-Za-z0-9_<>]*)\s+([a-z][A-Za-z0-9_]*)\s*(?:=\s*[^;]+)?;?/g
    ),
  ];
  const seenFields = new Set<string>();
  const fields: Array<{ name: string; rustType: string; defaultVal: string }> = [];

  for (const m of fieldMatches) {
    const rawType = m[1];
    const rawName = m[2];
    if (["class", "interface", "record", "return", "new", "throw", "import", "package", "void", "static"].includes(rawType)) continue;
    if (["class", "interface", "record", "void", "static", "return", "new", "throw"].includes(rawName)) continue;
    if (seenFields.has(rawName)) continue;
    seenFields.add(rawName);

    let rustType = "String";
    let defaultVal = 'String::new()';

    if (/^(?:int|Integer|long|Long|short|byte)$/i.test(rawType)) {
      rustType = "i64";
      defaultVal = "0";
    } else if (/^(?:double|Double|float|Float)$/i.test(rawType)) {
      rustType = "f64";
      defaultVal = "0.0";
    } else if (/^(?:boolean|Boolean)$/i.test(rawType)) {
      rustType = "bool";
      defaultVal = "false";
    } else if (/List<([^>]+)>|ArrayList<([^>]+)>|Vector<([^>]+)>/i.test(rawType)) {
      rustType = "Vec<String>";
      defaultVal = "Vec::new()";
    } else if (/Map<([^>]+)>|HashMap<([^>]+)>|Hashtable<([^>]+)>/i.test(rawType)) {
      rustType = "std::collections::HashMap<String, String>";
      defaultVal = "std::collections::HashMap::new()";
    } else if (/Set<([^>]+)>|HashSet<([^>]+)>/i.test(rawType)) {
      rustType = "std::collections::HashSet<String>";
      defaultVal = "std::collections::HashSet::new()";
    } else if (/Date|Calendar|Instant/i.test(rawType)) {
      rustType = "chrono::DateTime<chrono::Utc>";
      defaultVal = "chrono::Utc::now()";
    }

    fields.push({ name: rawName, rustType, defaultVal });
  }

  // Extract methods: e.g. public ResponseEntity processPayment(PaymentRequest req)
  const methodMatches = [
    ...javaCode.matchAll(
      /(?:public|protected|private)?\s*(?:static)?\s*([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g
    ),
  ];
  const methods: Array<{ name: string; rustMethodName: string; returnType: string }> = [];
  const seenMethods = new Set<string>();

  for (const m of methodMatches) {
    const retType = m[1];
    const mName = m[2];
    if (["if", "while", "for", "switch", "catch", "new", className].includes(mName)) continue;
    if (seenMethods.has(mName)) continue;
    seenMethods.add(mName);

    const rustMethodName = mName.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    methods.push({ name: mName, rustMethodName, returnType: retType });
  }

  const rustFields = fields.length > 0
    ? fields.map((f) => `    pub ${f.name}: ${f.rustType},`).join("\n")
    : `    pub id: String,\n    pub name: String,\n    pub is_active: bool,`;

  const rustInitFields = fields.length > 0
    ? fields.map((f) => `            ${f.name}: ${f.defaultVal},`).join("\n")
    : `            id: "svc_${slugName}".to_string(),\n            name: "${className}".to_string(),\n            is_active: true,`;

  const rustMethods = methods
    .filter((m) => m.rustMethodName !== "main")
    .map((m) => {
      let logic = `Ok(())`;
      let retType = `Result<(), Box<dyn std::error::Error + Send + Sync>>`;

      if (/int|Integer|long|Long|double|Float/i.test(m.returnType)) {
        logic = `Ok(1)`;
        retType = `Result<i64, Box<dyn std::error::Error + Send + Sync>>`;
      } else if (/bool|Boolean/i.test(m.returnType)) {
        logic = `Ok(true)`;
        retType = `Result<bool, Box<dyn std::error::Error + Send + Sync>>`;
      } else if (/String/i.test(m.returnType)) {
        logic = `Ok("${m.name}_completed".to_string())`;
        retType = `Result<String, Box<dyn std::error::Error + Send + Sync>>`;
      }

      return `    pub async fn ${m.rustMethodName}(&mut self) -> ${retType} {
        ${logic}
    }`;
    })
    .join("\n\n");

  return `use axum::{
    extract::{Json, State},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${className} {
${rustFields}
}

impl ${className} {
    pub fn new() -> Self {
        Self {
${rustInitFields}
        }
    }

${rustMethods || `    pub async fn execute_task(&mut self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {\n        Ok("${className}_executed".to_string())\n    }`}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${className}Payload {
${rustFields}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${className}Response {
    pub success: bool,
    pub message: String,
    pub data: Option<${className}>,
}

pub struct AppState {
    pub service: RwLock<${className}>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            service: RwLock::new(${className}::new()),
        }
    }
}

pub async fn handle_${slugName}_status(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let service = state.service.read().await;
    Json(service.clone())
}

pub async fn handle_${slugName}_process(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<${className}Payload>,
) -> impl IntoResponse {
    let mut service = state.service.write().await;
${fields.length > 0 ? fields.map((f) => `    service.${f.name} = payload.${f.name};`).join("\n") : `    service.is_active = true;`}
    let response = ${className}Response {
        success: true,
        message: format!("Successfully processed request for ${className}"),
        data: Some(service.clone()),
    };
    Json(response)
}

pub fn create_${slugName}_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/api/v1/${slugName}", get(handle_${slugName}_status).post(handle_${slugName}_process))
        .with_state(state)
}

pub fn create_router(state: Arc<AppState>) -> Router {
    create_${slugName}_router(state)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let state = Arc::new(AppState::new());
    let app = create_router(state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}`;
};
