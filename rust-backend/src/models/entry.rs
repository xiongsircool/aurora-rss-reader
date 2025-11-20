use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sea_orm::entity::prelude::*;
use sea_orm::{DeriveEntityModel, Set};
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
pub enum Relation {}

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

#[derive(Debug, Serialize, Deserialize)]
pub struct EntryResponse {
    pub id: String,
    pub feed_id: String,
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_read: bool,
    pub is_starred: bool,
    pub reading_time: Option<i32>,
    pub word_count: Option<i32>,
}

impl From<Model> for EntryResponse {
    fn from(entry: Model) -> Self {
        Self {
            id: entry.id,
            feed_id: entry.feed_id,
            title: entry.title,
            url: entry.url,
            author: entry.author,
            content: entry.content,
            summary: entry.summary,
            published_at: entry.published_at.map(|dt| dt.naive_utc().and_utc()),
            created_at: entry.created_at.naive_utc().and_utc(),
            updated_at: entry.updated_at.naive_utc().and_utc(),
            is_read: entry.is_read,
            is_starred: entry.is_starred,
            reading_time: entry.reading_time,
            word_count: entry.word_count,
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
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListEntriesQuery {
    pub feed_id: Option<String>,
    pub group_name: Option<String>,  // 分组过滤（对应 feeds.category）
    pub unread_only: Option<bool>,    // 仅未读
    pub is_starred: Option<bool>,
    pub date_range: Option<String>,   // 时间范围：1d, 2d, 3d, 7d, 30d, 90d, 180d, 365d, all
    pub time_field: Option<String>,    // 时间字段：inserted_at, published_at
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub order_by: Option<String>, // "published_at" or "created_at"
    pub order: Option<String>,    // "asc" or "desc"
}
