use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteIcon {
    pub id: String,
    pub domain: String,
    pub icon_url: Option<String>,
    pub icon_data: Option<String>,
    pub icon_type: Option<String>,
    pub icon_size: Option<i32>,
    pub last_fetched: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub error_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SiteIconResponse {
    pub domain: String,
    pub icon_url: Option<String>,
    pub icon_data: Option<String>,
    pub icon_type: Option<String>,
    pub icon_size: Option<i32>,
    pub cached: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IconCacheRequest {
    pub force_refresh: Option<bool>,
}

impl From<crate::models::site_icon_entity::Model> for SiteIcon {
    fn from(model: crate::models::site_icon_entity::Model) -> Self {
        Self {
            id: model.id,
            domain: model.domain,
            icon_url: model.icon_url,
            icon_data: model.icon_data,
            icon_type: model.icon_type,
            icon_size: model.icon_size,
            last_fetched: model.last_fetched,
            expires_at: model.expires_at,
            error_count: model.error_count,
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}