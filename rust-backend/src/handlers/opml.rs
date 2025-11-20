use axum::{
    extract::{Json, State},
    http::{header, StatusCode},
    response::Response,
    body::Body,
};
use tracing::error;

use crate::AppState;
use crate::services::opml_service::OPMLService;
use crate::utils::response::success_response_with_message;

pub async fn import_opml(
    State(app_state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let opml_service = OPMLService::new(app_state.db.clone());

    // Extract OPML content from payload
    let opml_content = match payload.get("opml_content") {
        Some(content) => content.as_str().unwrap_or(""),
        None => {
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    if opml_content.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    match opml_service.import_opml(opml_content).await {
        Ok(imported_feeds) => {
            let message = if imported_feeds.is_empty() {
                "No new feeds were imported"
            } else {
                &format!("Successfully imported {} feeds", imported_feeds.len())
            };
            Ok(success_response_with_message(
                serde_json::json!({
                    "imported_feeds": imported_feeds,
                    "total_count": imported_feeds.len()
                }),
                message,
            ))
        }
        Err(e) => {
            error!("Failed to import OPML: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn export_opml(
    State(app_state): State<AppState>,
) -> Result<Response, StatusCode> {
    let opml_service = OPMLService::new(app_state.db.clone());

    match opml_service.export_opml().await {
        Ok(opml_content) => {
            let response = Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
                .header(header::CONTENT_DISPOSITION, "attachment; filename=\"feeds.opml\"")
                .body(Body::from(opml_content))
                .unwrap();
            Ok(response)
        }
        Err(e) => {
            error!("Failed to export OPML: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
