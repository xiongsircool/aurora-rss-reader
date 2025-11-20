use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "rsshub_configs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub url: String,
    pub priority: i32,
    pub is_active: bool,
    pub last_tested: Option<chrono::DateTime<chrono::Utc>>,
    pub response_time: Option<i32>,
    pub error_count: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}