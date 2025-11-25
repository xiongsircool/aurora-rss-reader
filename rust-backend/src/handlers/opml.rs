use axum::{
    body::Body,
    extract::{Multipart, State},
    http::{header, StatusCode},
    response::{Json, Response},
};
use tracing::error;

use crate::services::opml_service::OPMLService;
use crate::utils::response::success_response_with_message;
use crate::AppState;

pub async fn import_opml(
    State(app_state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let opml_service = OPMLService::new(app_state.db.clone());

    // Extract OPML content from multipart form-data
    // Frontend sends the file under the "file" field.
    let mut opml_content: Option<String> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let name = field.name().unwrap_or("");
        if matches!(name, "file" | "opml_file" | "opml" | "opml_content") {
            let text = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?;
            if !text.trim().is_empty() {
                opml_content = Some(text);
                break;
            }
        }
    }

    let opml_content = match opml_content {
        Some(content) if !content.trim().is_empty() => content,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    match opml_service.import_opml(&opml_content).await {
        Ok(imported_feeds) => {
            // For frontend compatibility, return a simple summary:
            // - imported: number of newly created feeds
            // - skipped: number of feeds skipped (currently unknown, default 0)
            // - errors: any error messages (currently empty)
            let imported_count = imported_feeds.len();
            let skipped_count = 0usize;
            let errors: Vec<String> = Vec::new();

            let message = if imported_count == 0 {
                "No new feeds were imported"
            } else {
                "Successfully imported feeds from OPML"
            };

            Ok(success_response_with_message(
                serde_json::json!({
                    "imported": imported_count,
                    "skipped": skipped_count,
                    "errors": errors,
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

pub async fn export_opml(State(app_state): State<AppState>) -> Result<Response, StatusCode> {
    let opml_service = OPMLService::new(app_state.db.clone());

    match opml_service.export_opml().await {
        Ok(opml_content) => {
            let response = Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
                .header(
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=\"feeds.opml\"",
                )
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
