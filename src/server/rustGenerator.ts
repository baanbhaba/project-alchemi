export const isJavaSourceCode = (code: string): boolean => {
  if (!code || code.trim().length === 0) return false;
  const javaPattern = /\b(class|interface|enum|record|public|private|protected|import\s+java|package|void|static\s+void\s+main|System\.out|@SpringBootApplication|@RestController|@Service|@Component|@Entity|@Table|@Id|@Column)\b/;
  return javaPattern.test(code);
};

export function mapJavaTypeToRust(rawType: string): string {
  if (!rawType) return "String";
  const t = rawType.trim();
  if (/^(?:int|Integer|long|Long|short|byte)$/i.test(t)) return "i64";
  if (/^(?:double|Double|float|Float)$/i.test(t)) return "f64";
  if (/^(?:boolean|Boolean)$/i.test(t)) return "bool";
  if (/^(?:String|CharSequence)$/i.test(t)) return "String";
  if (/^(?:Date|Calendar|Instant|Timestamp)$/i.test(t)) return "chrono::DateTime<chrono::Utc>";

  const listMatch = t.match(/^(?:List|ArrayList|Vector|Stack|Set|HashSet)<([^>]+)>$/i);
  if (listMatch) {
    const inner = mapJavaTypeToRust(listMatch[1]);
    return `Vec<${inner}>`;
  }

  const mapMatch = t.match(/^(?:Map|HashMap|Hashtable)<([^,>]+),\s*([^>]+)>$/i);
  if (mapMatch) {
    const k = mapJavaTypeToRust(mapMatch[1]);
    const v = mapJavaTypeToRust(mapMatch[2]);
    return `std::collections::HashMap<${k}, ${v}>`;
  }

  return t;
}

function getDefaultValueForRustType(rustType: string, fieldName: string = ""): string {
  if (rustType === "i64") return "0";
  if (rustType === "f64") return "0.0";
  if (rustType === "bool") return fieldName.toLowerCase().includes("active") ? "true" : "false";
  if (rustType.startsWith("Vec<")) return "Vec::new()";
  if (rustType.startsWith("std::collections::HashMap<")) return "std::collections::HashMap::new()";
  if (rustType.startsWith("std::collections::HashSet<")) return "std::collections::HashSet::new()";
  if (rustType.includes("DateTime")) return "chrono::Utc::now()";
  return 'String::new()';
}

interface ParsedField {
  name: string;
  rustType: string;
  defaultVal: string;
}

function parseFieldsFromClassSnippet(classBody: string): ParsedField[] {
  const fieldMatches = [
    ...classBody.matchAll(
      /(?:(?:private|protected|public)\s+)?(?:final\s+)?(?:static\s+)?\b(int|Integer|long|Long|short|byte|double|Double|float|Float|boolean|Boolean|String|List<[^>]+>|Set<[^>]+>|Map<[^,>]+,\s*[^>]+>|Vector<[^>]+>|Hashtable<[^,>]+,\s*[^>]+>|Stack<[^>]+>|Date|Calendar|[A-Z][A-Za-z0-9_<>]*)\s+([a-z][A-Za-z0-9_]*)\s*(?:=\s*[^;]+)?;?/g
    ),
  ];
  const seenFields = new Set<string>();
  const fields: ParsedField[] = [];

  for (const m of fieldMatches) {
    const rawType = m[1];
    const rawName = m[2];
    if (["class", "interface", "record", "return", "new", "throw", "import", "package", "void", "static"].includes(rawType)) continue;
    if (["class", "interface", "record", "void", "static", "return", "new", "throw", "system"].includes(rawName)) continue;
    if (seenFields.has(rawName)) continue;
    seenFields.add(rawName);

    const rustType = mapJavaTypeToRust(rawType);
    const defaultVal = getDefaultValueForRustType(rustType, rawName);
    fields.push({ name: rawName, rustType, defaultVal });
  }

  return fields;
}

