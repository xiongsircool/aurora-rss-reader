use crate::models::entry::{
    ActiveModel, Entity as Entry, ListEntriesQuery, Model as EntryModel, UpdateEntryRequest,
};
use crate::models::feed::Entity as Feed;
use crate::utils::date_filter::DateFilterer;
use crate::utils::response::success_response;
use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, QuerySelect, RelationTrait, Set,
};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Serialize)]
struct FrontendEntry {
    id: String,
    feed_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    feed_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    published_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    inserted_at: Option<chrono::DateTime<chrono::Utc>>,
    read: bool,
    starred: bool,
}

impl FrontendEntry {
    fn from_model(entry: EntryModel, feed_meta: Option<&(String, Option<String>)>) -> Self {
        let (feed_title, _group) = feed_meta
            .cloned()
            .unwrap_or_else(|| ("未知订阅".to_string(), None));

        Self {
            id: entry.id,
            feed_id: entry.feed_id,
            feed_title: Some(feed_title),
            title: Some(entry.title),
            url: Some(entry.url),
            author: entry.author,
            summary: entry.summary,
            content: entry.content,
            published_at: entry.published_at.map(|dt| dt.naive_utc().and_utc()),
            inserted_at: Some(entry.created_at.naive_utc().and_utc()),
            read: entry.is_read,
            starred: entry.is_starred,
        }
    }
}

