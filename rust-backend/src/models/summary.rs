use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Summary {
    pub id: String,
    pub entry_id: String,
    pub summary_text: String,
    pub language: String,
    pub model_used: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SummaryRequest {
    pub entry_id: String,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SummaryResponse {
    pub entry_id: String,
    pub summary_text: String,
    pub language: String,
    pub model_used: String,
}
