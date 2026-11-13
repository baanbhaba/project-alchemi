export const isJavaSourceCode = (code: string): boolean => {
  if (!code || code.trim().length === 0) return false;
  const javaPattern = /\b(class|interface|enum|public|private|protected|import\s+java|package|void|static\s+void\s+main|System\.out|@SpringBootApplication|@RestController|@Service|@Component|@Entity|@Table|@Id|@Column)\b/;
  return javaPattern.test(code);
};

export const generateRustCodeFromJava = (javaCode: string, _stepId?: string): string => {
  if (!javaCode || javaCode.trim().length === 0 || !isJavaSourceCode(javaCode)) {
    return `// ERROR: Invalid input. Please provide valid Java source code for legacy migration.`;
  }

  const classMatch = javaCode.match(/(?:public\s+)?class\s+([A-Za-z0-9_]+)/) || javaCode.match(/class\s+([A-Za-z0-9_]+)/);
  const className = classMatch ? classMatch[1] : "MigratedService";

  // Extract fields from Java class: e.g. private String paymentId; private double amount;
  const fieldMatches = [...javaCode.matchAll(/(?:private|protected|public)\s+([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+);/g)];
  const fields = fieldMatches.map((m) => {
    const type = m[1];
    const name = m[2];
    let rustType = "String";
    if (type.includes("int") || type.includes("Integer")) rustType = "i64";
    else if (type.includes("double") || type.includes("Float")) rustType = "f64";
    else if (type.includes("boolean") || type.includes("Boolean")) rustType = "bool";
    else if (type.includes("List")) rustType = "Vec<String>";
    else if (type.includes("Map")) rustType = "std::collections::HashMap<String, String>";
    return { name, rustType };
  });

  // Extract methods: e.g. public ResponseEntity processPayment(PaymentRequest req)
  const methodMatches = [...javaCode.matchAll(/(?:public|private)\s+([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g)];
  const methods = methodMatches
    .map((m) => {
      const returnType = m[1];
      const methodName = m[2].replace(/([A-Z])/g, "_$1").toLowerCase();
      return { name: methodName, returnType };
    })
    .filter((m) => m.name !== "main" && !m.name.startsWith("_"));

  const isMainApp = javaCode.includes("static void main") || javaCode.includes("public static void main");
  const isRestController = javaCode.includes("@RestController") || javaCode.includes("@RequestMapping") || javaCode.includes("@GetMapping") || javaCode.includes("@PostMapping");

  if (isMainApp) {
    const rustFields = fields.length > 0
      ? fields.map((f) => `    pub ${f.name}: ${f.rustType},`).join("\n")
      : `    pub name: String,`;

    const rustInit = fields.length > 0
      ? fields.map((f) => `            ${f.name}: ${f.rustType === "String" ? 'String::new()' : f.rustType === "bool" ? 'false' : f.rustType.startsWith("Vec") ? 'Vec::new()' : '0'}`).join(",\n")
      : `            name: "${className}".to_string()`;

    const rustMethods = methods.map((m) => {
      return `    pub fn ${m.name}(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("Executed ${m.name} in ${className}");
        Ok(())
    }`;
    }).join("\n\n");

    const execCalls = methods.map((m) => `    app.${m.name}()?;`).join("\n");

    return `#[derive(Debug, Clone)]
pub struct ${className} {
${rustFields}
}

impl ${className} {
    pub fn new() -> Self {
        Self {
${rustInit}
        }
    }

${rustMethods || `    pub fn run(&mut self) -> Result<(), Box<dyn std::error::Error>> {\n        println!("Running ${className} service...");\n        Ok(())\n    }`}
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting ${className} service...");
    let mut app = ${className}::new();
${execCalls || `    app.run()?;`}
    println!("Execution completed successfully.");
    Ok(())
}`;
  }

  if (isRestController) {
    const rustFields = fields.length > 0
      ? fields.map((f) => `    pub ${f.name}: ${f.rustType},`).join("\n")
      : `    pub request_id: String,\n    pub status: String,`;

    return `use axum::{routing::{get, post}, Router, Json, response::IntoResponse};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${className}Payload {
${rustFields}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${className}Response {
    pub success: bool,
    pub message: String,
    pub payload: Option<${className}Payload>,
}

pub async fn handle_${className.toLowerCase()}_process(
    Json(payload): Json<${className}Payload>,
) -> impl IntoResponse {
    let response = ${className}Response {
        success: true,
        message: format!("Successfully executed Axum handler for ${className}"),
        payload: Some(payload),
    };
    Json(response)
}

pub fn create_${className.toLowerCase()}_router() -> Router {
    Router::new()
        .route("/api/v1/${className.toLowerCase()}", post(handle_${className.toLowerCase()}_process))
}`;
  }

  // Model as domain Service or Data Model
  const rustFields = fields.length > 0
    ? fields.map((f) => `    pub ${f.name}: ${f.rustType},`).join("\n")
    : `    pub id: String,\n    pub created_at: String,\n    pub is_active: bool,`;

  const rustMethods = methods.map((m) => {
    return `    pub async fn ${m.name}(&mut self) -> Result<String, String> {
        Ok(format!("Executed ${m.name} successfully in ${className}"))
    }`;
  }).join("\n\n");

  return `use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ${className} {
${rustFields}
}

impl ${className} {
    pub fn new() -> Self {
        Self {
${fields.length > 0 ? fields.map((f) => `            ${f.name}: ${f.rustType === "String" ? 'String::new()' : f.rustType === "bool" ? 'true' : '0'}`).join(",\n") : '            id: "ID_INITIALIZED".to_string(),\n            created_at: "2026-08-11T00:00:00Z".to_string(),\n            is_active: true'}
        }
    }

${rustMethods || `    pub async fn execute_${className.toLowerCase()}_task(&mut self) -> Result<String, String> {\n        Ok(format!("Processing task for ${className}"))\n    }`}
}`;
};
