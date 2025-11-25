use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// SeaORM Entity Model
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "site_icons")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub domain: String,
    pub icon_url: Option<String>,
    pub icon_data: Option<String>,  // Base64 encoded icon data
    pub icon_type: Option<String>,  // e.g., "image/png", "image/x-icon"
    pub icon_size: Option<i32>,     // Size in bytes
    pub last_fetched: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>, // Cache expiration
    pub error_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

// Request/Response DTOs
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
