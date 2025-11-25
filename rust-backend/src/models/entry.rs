use chrono::Utc;
use sea_orm::entity::prelude::*;
use sea_orm::{DeriveEntityModel, Set};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "entries")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub feed_id: String,
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub published_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub is_read: bool,
    pub is_starred: bool,
    pub reading_time: Option<i32>, // minutes
    pub word_count: Option<i32>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::feed::Entity",
        from = "Column::FeedId",
        to = "super::feed::Column::Id"
    )]
    Feed,
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(Uuid::new_v4().to_string()),
            created_at: Set(Utc::now()),
            updated_at: Set(Utc::now()),
            is_read: Set(false),
            is_starred: Set(false),
            ..Default::default()
        }
    }
}

// Type aliases for convenience
#[allow(dead_code)]
pub type Entry = Model;
#[allow(dead_code)]
pub type EntryActiveModel = ActiveModel;

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateEntryRequest {
    #[serde(default, alias = "read")]
    pub is_read: Option<bool>,
    #[serde(default, alias = "starred")]
    pub is_starred: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListEntriesQuery {
    pub feed_id: Option<String>,
    pub group_name: Option<String>, // 分组过滤（对应 feeds.category）
    pub unread_only: Option<bool>,  // 仅未读
    pub is_starred: Option<bool>,
    pub date_range: Option<String>, // 时间范围：1d, 2d, 3d, 7d, 30d, 90d, 180d, 365d, all
    pub time_field: Option<String>, // 时间字段：inserted_at, published_at
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub order_by: Option<String>, // "published_at" or "created_at"
    pub order: Option<String>,    // "asc" or "desc"
}
