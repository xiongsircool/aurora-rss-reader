use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// SeaORM Entity Model
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "rsshub_configs")]
pub struct Model {
    #[sea_orm(primary_key)]
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

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

// Request/Response DTOs
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

impl From<Model> for RSSHubConfigResponse {
    fn from(model: Model) -> Self {
        Self {
            id: model.id,
            url: model.url,
            priority: model.priority,
            is_active: model.is_active,
            last_tested: model.last_tested,
            response_time: model.response_time,
            error_count: model.error_count,
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}
