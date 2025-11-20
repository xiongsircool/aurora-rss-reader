use sea_orm::{Database, DatabaseConnection};
use sqlx::{Sqlite, SqlitePool, sqlite::SqlitePoolConnectOptions};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::OnceCell;

use rss_backend::config::Config;
use rss_backend::database::migrations;
use rss_backend::AppState;

static TEST_DB: OnceCell<Arc<DatabaseConnection>> = OnceCell::const_new();

/// 测试用的数据库连接池
pub async fn get_test_db() -> Arc<DatabaseConnection> {
    TEST_DB.get_or_init(|| async {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");

        let pool = SqlitePool::connect_with(
            SqlxSqlitePoolConnectOptions::new()
                .filename(&db_path)
                .create_if_missing(true)
        ).await.expect("Failed to create test database");

        // 运行迁移
        migrations::run_migrations(&pool).await.expect("Failed to run migrations");

        let db = Database::from_pool(pool).expect("Failed to create database connection");
        Arc::new(db)
    }).await.clone()
}

/// 创建测试用的应用状态
pub async fn create_test_app_state() -> AppState {
    let db = get_test_db().await;
    let config = Config {
        port: 0, // 使用随机端口
        database_url: ":memory:".to_string(),
        rsshub_base_url: "https://rsshub.app".to_string(),
        max_articles_per_feed: 100,
        default_language: "zh-CN".to_string(),
        log_level: "debug".to_string(),
        cache_ttl_seconds: 3600,
        fetch_timeout_seconds: 30,
        max_concurrent_feeds: 10,
        enable_ai_features: false,
        ai_api_key: None,
        ai_model: "gpt-3.5-turbo".to_string(),
    };

    // 创建任务调度器
    let task_scheduler = rss_backend::services::task_scheduler::TaskScheduler::new((*db).clone());
    let task_scheduler = std::sync::Arc::new(tokio::sync::Mutex::new(task_scheduler));

    AppState {
        db: (*db).clone(),
        config,
        task_scheduler,
    }
}

/// 测试用的RSS源数据
pub struct TestFeedData {
    pub id: String,
    pub title: String,
    pub url: String,
    pub category: Option<String>,
}

impl TestFeedData {
    pub fn new() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title: "测试RSS源".to_string(),
            url: "https://example.com/rss.xml".to_string(),
            category: Some("测试分类".to_string()),
        }
    }

    pub fn rsshub_example() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title: "GitHub热门项目".to_string(),
            url: "https://rsshub.app/github/trending/daily".to_string(),
            category: Some("技术".to_string()),
        }
    }
}

/// 测试用的条目数据
pub struct TestEntryData {
    pub id: String,
    pub feed_id: String,
    pub title: String,
    pub url: String,
    pub content: Option<String>,
    pub summary: Option<String>,
}

impl TestEntryData {
    pub fn new(feed_id: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            feed_id,
            title: "测试条目".to_string(),
            url: "https://example.com/article/1".to_string(),
            content: Some("这是一篇测试文章的内容".to_string()),
            summary: Some("这是一篇测试文章的摘要".to_string()),
        }
    }
}