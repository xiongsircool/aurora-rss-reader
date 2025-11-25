use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use tracing::error;

use crate::models::rsshub_config::{CreateRSSHubConfigRequest, UpdateRSSHubConfigRequest};
use crate::services::rsshub_manager::Service;
use crate::utils::response::{success_response, success_response_with_message};
use crate::AppState;

// List all RSSHub configurations
pub async fn list_configs(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.list_configs().await {
        Ok(configs) => Ok(success_response(configs)),
        Err(e) => {
            error!("Failed to list RSSHub configs: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Get a specific RSSHub configuration
pub async fn get_config(
    Path(id): Path<String>,
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.get_config(&id).await {
        Ok(Some(config)) => Ok(success_response(config)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get RSSHub config {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Create a new RSSHub configuration
pub async fn create_config(
    State(app_state): State<AppState>,
    Json(payload): Json<CreateRSSHubConfigRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.create_config(payload).await {
        Ok(config) => Ok(success_response_with_message(
            config,
            "RSSHub configuration created successfully",
        )),
        Err(e) => {
            error!("Failed to create RSSHub config: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Update an existing RSSHub configuration
pub async fn update_config(
    Path(id): Path<String>,
    State(app_state): State<AppState>,
    Json(payload): Json<UpdateRSSHubConfigRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.update_config(&id, payload).await {
        Ok(Some(config)) => Ok(success_response_with_message(
            config,
            "RSSHub configuration updated successfully",
        )),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to update RSSHub config {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Delete a RSSHub configuration
pub async fn delete_config(
    Path(id): Path<String>,
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.delete_config(&id).await {
        Ok(true) => Ok(success_response_with_message(
            serde_json::json!({"deleted": true}),
            "RSSHub configuration deleted successfully",
        )),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to delete RSSHub config {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Test a specific RSSHub mirror
pub async fn test_rsshub(
    Path(id): Path<String>,
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.test_rsshub(&id).await {
        Ok(Some(config)) => {
            let message = if config.is_active {
                format!(
                    "RSSHub mirror is healthy (response time: {}ms)",
                    config.response_time.unwrap_or(0)
                )
            } else {
                "RSSHub mirror is not responding".to_string()
            };
            Ok(success_response_with_message(config, &message))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to test RSSHub config {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Test all active RSSHub mirrors
pub async fn test_all_mirrors(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.test_all_active_mirrors().await {
        Ok(results) => {
            let message = format!("Tested {} RSSHub mirrors", results.len());
            Ok(success_response_with_message(results, &message))
        }
        Err(e) => {
            error!("Failed to test RSSHub mirrors: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Get the best available RSSHub mirror
pub async fn get_best_mirror(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rsshub_service = Service::new(app_state.db.clone());

    match rsshub_service.get_best_mirror().await {
        Ok(Some(config)) => Ok(success_response(config)),
        Ok(None) => Ok(success_response_with_message(
            serde_json::json!({"message": "No active RSSHub mirrors available"}),
            "No active RSSHub mirrors available",
        )),
        Err(e) => {
            error!("Failed to get best RSSHub mirror: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
