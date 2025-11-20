use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use sea_orm::{ActiveModelTrait, Set};
use tower::ServiceExt;

mod common;

use common::{create_test_app_state, TestFeedData};
use rss_backend::handlers::feeds;
use rss_backend::models::feed;

/// 测试创建RSS源
#[tokio::test]
async fn test_create_feed() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    let test_data = TestFeedData::new();
    let request_body = serde_json::json!({
        "title": test_data.title,
        "url": test_data.url,
        "category": test_data.category
    });

    let request = Request::builder()
        .method("POST")
        .uri("/api/feeds")
        .header("content-type", "application/json")
        .body(Body::from(request_body.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json["success"].as_bool().unwrap());
    assert_eq!(
        response_json["data"]["title"].as_str().unwrap(),
        test_data.title
    );
    assert_eq!(
        response_json["data"]["url"].as_str().unwrap(),
        test_data.url
    );
}

/// 测试获取RSS源列表
#[tokio::test]
async fn test_list_feeds() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state.clone());

    // 先创建一个测试RSS源
    let test_data = TestFeedData::new();
    let feed_model = feed::ActiveModel {
        id: Set(test_data.id.clone()),
        title: Set(test_data.title.clone()),
        url: Set(test_data.url.clone()),
        category: Set(test_data.category.clone()),
        ..Default::default()
    };
    feed_model.insert(&app_state.db).await.unwrap();

    let request = Request::builder()
        .method("GET")
        .uri("/api/feeds")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json["success"].as_bool().unwrap());
    assert!(response_json["data"].as_array().unwrap().len() > 0);

    let feed_data = &response_json["data"].as_array().unwrap()[0];
    assert_eq!(feed_data["title"].as_str().unwrap(), test_data.title);
    assert_eq!(feed_data["url"].as_str().unwrap(), test_data.url);
}

/// 测试获取单个RSS源
#[tokio::test]
async fn test_get_feed() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state.clone());

    // 先创建一个测试RSS源
    let test_data = TestFeedData::new();
    let feed_model = feed::ActiveModel {
        id: Set(test_data.id.clone()),
        title: Set(test_data.title.clone()),
        url: Set(test_data.url.clone()),
        category: Set(test_data.category.clone()),
        ..Default::default()
    };
    feed_model.insert(&app_state.db).await.unwrap();

    let request = Request::builder()
        .method("GET")
        .uri(&format!("/api/feeds/{}", test_data.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json["success"].as_bool().unwrap());
    assert_eq!(
        response_json["data"]["title"].as_str().unwrap(),
        test_data.title
    );
    assert_eq!(
        response_json["data"]["url"].as_str().unwrap(),
        test_data.url
    );
}

/// 测试更新RSS源
#[tokio::test]
async fn test_update_feed() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state.clone());

    // 先创建一个测试RSS源
    let test_data = TestFeedData::new();
    let feed_model = feed::ActiveModel {
        id: Set(test_data.id.clone()),
        title: Set(test_data.title.clone()),
        url: Set(test_data.url.clone()),
        category: Set(test_data.category.clone()),
        ..Default::default()
    };
    feed_model.insert(&app_state.db).await.unwrap();

    // 更新数据
    let updated_title = "更新后的RSS源标题".to_string();
    let updated_category = Some("更新后的分类".to_string());
    let request_body = serde_json::json!({
        "title": updated_title,
        "category": updated_category
    });

    let request = Request::builder()
        .method("PUT")
        .uri(&format!("/api/feeds/{}", test_data.id))
        .header("content-type", "application/json")
        .body(Body::from(request_body.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json["success"].as_bool().unwrap());
    assert_eq!(
        response_json["data"]["title"].as_str().unwrap(),
        updated_title
    );
    assert_eq!(
        response_json["data"]["category"].as_str().unwrap(),
        updated_category.as_deref().unwrap()
    );
}

/// 测试删除RSS源
#[tokio::test]
async fn test_delete_feed() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state.clone());

    // 先创建一个测试RSS源
    let test_data = TestFeedData::new();
    let feed_model = feed::ActiveModel {
        id: Set(test_data.id.clone()),
        title: Set(test_data.title.clone()),
        url: Set(test_data.url.clone()),
        category: Set(test_data.category.clone()),
        ..Default::default()
    };
    feed_model.insert(&app_state.db).await.unwrap();

    let request = Request::builder()
        .method("DELETE")
        .uri(&format!("/api/feeds/{}", test_data.id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json["success"].as_bool().unwrap());

    // 验证RSS源已被删除
    let found_feed = feed::Entity::find_by_id(test_data.id)
        .one(&app_state.db)
        .await
        .unwrap();
    assert!(found_feed.is_none());
}

/// 测试无效的RSS源创建请求
#[tokio::test]
async fn test_create_feed_invalid_data() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    // 测试缺少必填字段
    let request_body = serde_json::json!({
        "title": "测试RSS源"
        // 缺少 url 字段
    });

    let request = Request::builder()
        .method("POST")
        .uri("/api/feeds")
        .header("content-type", "application/json")
        .body(Body::from(request_body.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

/// 测试获取不存在的RSS源
#[tokio::test]
async fn test_get_nonexistent_feed() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    let fake_id = uuid::Uuid::new_v4().to_string();
    let request = Request::builder()
        .method("GET")
        .uri(&format!("/api/feeds/{}", fake_id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}