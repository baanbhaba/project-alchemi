use crate::models::contracts::ImpactAudit;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct DeepSeekRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
}

#[derive(Deserialize)]
struct ChatChoiceMessage {
    content: String,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Deserialize)]
struct DeepSeekResponse {
    choices: Vec<ChatChoice>,
}

pub struct ImpactAnalysisAgent {
    client: Client,
    api_key: String,
    model: String,
}

impl ImpactAnalysisAgent {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model: model.unwrap_or_else(|| "meta/llama-3.2-11b-vision-instruct".to_string()),
        }
    }

    pub async fn analyze(&self, ingestion_manifest: &str) -> Result<ImpactAudit, Box<dyn std::error::Error>> {
        let system_prompt = r#"
You are the Impact Analysis Agent in EMA (Engineering Migration Assistant).
Evaluate the API surface, database schema dialect risks, configuration file risks, third-party dependency version breaks, and blast radius.
Return ONLY valid JSON matching this ImpactAudit schema:
{
  "api_surface": [{ "endpoint_or_interface": "GET /api/v1/users", "consumers": ["Frontend App"], "breaking_change_risk": "low" }],
  "database_impacts": [{ "component": "UserEntity", "risk": "low", "notes": "Map JPA to SQLx" }],
  "config_impacts": [{ "file": "application.properties", "risk": "low", "notes": "Convert to env vars" }],
  "dependency_risks": [{ "library": "Spring Web", "current_version": "2.7.0", "target_version": "Axum 0.7", "known_breaking_changes": ["Annotation to Router"] }],
  "blast_radius": [{ "change": "Rewrite UserController", "affected_files": ["UserController.java"], "severity": "medium" }],
  "confidence": 0.92
}
"#;

        let request_payload = DeepSeekRequest {
            model: self.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: format!("Project Ingestion Manifest:\n{}", ingestion_manifest),
                },
            ],
            temperature: 0.2,
        };

        let endpoint = if self.api_key.starts_with("nvapi-") {
            "https://integrate.api.nvidia.com/v1/chat/completions"
        } else {
            "https://api.deepseek.com/chat/completions"
        };

        if let Ok(response) = self
            .client
            .post(endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_payload)
            .send()
            .await
        {
            if response.status().is_success() {
                if let Ok(res_text) = response.text().await {
                    if let Ok(parsed_res) = serde_json::from_str::<DeepSeekResponse>(&res_text) {
                        if let Some(choice) = parsed_res.choices.first() {
                            let clean_json = choice.message.content.trim()
                                .trim_start_matches("```json")
                                .trim_start_matches("```")
                                .trim_end_matches("```")
                                .trim();
                            if let Ok(audit) = serde_json::from_str::<ImpactAudit>(clean_json) {
                                return Ok(audit);
                            }
                        }
                    }
                }
            }
        }

        // No silent mock fallback — surface the failure so callers can handle it.
        Err("ImpactAnalysisAgent: LLM request failed or returned invalid JSON".into())
    }
}
