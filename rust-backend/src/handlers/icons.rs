use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use tracing::{error, info};

use crate::models::site_icon::{IconCacheRequest, SiteIconResponse};
use crate::services::icon_service::IconService;
use crate::utils::response::{success_response, success_response_with_message};
use crate::AppState;

// Get icon for a domain
pub async fn get_icon(
    Path(domain): Path<String>,
    State(app_state): State<AppState>,
    Query(params): Query<IconCacheRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let icon_service = IconService::new(app_state.db.clone());
    let force_refresh = params.force_refresh.unwrap_or(false);

    match icon_service.get_icon(&domain, force_refresh).await {
        Ok(Some(icon_response)) => {
            let message = if icon_response.cached {
                "Retrieved cached icon"
            } else {
                "Fetched fresh icon"
            };
            Ok(success_response_with_message(icon_response, message))
        }
        Ok(None) => {
            // Return empty response with appropriate message
            Ok(success_response_with_message(
                serde_json::json!({"domain": domain, "icon_url": null, "icon_data": null}),
                "No icon found for domain",
            ))
        }
        Err(e) => {
            error!("Failed to get icon for domain {}: {}", domain, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Get all cached icons
pub async fn get_all_icons(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let icon_service = IconService::new(app_state.db.clone());

    match icon_service.get_all_icons().await {
        Ok(icons) => {
            let icon_responses: Vec<SiteIconResponse> = icons
                .into_iter()
                .map(|icon| SiteIconResponse {
                    domain: icon.domain,
                    icon_url: icon.icon_url,
                    icon_data: icon.icon_data,
                    icon_type: icon.icon_type,
                    icon_size: icon.icon_size,
                    cached: true,
                })
                .collect();
            Ok(success_response(icon_responses))
        }
        Err(e) => {
            error!("Failed to get all icons: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Force refresh icon for a domain
pub async fn refresh_icon(
    Path(domain): Path<String>,
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let icon_service = IconService::new(app_state.db.clone());

    match icon_service.get_icon(&domain, true).await {
        Ok(Some(icon_response)) => {
            info!("Force refreshed icon for domain: {}", domain);
            Ok(success_response_with_message(
                icon_response,
                "Icon refreshed successfully",
            ))
        }
        Ok(None) => {
            info!("No icon found during refresh for domain: {}", domain);
            Ok(success_response_with_message(
                serde_json::json!({"domain": domain, "icon_url": null, "icon_data": null}),
                "No icon found for domain",
            ))
        }
        Err(e) => {
            error!("Failed to refresh icon for domain {}: {}", domain, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Clean up expired icons
pub async fn cleanup_icons(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let icon_service = IconService::new(app_state.db.clone());

    match icon_service.cleanup_expired_icons().await {
        Ok(deleted_count) => {
            info!("Cleaned up {} expired icons", deleted_count);
            Ok(success_response_with_message(
                serde_json::json!({"deleted_count": deleted_count}),
                &format!("Cleaned up {} expired icons", deleted_count),
            ))
        }
        Err(e) => {
            error!("Failed to cleanup expired icons: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
