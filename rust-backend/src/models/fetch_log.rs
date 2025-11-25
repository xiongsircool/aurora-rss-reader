use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct FetchLog {
    pub id: String,
    pub feed_id: String,
    pub status: String, // "success", "error", "timeout"
    pub message: Option<String>,
    pub response_time: Option<i32>, // milliseconds
    pub articles_count: i32,
    pub new_articles_count: i32,
    pub http_status: Option<i32>,
    pub error_type: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct FetchLogResponse {
    pub id: String,
    pub feed_id: String,
    pub status: String,
    pub message: Option<String>,
    pub response_time: Option<i32>,
    pub articles_count: i32,
    pub new_articles_count: i32,
    pub http_status: Option<i32>,
    pub error_type: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<FetchLog> for FetchLogResponse {
    fn from(log: FetchLog) -> Self {
        Self {
            id: log.id,
            feed_id: log.feed_id,
            status: log.status,
            message: log.message,
            response_time: log.response_time,
            articles_count: log.articles_count,
            new_articles_count: log.new_articles_count,
            http_status: log.http_status,
            error_type: log.error_type,
            created_at: log.created_at,
        }
    }
}
