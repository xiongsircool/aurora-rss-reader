use axum::{
    extract::{Json, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tracing::error;

use crate::models::user_settings::{UpdateUserSettingsRequest, UserSettingsResponse};
use crate::services::user_settings_service::Service;
use crate::utils::response::{success_response, success_response_with_message};
use crate::AppState;

pub async fn get_settings(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let settings_service = Service::new(app_state.db.clone());

    match settings_service.get_settings().await {
        Ok(settings) => {
            let response = UserSettingsResponse::from(settings);
            Ok(success_response(response))
        }
        Err(e) => {
            error!("Failed to get user settings: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
pub struct RSSHubUrlPayload {
    pub rsshub_url: String,
}

#[derive(Serialize)]
pub struct RSSHubTestResult {
    pub success: bool,
    pub message: String,
    pub rsshub_url: String,
    pub test_url: String,
    pub tested_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entries_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feed_title: Option<String>,
}

pub async fn get_rsshub_url(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let settings_service = Service::new(app_state.db.clone());

    match settings_service.get_settings().await {
        Ok(settings) => Ok(success_response(serde_json::json!({
            "rsshub_url": settings.rsshub_url
        }))),
        Err(e) => {
            error!("Failed to get RSSHub URL: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_rsshub_url(
    State(app_state): State<AppState>,
    Json(payload): Json<RSSHubUrlPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let settings_service = Service::new(app_state.db.clone());

    let mut update_req = UpdateUserSettingsRequest::default();
    update_req.rsshub_url = Some(payload.rsshub_url.clone());

    match settings_service.update_settings(update_req).await {
        Ok(_) => Ok(success_response(serde_json::json!({
            "rsshub_url": payload.rsshub_url
        }))),
        Err(e) => {
            error!("Failed to update RSSHub URL: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn test_rsshub_quick(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let settings_service = Service::new(app_state.db.clone());
    let settings = settings_service.get_settings().await.map_err(|e| {
        error!("Failed to load settings for RSSHub test: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let rsshub_url = settings.rsshub_url.trim_end_matches('/').to_string();
    let health_url = format!("{}/api/health", rsshub_url);
    let root_url = rsshub_url.clone();
    let tested_at = chrono::Utc::now().to_rfc3339();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| {
            error!("Failed to build HTTP client: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let start = Instant::now();
    // First try /api/health
    let mut response = client.get(&health_url).send().await;
    let mut test_url = health_url;

    // If health check fails (e.g. 404 or 503), try root URL
    let should_retry = match &response {
        Ok(res) => !res.status().is_success(),
        Err(_) => true,
    };

    if should_retry {
        test_url = root_url;
        response = client.get(&test_url).send().await;
    }

    let elapsed = start.elapsed().as_secs_f64();

    let (success, message) = match response {
        Ok(res) if res.status().is_success() => (true, "RSSHub connection ok".to_string()),
        Ok(res) => (
            false,
            format!("RSSHub returned status {}", res.status().as_u16()),
        ),
        Err(err) => (false, format!("Request failed: {}", err)),
    };

    Ok(success_response(RSSHubTestResult {
        success,
        message,
        rsshub_url,
        test_url,
        tested_at,
        response_time: Some(elapsed),
        entries_count: Some(0),
        feed_title: Some("Connectivity Check".to_string()),
    }))
}

pub async fn update_settings(
    State(app_state): State<AppState>,
    Json(payload): Json<UpdateUserSettingsRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let settings_service = Service::new(app_state.db.clone());

    match settings_service.update_settings(payload).await {
        Ok(settings) => {
            let response = UserSettingsResponse::from(settings);
            Ok(success_response_with_message(
                response,
                "Settings updated successfully",
            ))
        }
        Err(e) => {
            error!("Failed to update user settings: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
