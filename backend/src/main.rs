mod agents;
mod db;
mod models;

use agents::core_analysis::CoreAnalysisAgent;
use agents::impact_analysis::ImpactAnalysisAgent;
use axum::{
    extract::{Json, State},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use db::repository;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

/// Shared application state injected into every handler via Axum's State extractor.
#[derive(Clone)]
struct AppState {
    db: PgPool,
}

#[derive(Deserialize)]
struct AnalyzeRequest {
    project_id: Option<String>,
    ingestion_manifest: Option<String>,
    code: Option<String>,
    deepseek_api_key: Option<String>,
    model: Option<String>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    version: String,
    db: String,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    // ── Database ──────────────────────────────────────────────────────────────
    let pool = db::create_pool().await;
    tracing::info!("✅ Connected to Postgres database");

    let state = AppState { db: pool };

    // ── CORS ──────────────────────────────────────────────────────────────────
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // ── Router ────────────────────────────────────────────────────────────────
    let app = Router::new()
        .route("/api/v1/health", get(health_check))
        .route("/api/v1/analyze/core", post(run_core_analysis))
        .route("/api/v1/analyze/impact", post(run_impact_analysis))
        .layer(cors)
        .with_state(state);

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("PORT must be a number");

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🚀 ALCHEMI Rust Backend running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_status = match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
    {
        Ok(_) => "connected",
        Err(_) => "unreachable",
    };

    Json(HealthResponse {
        status: "ok".to_string(),
        service: "ALCHEMI Rust Orchestration Engine".to_string(),
        version: "1.0.0".to_string(),
        db: db_status.to_string(),
    })
}

async fn run_core_analysis(
    State(state): State<AppState>,
    Json(payload): Json<AnalyzeRequest>,
) -> Result<Json<models::contracts::CoreAudit>, (StatusCode, String)> {
    let api_key = payload
        .deepseek_api_key
        .or_else(|| env::var("NVIDIA_API_KEY").ok())
        .or_else(|| env::var("DEEPSEEK_API_KEY").ok())
        .unwrap_or_else(|| "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".to_string());

    let agent = CoreAnalysisAgent::new(api_key, payload.model);

    let manifest = payload
        .code
        .clone()
        .or(payload.ingestion_manifest.clone())
        .unwrap_or_default();

    let audit = agent
        .analyze(&manifest)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    // ── Persist to DB if project_id provided ──────────────────────────────────
    if let Some(ref project_id) = payload.project_id {
        if let Err(e) = repository::upsert_core_audit(&state.db, project_id, &audit).await {
            tracing::warn!("Failed to persist CoreAudit for project {}: {}", project_id, e);
        } else {
            tracing::info!("CoreAudit persisted for project {}", project_id);
            if let Err(e) = repository::update_project_stage(&state.db, project_id, "readiness").await {
                tracing::warn!("Failed to update project stage: {}", e);
            }
        }
    }

    Ok(Json(audit))
}

async fn run_impact_analysis(
    State(state): State<AppState>,
    Json(payload): Json<AnalyzeRequest>,
) -> Result<Json<models::contracts::ImpactAudit>, (StatusCode, String)> {
    let api_key = payload
        .deepseek_api_key
        .or_else(|| env::var("NVIDIA_API_KEY").ok())
        .or_else(|| env::var("DEEPSEEK_API_KEY").ok())
        .unwrap_or_else(|| "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".to_string());

    let agent = ImpactAnalysisAgent::new(api_key, payload.model);

    let manifest = payload
        .code
        .clone()
        .or(payload.ingestion_manifest.clone())
        .unwrap_or_default();

    let audit = agent
        .analyze(&manifest)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    // ── Persist to DB if project_id provided ──────────────────────────────────
    if let Some(ref project_id) = payload.project_id {
        if let Err(e) = repository::upsert_impact_audit(&state.db, project_id, &audit).await {
            tracing::warn!("Failed to persist ImpactAudit for project {}: {}", project_id, e);
        } else {
            tracing::info!("ImpactAudit persisted for project {}", project_id);
        }
    }

    Ok(Json(audit))
}
