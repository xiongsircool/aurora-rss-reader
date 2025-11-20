use axum::{
    extract::{Json, State},
    http::StatusCode,
};
use tracing::error;

use crate::AppState;
use crate::models::user_settings::{UpdateUserSettingsRequest, UserSettingsResponse};
use crate::services::user_settings_service::Service;
use crate::utils::response::{success_response, success_response_with_message};

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

pub async fn update_settings(
    State(app_state): State<AppState>,
    Json(payload): Json<UpdateUserSettingsRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let settings_service = Service::new(app_state.db.clone());

    match settings_service.update_settings(payload).await {
        Ok(settings) => {
            let response = UserSettingsResponse::from(settings);
            Ok(success_response_with_message(response, "Settings updated successfully"))
        }
        Err(e) => {
            error!("Failed to update user settings: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