async fn load_feed_metadata(
    db: &DatabaseConnection,
) -> Result<HashMap<String, (String, Option<String>)>, StatusCode> {
    let feeds = Feed::find().all(db).await.map_err(|e| {
        tracing::error!("Failed to fetch feeds: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut feed_map = HashMap::new();
    for f in feeds {
        feed_map.insert(f.id.clone(), (f.title.clone(), f.category.clone()));
    }
    Ok(feed_map)
}

pub async fn list_entries(
    State(app_state): State<AppState>,
    Query(params): Query<ListEntriesQuery>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;
    let mut query = Entry::find();

    // 应用feed过滤
    if let Some(feed_id) = params.feed_id {
        query = query.filter(crate::models::entry::Column::FeedId.eq(feed_id));
    }

    // 应用分组过滤
    if let Some(group_name) = params.group_name {
        query = query.join(
            sea_orm::JoinType::InnerJoin,
            crate::models::entry::Relation::Feed.def()
        ).filter(
            crate::models::feed::Column::Category.eq(group_name)
        );
    }

    // 应用已读状态过滤
    if let Some(unread_only) = params.unread_only {
        if unread_only {
            query = query.filter(crate::models::entry::Column::IsRead.eq(false));
        }
    }

    // 应用收藏状态过滤
    if let Some(is_starred) = params.is_starred {
        query = query.filter(crate::models::entry::Column::IsStarred.eq(is_starred));
    }

    // 应用时间范围过滤
    if params.date_range.is_some() || params.time_field.is_some() {
        tracing::info!(
            "Applying date filter: range={:?}, field={:?}",
            params.date_range,
            params.time_field
        );
    }
    query = DateFilterer::apply_date_filter_to_entries(
        query,
        params.date_range.as_deref(),
        params.time_field.as_deref(),
    );

    // 应用排序
    let order_by = params.order_by.as_deref().unwrap_or("published_at");
    let order = params.order.as_deref().unwrap_or("desc");

    query = match (order_by, order) {
        ("published_at", "desc") => query.order_by_desc(crate::models::entry::Column::PublishedAt),
        ("published_at", "asc") => query.order_by_asc(crate::models::entry::Column::PublishedAt),
        ("created_at", "desc") => query.order_by_desc(crate::models::entry::Column::CreatedAt),
        ("created_at", "asc") => query.order_by_asc(crate::models::entry::Column::CreatedAt),
        _ => query.order_by_desc(crate::models::entry::Column::PublishedAt),
    };

    // 应用分页
    let limit = params.limit.unwrap_or(50).min(1000);
    let offset = params.offset.unwrap_or(0);

    let entries = query
        .offset(offset as u64)
        .limit(limit as u64)
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entries: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let feed_meta = load_feed_metadata(db).await?;
    let entry_responses: Vec<FrontendEntry> = entries
        .into_iter()
        .map(|entry| {
            let meta = feed_meta.get(&entry.feed_id);
            FrontendEntry::from_model(entry, meta)
        })
        .collect();

    Ok(success_response(entry_responses))
}

pub async fn get_entry(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match entry {
        Some(entry) => {
            let feed_meta = Feed::find_by_id(entry.feed_id.clone())
                .one(db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to fetch feed meta: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            let meta_pair = feed_meta.map(|f| (f.title, f.category));
            Ok(success_response(FrontendEntry::from_model(
                entry,
                meta_pair.as_ref(),
            )))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_entry(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateEntryRequest>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id.clone()).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match entry {
        Some(entry) => {
            let feed_id = entry.feed_id.clone();
            let mut active_entry: ActiveModel = entry.into();

            if let Some(is_read) = payload.is_read {
                active_entry.is_read = Set(is_read);
            }

            if let Some(is_starred) = payload.is_starred {
                active_entry.is_starred = Set(is_starred);
            }

            let updated_entry = active_entry.update(db).await.map_err(|e| {
                tracing::error!("Failed to update entry: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            let feed_meta = Feed::find_by_id(feed_id.clone())
                .one(db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to fetch feed meta: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            let meta_pair = feed_meta.map(|f| (f.title, f.category));

            Ok(success_response(FrontendEntry::from_model(
                updated_entry,
                meta_pair.as_ref(),
            )))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn mark_as_read(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_read = Set(true);

            active_entry.update(db).await.map_err(|e| {
                tracing::error!("Failed to mark entry as read: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            Ok(success_response(()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn mark_as_unread(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_read = Set(false);

            active_entry.update(db).await.map_err(|e| {
                tracing::error!("Failed to mark entry as unread: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            Ok(success_response(()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn star_entry(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_starred = Set(true);

            active_entry.update(db).await.map_err(|e| {
                tracing::error!("Failed to star entry: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            Ok(success_response(()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn unstar_entry(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_starred = Set(false);

            active_entry.update(db).await.map_err(|e| {
                tracing::error!("Failed to unstar entry: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            Ok(success_response(()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn bulk_star_entries(
    State(app_state): State<AppState>,
    Json(entry_ids): Json<Vec<String>>,
) -> Result<Json<Value>, StatusCode> {
    let db = &app_state.db;

    if entry_ids.is_empty() {
        return Ok(success_response(serde_json::json!({ "updated": 0 })));
    }

    let entries = Entry::find()
        .filter(crate::models::entry::Column::Id.is_in(entry_ids.clone()))
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entries for bulk star: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut updated = 0;
    for entry in entries {
        let mut active_entry: ActiveModel = entry.into();
        active_entry.is_starred = Set(true);
        active_entry.update(db).await.map_err(|e| {
            tracing::error!("Failed to star entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        updated += 1;
    }

    Ok(success_response(serde_json::json!({ "updated": updated })))
}

pub async fn bulk_unstar_entries(
    State(app_state): State<AppState>,
    Json(entry_ids): Json<Vec<String>>,
) -> Result<Json<Value>, StatusCode> {
    let db = &app_state.db;

    if entry_ids.is_empty() {
        return Ok(success_response(serde_json::json!({ "updated": 0 })));
    }

    let entries = Entry::find()
        .filter(crate::models::entry::Column::Id.is_in(entry_ids.clone()))
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entries for bulk unstar: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut updated = 0;
    for entry in entries {
        let mut active_entry: ActiveModel = entry.into();
        active_entry.is_starred = Set(false);
        active_entry.update(db).await.map_err(|e| {
            tracing::error!("Failed to unstar entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        updated += 1;
    }

    Ok(success_response(serde_json::json!({ "updated": updated })))
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct StarredEntryResponse {
    pub id: String,
    pub feed_id: String,
    pub feed_title: String,
    pub group_name: Option<String>,
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub inserted_at: Option<chrono::DateTime<chrono::Utc>>,
    pub read: bool,
    pub starred: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct StarredStats {
    pub total_starred: i64,
    pub by_feed: HashMap<String, FeedStarStat>,
    pub by_group: HashMap<String, i64>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FeedStarStat {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_name: Option<String>,
    pub starred_count: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Default)]
pub struct StarredQuery {
    pub feed_id: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

pub async fn list_starred_entries(
    State(app_state): State<AppState>,
    Query(params): Query<StarredQuery>,
) -> Result<Json<Value>, StatusCode> {
    let db = &app_state.db;

    // 读取 feed 元数据用于标题/分组
    let feeds = crate::models::feed::Entity::find()
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch feeds: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let mut feed_map = HashMap::new();
    for f in feeds {
        feed_map.insert(f.id.clone(), (f.title.clone(), f.category.clone()));
    }

    let mut query = Entry::find().filter(crate::models::entry::Column::IsStarred.eq(true));
    if let Some(feed_id) = params.feed_id.clone() {
        query = query.filter(crate::models::entry::Column::FeedId.eq(feed_id));
    }

    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let entries = query
        .offset(offset as u64)
        .limit(limit as u64)
        .order_by_desc(crate::models::entry::Column::PublishedAt)
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch starred entries: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let responses: Vec<StarredEntryResponse> = entries
        .into_iter()
        .map(|entry| {
            let (feed_title, group_name) = feed_map
                .get(&entry.feed_id)
                .cloned()
                .unwrap_or_else(|| ("Unknown Feed".to_string(), None));

            StarredEntryResponse {
                id: entry.id,
                feed_id: entry.feed_id,
                feed_title,
                group_name,
                title: entry.title,
                url: entry.url,
                author: entry.author,
                summary: entry.summary,
                content: entry.content,
                published_at: entry.published_at.map(|dt| dt.naive_utc().and_utc()),
                inserted_at: entry.created_at.naive_utc().and_utc().into(),
                read: entry.is_read,
                starred: entry.is_starred,
            }
        })
        .collect();

    Ok(success_response(responses))
}

pub async fn get_starred_stats(
    State(app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    let db = &app_state.db;

    // 统计总数
    let total_starred = Entry::find()
        .filter(crate::models::entry::Column::IsStarred.eq(true))
        .count(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to count starred entries: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 聚合按 feed
    let mut by_feed: HashMap<String, FeedStarStat> = HashMap::new();
    let starred_entries = Entry::find()
        .filter(crate::models::entry::Column::IsStarred.eq(true))
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch starred entries for stats: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 获取 feed 元数据
    let feeds = crate::models::feed::Entity::find()
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch feeds: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let mut feed_meta: HashMap<String, (String, Option<String>)> = HashMap::new();
    for f in feeds {
        feed_meta.insert(f.id.clone(), (f.title.clone(), f.category.clone()));
    }

    for entry in starred_entries {
        let (title, group) = feed_meta
            .get(&entry.feed_id)
            .cloned()
            .unwrap_or_else(|| ("Unknown Feed".to_string(), None));
        let stat = by_feed
            .entry(entry.feed_id.clone())
            .or_insert(FeedStarStat {
                title,
                group_name: group.clone(),
                starred_count: 0,
            });
        stat.starred_count += 1;
    }

    // 聚合按分组
    let mut by_group: HashMap<String, i64> = HashMap::new();
    for (_, meta) in feed_meta.iter() {
        if let Some(group_name) = &meta.1 {
            let count = by_feed
                .iter()
                .filter(|(feed_id, _)| {
                    feed_meta.get(*feed_id).and_then(|(_, g)| g.clone()) == Some(group_name.clone())
                })
                .map(|(_, stat)| stat.starred_count)
                .sum();
            by_group.insert(group_name.clone(), count);
        }
    }

    Ok(success_response(StarredStats {
        total_starred: total_starred as i64,
        by_feed,
        by_group,
    }))
}
