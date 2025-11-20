use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sea_orm::entity::prelude::*;
use sea_orm::{DeriveEntityModel, Set};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "feeds")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub title: String,
    pub url: String,
    pub category: Option<String>,
    pub favicon: Option<String>,
    pub update_interval: Option<i32>, // minutes
    pub last_updated: Option<DateTimeUtc>,
    pub last_status: Option<String>,
    pub error_count: i32,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            id: Set(Uuid::new_v4().to_string()),
            created_at: Set(Utc::now()),
            updated_at: Set(Utc::now()),
            error_count: Set(0),
            ..Default::default()
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateFeedRequest {
    pub title: String,
    pub url: String,
    pub category: Option<String>,
    pub update_interval: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateFeedRequest {
    pub title: Option<String>,
    pub category: Option<String>,
    pub update_interval: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FeedResponse {
    pub id: String,
    pub title: String,
    pub url: String,
    pub category: Option<String>,
    pub favicon: Option<String>,
    pub update_interval: Option<i32>,
    pub last_updated: Option<DateTime<Utc>>,
    pub last_status: Option<String>,
    pub error_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub unread_count: Option<i32>, // 未读文章数量
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FeedListQuery {
    pub group_name: Option<String>,  // 分组过滤
    pub date_range: Option<String>,   // 时间范围：1d, 2d, 3d, 7d, 30d, 90d, 180d, 365d, all
    pub time_field: Option<String>,    // 时间字段：inserted_at, published_at
    pub limit: Option<u32>,           // 分页大小
    pub offset: Option<u32>,          // 分页偏移
}

impl From<Model> for FeedResponse {
    fn from(feed: Model) -> Self {
        Self {
            id: feed.id,
            title: feed.title,
            url: feed.url,
            category: feed.category,
            favicon: feed.favicon,
            update_interval: feed.update_interval,
            last_updated: feed.last_updated.map(|dt| dt.naive_utc().and_utc()),
            last_status: feed.last_status,
            error_count: feed.error_count,
            created_at: feed.created_at.naive_utc().and_utc(),
            updated_at: feed.updated_at.naive_utc().and_utc(),
            unread_count: None, // 需要计算未读数量
        }
    }
}

// Type aliases for convenience
#[allow(dead_code)]
pub type Feed = Model;
#[allow(dead_code)]
pub type FeedActiveModel = ActiveModel;