export const generateRustCodeFromJava = (javaCode: string, _stepId?: string): string => {
  if (!javaCode || javaCode.trim().length === 0 || !isJavaSourceCode(javaCode)) {
    return `// ERROR: Invalid input. Please provide valid Java source code for legacy migration.`;
  }

  // Check all classes declared in the Java code
  const classRegex = /(?:public\s+)?(?:class|interface|record)\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}(?=\s*(?:(?:public\s+)?(?:class|interface|record)|\s*$))/g;
  const classMatches = [...javaCode.matchAll(classRegex)];

  let primaryClass = "MigratedService";
  if (classMatches.length > 0) {
    const publicMatch = classMatches.find(m => m[0].startsWith("public "));
    primaryClass = publicMatch ? publicMatch[1] : classMatches[0][1];
  } else {
    const fallbackMatch = javaCode.match(/(?:public\s+)?(?:class|interface|record)\s+([A-Za-z0-9_]+)/);
    if (fallbackMatch) primaryClass = fallbackMatch[1];
  }

  const slugName = primaryClass.toLowerCase();

  // Parse auxiliary classes (e.g. Product, Customer, Order)
  const auxiliaryStructs: string[] = [];
  for (const match of classMatches) {
    const cName = match[1];
    if (cName === primaryClass) continue;
    const body = match[2];
    const auxFields = parseFieldsFromClassSnippet(body);

    const fieldsStr = auxFields.length > 0
      ? auxFields.map((f) => `    pub ${f.name}: ${f.rustType},`).join("\n")
      : `    pub id: i64,\n    pub name: String,`;

    const ctorParams = auxFields.length > 0
      ? auxFields.map((f) => `${f.name}: ${f.rustType === "String" ? "impl Into<String>" : f.rustType}`).join(", ")
      : `id: i64, name: impl Into<String>`;

    const ctorFields = auxFields.length > 0
      ? auxFields.map((f) => `            ${f.name}: ${f.rustType === "String" ? `${f.name}.into()` : f.name},`).join("\n")
      : `            id,\n            name: name.into(),`;

    auxiliaryStructs.push(`#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${cName} {
${fieldsStr}
}

impl ${cName} {
    pub fn new(${ctorParams}) -> Self {
        Self {
${ctorFields}
        }
    }
}`);
  }

  // Parse primary class fields
  const primaryMatch = classMatches.find(m => m[1] === primaryClass);
  const primaryBody = primaryMatch ? primaryMatch[2] : javaCode;
  const fields = parseFieldsFromClassSnippet(primaryBody);

  // Extract methods from primary class
  const methodMatches = [
    ...primaryBody.matchAll(
      /(?:public|protected|private)?\s*(?:static)?\s*([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g
    ),
  ];
  const methods: Array<{ name: string; rustMethodName: string; returnType: string }> = [];
  const seenMethods = new Set<string>();

  for (const m of methodMatches) {
    const retType = m[1];
    const mName = m[2];
    if (["if", "while", "for", "switch", "catch", "new", primaryClass].includes(mName)) continue;
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
    : `            id: "svc_${slugName}".to_string(),\n            name: "${primaryClass}".to_string(),\n            is_active: true,`;

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

  const auxBlock = auxiliaryStructs.length > 0 ? auxiliaryStructs.join("\n\n") + "\n\n" : "";

  return `use axum::{
    extract::{Json, State},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

${auxBlock}#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${primaryClass} {
${rustFields}
}

impl ${primaryClass} {
    pub fn new() -> Self {
        Self {
${rustInitFields}
        }
    }

${rustMethods || `    pub async fn execute_task(&mut self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {\n        Ok("${primaryClass}_executed".to_string())\n    }`}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${primaryClass}Payload {
${rustFields}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${primaryClass}Response {
    pub success: bool,
    pub message: String,
    pub data: Option<${primaryClass}>,
}

pub struct AppState {
    pub service: RwLock<${primaryClass}>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            service: RwLock::new(${primaryClass}::new()),
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
    Json(payload): Json<${primaryClass}Payload>,
) -> impl IntoResponse {
    let mut service = state.service.write().await;
${fields.length > 0 ? fields.map((f) => `    service.${f.name} = payload.${f.name};`).join("\n") : `    service.is_active = true;`}
    let response = ${primaryClass}Response {
        success: true,
        message: format!("Successfully processed request for ${primaryClass}"),
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
