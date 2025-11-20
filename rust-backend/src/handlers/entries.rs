use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde_json::Value;
use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, Set, ActiveModelTrait, ColumnTrait, QueryOrder, QuerySelect};
use crate::AppState;
use crate::models::entry::{Entity as Entry, ActiveModel, UpdateEntryRequest, ListEntriesQuery};
use crate::utils::response::success_response;
use crate::utils::date_filter::DateFilterer;

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

    // 应用分组过滤（暂时简化处理 - 需要join操作）
    // TODO: 实现通过join feed表来过滤group_name

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
    query = DateFilterer::apply_date_filter_to_entries(
        query,
        params.date_range.as_deref(),
        params.time_field.as_deref()
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

    let entry_responses: Vec<crate::models::entry::EntryResponse> = entries
        .into_iter()
        .map(|entry| entry.into())
        .collect();

    Ok(success_response(entry_responses))
}

pub async fn get_entry(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match entry {
        Some(entry) => Ok(success_response(crate::models::entry::EntryResponse::from(entry))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_entry(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateEntryRequest>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id.clone())
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();

            if let Some(is_read) = payload.is_read {
                active_entry.is_read = Set(is_read);
            }

            if let Some(is_starred) = payload.is_starred {
                active_entry.is_starred = Set(is_starred);
            }

            let updated_entry = active_entry
                .update(db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to update entry: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            Ok(success_response(crate::models::entry::EntryResponse::from(updated_entry)))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn mark_as_read(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let entry = Entry::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_read = Set(true);

            active_entry
                .update(db)
                .await
                .map_err(|e| {
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

    let entry = Entry::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_read = Set(false);

            active_entry
                .update(db)
                .await
                .map_err(|e| {
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

    let entry = Entry::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_starred = Set(true);

            active_entry
                .update(db)
                .await
                .map_err(|e| {
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

    let entry = Entry::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch entry: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match entry {
        Some(entry) => {
            let mut active_entry: ActiveModel = entry.into();
            active_entry.is_starred = Set(false);

            active_entry
                .update(db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to unstar entry: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            Ok(success_response(()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}
