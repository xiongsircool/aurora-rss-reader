use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct RSSHubConfig {
    pub id: String,
    pub url: String,
    pub priority: i32,
    pub is_active: bool,
    pub last_tested: Option<DateTime<Utc>>,
    pub response_time: Option<i32>, // milliseconds
    pub error_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRSSHubConfigRequest {
    pub url: String,
    pub priority: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateRSSHubConfigRequest {
    pub url: Option<String>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct RSSHubConfigResponse {
    pub id: String,
    pub url: String,
    pub priority: i32,
    pub is_active: bool,
    pub last_tested: Option<DateTime<Utc>>,
    pub response_time: Option<i32>,
    pub error_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<RSSHubConfig> for RSSHubConfigResponse {
    fn from(config: RSSHubConfig) -> Self {
        Self {
            id: config.id,
            url: config.url,
            priority: config.priority,
            is_active: config.is_active,
            last_tested: config.last_tested,
            response_time: config.response_time,
            error_count: config.error_count,
            created_at: config.created_at,
            updated_at: config.updated_at,
        }
    }
}