use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde_json::Value;
use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, Set, ActiveModelTrait, ColumnTrait, QueryOrder, QuerySelect};
use crate::AppState;
use crate::models::feed::{Entity as Feed, ActiveModel as FeedActiveModel, CreateFeedRequest, FeedResponse, UpdateFeedRequest, FeedListQuery};
use crate::services::fetcher::RSSFetcher;
use crate::utils::response::{success_response, success_response_with_message};
use crate::utils::date_filter::DateFilterer;

pub async fn list_feeds(
    State(app_state): State<AppState>,
    Query(params): Query<FeedListQuery>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;
    let mut query = Feed::find();

    // 应用分组过滤（暂时简化处理）
    if let Some(group) = params.group_name {
        query = query.filter(crate::models::feed::Column::Category.eq(group));
    }

    // 应用时间范围过滤
    query = DateFilterer::apply_date_filter_to_feeds(
        query,
        params.date_range.as_deref(),
        params.time_field.as_deref(),
        db
    );

    // 应用排序
    query = query.order_by_desc(crate::models::feed::Column::CreatedAt);

    // 应用分页
    let limit = params.limit.unwrap_or(50).min(1000);
    let offset = params.offset.unwrap_or(0);

    let feeds = query
        .offset(offset as u64)
        .limit(limit as u64)
        .all(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch feeds: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 转换为响应格式（暂时不计算未读数量）
    let feed_responses: Vec<FeedResponse> = feeds
        .into_iter()
        .map(|feed| {
            let mut response = FeedResponse::from(feed);
            // TODO: 实现未读数量计算
            response.unread_count = Some(0);
            response
        })
        .collect();

    Ok(success_response(feed_responses))
}

pub async fn create_feed(
    State(app_state): State<AppState>,
    Json(payload): Json<CreateFeedRequest>,
) -> Result<Json<Value>, StatusCode> {
    tracing::info!("create_feed called with URL: {}", payload.url);

    // Validate URL
    crate::utils::validation::validate_rss_url(&payload.url)
        .map_err(|e| {
            tracing::warn!("Invalid feed URL: {}", e);
            StatusCode::BAD_REQUEST
        })?;

    tracing::info!("URL validation passed");

    let db: &DatabaseConnection = &app_state.db;

    // Check if feed URL already exists
    tracing::info!("Checking for existing feed...");
    let existing_feed = Feed::find()
        .filter(crate::models::feed::Column::Url.eq(&payload.url))
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check existing feed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!("Existing feed check completed");

    if existing_feed.is_some() {
        tracing::warn!("Feed with URL already exists");
        return Err(StatusCode::CONFLICT);
    }

    // Store values before moving payload
    let feed_id = uuid::Uuid::new_v4().to_string();
    let title = payload.title.clone();
    let url = payload.url.clone();
    let category = payload.category.clone();
    let update_interval = payload.update_interval;
    let now = chrono::Utc::now();

    // Create ActiveModel with minimal fields to avoid recursion
    let new_feed = FeedActiveModel {
        id: Set(feed_id.clone()),
        title: Set(title.clone()),
        url: Set(url.clone()),
        category: Set(category.clone()),
        favicon: Set(None),
        update_interval: Set(update_interval),
        last_updated: Set(None),
        last_status: Set(None),
        error_count: Set(0),
        created_at: Set(now),
        updated_at: Set(now),
    };

    // Insert the feed and ignore the return value to avoid potential issues
    let _insert_result = new_feed.insert(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to insert feed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!("Feed inserted successfully");

    // Create response from stored values
    let feed_data = serde_json::json!({
        "id": feed_id,
        "title": title,
        "url": url,
        "category": category,
        "update_interval": update_interval,
        "favicon": null,
        "last_updated": null,
        "last_status": null,
        "error_count": 0,
        "created_at": now,
        "updated_at": now
    });

    Ok(success_response_with_message(feed_data, "Feed created successfully"))
}

pub async fn get_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let feed = Feed::find_by_id(id)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch feed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match feed {
        Some(feed) => Ok(success_response(FeedResponse::from(feed))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateFeedRequest>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let feed = Feed::find_by_id(id.clone())
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch feed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match feed {
        Some(feed) => {
            let mut active_feed: FeedActiveModel = feed.into();

            if let Some(title) = payload.title {
                active_feed.title = Set(title);
            }

            if let Some(category) = payload.category {
                active_feed.category = Set(Some(category));
            }

            if let Some(update_interval) = payload.update_interval {
                active_feed.update_interval = Set(Some(update_interval));
            }

            let updated_feed = active_feed
                .update(db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to update feed: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            Ok(success_response(FeedResponse::from(updated_feed)))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let feed = Feed::find_by_id(&id)
        .one(db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch feed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    match feed {
        Some(_feed) => {
            Feed::delete_by_id(&id)
                .exec(db)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to delete feed: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            Ok(success_response_with_message((), "Feed deleted successfully"))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn refresh_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let fetcher = RSSFetcher::new(app_state.db.clone());

    match fetcher.fetch_feed(&id).await {
        Ok(result) => {
            tracing::info!("Feed refreshed successfully: {:?}", result);
            Ok(success_response(result))
        }
        Err(e) => {
            tracing::error!("Failed to refresh feed: {}", e);

            // Update feed with error status
            if let Ok(Some(feed)) = Feed::find_by_id(&id)
                .one(&fetcher.db)
                .await
            {
                let mut active_feed: FeedActiveModel = feed.into();
                active_feed.last_status = Set(Some(format!("Error: {}", e)));
                active_feed.error_count = Set(active_feed.error_count.unwrap() + 1);

                let _ = active_feed.update(&fetcher.db).await;
            }

            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
