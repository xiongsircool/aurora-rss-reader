use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "site_icons")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub domain: String,
    pub icon_url: Option<String>,
    pub icon_data: Option<String>, // Base64 encoded icon data
    pub icon_type: Option<String>, // e.g., "image/png", "image/x-icon"
    pub icon_size: Option<i32>, // Size in bytes
    pub last_fetched: Option<chrono::DateTime<chrono::Utc>>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>, // Cache expiration
    pub error_count: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}