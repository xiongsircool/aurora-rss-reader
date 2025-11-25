use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Translation {
    pub id: String,
    pub entry_id: String,
    pub field_type: String, // "title" or "content"
    pub source_language: String,
    pub target_language: String,
    pub source_text: String,
    pub translated_text: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationRequest {
    pub entry_id: String,
    pub field_type: String,
    pub target_language: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct TranslationResponse {
    pub entry_id: String,
    pub field_type: String,
    pub source_language: String,
    pub target_language: String,
    pub translated_text: String,
}
