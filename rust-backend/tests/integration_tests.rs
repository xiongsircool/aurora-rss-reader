use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;

mod common;

use common::create_test_app_state;
use rss_backend::models::feed;

/// 测试健康检查端点
#[tokio::test]
async fn test_health_check() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    let request = Request::builder()
        .method("GET")
        .uri("/")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_text = String::from_utf8(body.to_vec()).unwrap();

    assert_eq!(response_text, "RSS Backend API is running!");
}

/// 测试API健康状态端点
#[tokio::test]
async fn test_api_health_status() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    let request = Request::builder()
        .method("GET")
        .uri("/api/health")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json["success"].as_bool().unwrap());
    assert_eq!(response_json["data"]["status"].as_str().unwrap(), "healthy");
    assert_eq!(response_json["data"]["database"].as_str().unwrap(), "connected");
}

/// 测试创建并获取RSS源的完整流程
#[tokio::test]
async fn test_create_and_get_feed_workflow() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state.clone());

    // 1. 创建RSS源
    let feed_data = serde_json::json!({
        "title": "技术博客测试",
        "url": "https://techblog.example.com/rss.xml",
        "category": "技术"
    });

    let create_request = Request::builder()
        .method("POST")
        .uri("/api/feeds")
        .header("content-type", "application/json")
        .body(Body::from(feed_data.to_string()))
        .unwrap();

    let create_response = app.clone().oneshot(create_request).await.unwrap();
    assert_eq!(create_response.status(), StatusCode::OK);

    let create_body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let create_result: serde_json::Value = serde_json::from_slice(&create_body).unwrap();

    let feed_id = create_result["data"]["id"].as_str().unwrap();
    let feed_title = create_result["data"]["title"].as_str().unwrap();

    // 2. 获取RSS源详情
    let get_request = Request::builder()
        .method("GET")
        .uri(&format!("/api/feeds/{}", feed_id))
        .body(Body::empty())
        .unwrap();

    let get_response = app.clone().oneshot(get_request).await.unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);

    let get_body = axum::body::to_bytes(get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let get_result: serde_json::Value = serde_json::from_slice(&get_body).unwrap();

    assert_eq!(get_result["data"]["id"].as_str().unwrap(), feed_id);
    assert_eq!(get_result["data"]["title"].as_str().unwrap(), feed_title);

    // 3. 验证数据库中的记录
    let db_feed = feed::Entity::find_by_id(feed_id.to_string())
        .one(&app_state.db)
        .await
        .unwrap();
    assert!(db_feed.is_some());

    let feed_model = db_feed.unwrap();
    assert_eq!(feed_model.title, feed_title);
    assert_eq!(feed_model.category.as_deref(), Some("技术"));
}

/// 测试获取空RSS源列表
#[tokio::test]
async fn test_get_empty_feeds_list() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

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
    assert_eq!(response_json["data"].as_array().unwrap().len(), 0);
}

/// 测试获取任务列表
#[tokio::test]
async fn test_get_tasks_list() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    let request = Request::builder()
        .method("GET")
        .uri("/api/tasks")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(response_json["success"].as_bool().unwrap());
    let tasks = response_json["data"].as_array().unwrap();

    // 应该有3个默认任务
    assert_eq!(tasks.len(), 3);

    // 验证任务类型存在
    let task_names: Vec<_> = tasks.iter()
        .map(|t| t["name"].as_str().unwrap())
        .collect();

    assert!(task_names.contains(&"RSS Feed Refresh"));
    assert!(task_names.contains(&"Icon Cache Cleanup"));
    assert!(task_names.contains(&"Health Check"));
}

/// 测试无效的API端点
#[tokio::test]
async fn test_invalid_endpoint() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    let request = Request::builder()
        .method("GET")
        .uri("/api/nonexistent")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

/// 测试无效的HTTP方法
#[tokio::test]
async fn test_invalid_http_method() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    // 尝试用PATCH方法访问只支持GET的端点
    let request = Request::builder()
        .method("PATCH")
        .uri("/api/health")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    // 应该返回405 Method Not Allowed 或 404 Not Found
    assert!(response.status() == StatusCode::METHOD_NOT_ALLOWED ||
              response.status() == StatusCode::NOT_FOUND);
}

/// 测试无效的JSON请求体
#[tokio::test]
async fn test_invalid_json_request() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    let request = Request::builder()
        .method("POST")
        .uri("/api/feeds")
        .header("content-type", "application/json")
        .body(Body::from("{invalid json"))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

/// 测试无效的请求数据
#[tokio::test]
async fn test_invalid_request_data() {
    let app_state = create_test_app_state().await;
    let app = rss_backend::main::create_app(app_state);

    // 缺少必填的url字段
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

/// 测试获取不存在的资源
#[tokio::test]
async fn test_get_nonexistent_resource() {
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