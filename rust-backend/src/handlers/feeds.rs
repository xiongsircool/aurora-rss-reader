use crate::models::entry::Entity as Entry;
use crate::models::feed::{
    ActiveModel as FeedActiveModel, CreateFeedRequest, Entity as Feed, FeedListQuery, FeedResponse,
    UpdateFeedRequest,
};
use crate::services::fetcher::RSSFetcher;
use crate::utils::date_filter::DateFilterer;
use crate::utils::response::{success_response, success_response_with_message};
use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, QuerySelect, Set,
};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
struct FrontendFeed {
    id: String,
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    group_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    favicon_url: Option<String>,
    unread_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_checked_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_error: Option<String>,
}

impl From<FeedResponse> for FrontendFeed {
    fn from(feed: FeedResponse) -> Self {
        Self {
            id: feed.id,
            url: feed.url,
            title: Some(feed.title),
            group_name: feed.category.unwrap_or_else(|| "未分组".to_string()),
            favicon_url: feed.favicon,
            unread_count: feed.unread_count.unwrap_or(0),
            last_checked_at: feed.last_updated,
            last_error: feed.last_status,
        }
    }
}

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
        db,
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

    // 转换为响应格式并计算未读数量
    let mut feed_responses: Vec<FeedResponse> = Vec::new();

    for feed in feeds {
        // 计算每个 feed 的未读数量，应用时间过滤
        let mut entry_query = Entry::find()
            .filter(crate::models::entry::Column::FeedId.eq(&feed.id))
            .filter(crate::models::entry::Column::IsRead.eq(false));

        // 应用时间范围过滤（与列表查询相同的逻辑）
        entry_query = DateFilterer::apply_date_filter_to_entries(
            entry_query,
            params.date_range.as_deref(),
            params.time_field.as_deref(),
        );

        let unread_count = entry_query
            .count(db)
            .await
            .unwrap_or(0) as i32;

        let mut response = FeedResponse::from(feed);
        response.unread_count = Some(unread_count);
        feed_responses.push(response);
    }

    let frontend_feeds: Vec<FrontendFeed> =
        feed_responses.into_iter().map(FrontendFeed::from).collect();

    Ok(success_response(frontend_feeds))
}

pub async fn create_feed(
    State(app_state): State<AppState>,
    Json(payload): Json<CreateFeedRequest>,
) -> Result<Json<Value>, StatusCode> {
    tracing::info!("create_feed called with URL: {}", payload.url);

    // Validate URL
    crate::utils::validation::validate_rss_url(&payload.url).map_err(|e| {
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
    let title = payload
        .title
        .clone()
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| payload.url.clone());
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
    let _insert_result = new_feed.insert(db).await.map_err(|e| {
        tracing::error!("Failed to insert feed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("Feed inserted successfully");

    // Trigger immediate refresh in background for better UX
    let db_clone = app_state.db.clone();
    let feed_id_clone = feed_id.clone();
    tokio::spawn(async move {
        if let Ok(fetcher) = RSSFetcher::new(db_clone) {
            match fetcher.fetch_feed(&feed_id_clone).await {
                Ok(_) => tracing::info!("Initial refresh successful for feed: {}", feed_id_clone),
                Err(e) => tracing::warn!("Initial refresh failed for feed {}: {}", feed_id_clone, e),
            }
        }
    });

    // Create response from stored values
    let feed_data = FeedResponse {
        id: feed_id.clone(),
        title: title.clone(),
        url: url.clone(),
        category: category.clone(),
        favicon: None,
        update_interval,
        last_updated: None,
        last_status: None,
        error_count: 0,
        created_at: now.naive_utc().and_utc(),
        updated_at: now.naive_utc().and_utc(),
        unread_count: Some(0),
    };

    Ok(success_response_with_message(
        FrontendFeed::from(feed_data),
        "Feed created successfully",
    ))
}

pub async fn get_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let feed = Feed::find_by_id(id).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch feed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match feed {
        Some(feed) => Ok(success_response(FrontendFeed::from(FeedResponse::from(
            feed,
        )))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateFeedRequest>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let feed = Feed::find_by_id(id.clone()).one(db).await.map_err(|e| {
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

            let updated_feed = active_feed.update(db).await.map_err(|e| {
                tracing::error!("Failed to update feed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            Ok(success_response(FrontendFeed::from(FeedResponse::from(
                updated_feed,
            ))))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let db: &DatabaseConnection = &app_state.db;

    let feed = Feed::find_by_id(&id).one(db).await.map_err(|e| {
        tracing::error!("Failed to fetch feed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match feed {
        Some(_feed) => {
            Feed::delete_by_id(&id).exec(db).await.map_err(|e| {
                tracing::error!("Failed to delete feed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            Ok(success_response_with_message(
                (),
                "Feed deleted successfully",
            ))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn refresh_feed(
    State(app_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let fetcher = match RSSFetcher::new(app_state.db.clone()) {
        Ok(fetcher) => fetcher,
        Err(e) => {
            tracing::error!("Failed to create RSS fetcher: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    match fetcher.fetch_feed(&id).await {
        Ok(result) => {
            tracing::info!("Feed refreshed successfully: {:?}", result);
            Ok(success_response(result))
        }
        Err(e) => {
            tracing::error!("Failed to refresh feed: {}", e);

            // Update feed with error status
            if let Ok(Some(feed)) = Feed::find_by_id(&id).one(&fetcher.db).await {
                let mut active_feed: FeedActiveModel = feed.into();
                active_feed.last_status = Set(Some(format!("Error: {}", e)));
                let current_count = match active_feed.error_count {
                sea_orm::ActiveValue::Set(count) => count,
                sea_orm::ActiveValue::Unchanged(count) => count,
                _ => 0,
            };
                active_feed.error_count = Set(current_count + 1);
                // Always update last_updated to show refresh attempt time
                active_feed.last_updated = Set(Some(chrono::Utc::now()));

                if let Err(update_err) = active_feed.update(&fetcher.db).await {
                    tracing::error!("Failed to update feed status after refresh error: {}", update_err);
                }
            }

            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
