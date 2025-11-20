use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tracing::{info, Level};

mod config;
mod database;
mod handlers;
mod models;
mod services;
mod utils;

// Application state
#[derive(Clone)]
pub struct AppState {
    pub db: sea_orm::DatabaseConnection,
    pub config: config::Config,
    pub task_scheduler: std::sync::Arc<tokio::sync::Mutex<services::task_scheduler::TaskScheduler>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    // Load configuration
    let config = config::Config::from_env()?;
    info!("Starting RSS backend server");

    // Establish database connection
    let db = database::establish_connection(&config).await?;
    info!("Database connection established");

    // Initialize task scheduler
    let task_scheduler = services::task_scheduler::TaskScheduler::new(db.clone());

    let task_scheduler = std::sync::Arc::new(tokio::sync::Mutex::new(task_scheduler));

    // Start task scheduler
    {
        let mut scheduler_guard = task_scheduler.lock().await;
        if let Err(e) = scheduler_guard.start().await {
            return Err(anyhow::anyhow!("Failed to start task scheduler: {}", e));
        }
        info!("Task scheduler started");
    }

    let app_state = AppState {
        db,
        config: config.clone(),
        task_scheduler,
    };

    // Build the application router: health check + REST API compatible with the existing frontend
    let app = Router::new()
        .route("/", get(health_check))
        .nest(
            "/api",
            Router::new()
                // Feeds
                .route(
                    "/feeds",
                    get(handlers::feeds::list_feeds).post(handlers::feeds::create_feed),
                )
                .route(
                    "/feeds/:id",
                    get(handlers::feeds::get_feed)
                        .put(handlers::feeds::update_feed)
                        .delete(handlers::feeds::delete_feed),
                )
                .route(
                    "/feeds/:id/refresh",
                    post(handlers::feeds::refresh_feed),
                )
                // Entries
                .route(
                    "/entries",
                    get(handlers::entries::list_entries),
                )
                .route(
                    "/entries/:id",
                    get(handlers::entries::get_entry).put(handlers::entries::update_entry),
                )
                .route(
                    "/entries/:id/read",
                    post(handlers::entries::mark_as_read),
                )
                .route(
                    "/entries/:id/unread",
                    post(handlers::entries::mark_as_unread),
                )
                .route(
                    "/entries/:id/star",
                    post(handlers::entries::star_entry),
                )
                .route(
                    "/entries/:id/unstar",
                    post(handlers::entries::unstar_entry),
                )
                // Settings
                .route(
                    "/settings",
                    get(handlers::settings::get_settings)
                        .put(handlers::settings::update_settings),
                )
                // OPML
                .route(
                    "/opml/import",
                    post(handlers::opml::import_opml),
                )
                .route(
                    "/opml/export",
                    get(handlers::opml::export_opml),
                )
                // RSSHub configurations
                .route(
                    "/rsshub",
                    get(handlers::rsshub::list_configs)
                        .post(handlers::rsshub::create_config),
                )
                .route(
                    "/rsshub/:id",
                    get(handlers::rsshub::get_config)
                        .put(handlers::rsshub::update_config)
                        .delete(handlers::rsshub::delete_config),
                )
                .route(
                    "/rsshub/:id/test",
                    post(handlers::rsshub::test_rsshub),
                )
                .route(
                    "/rsshub/test-all",
                    post(handlers::rsshub::test_all_mirrors),
                )
                .route(
                    "/rsshub/best",
                    get(handlers::rsshub::get_best_mirror),
                )
                // Icons
                .route(
                    "/icons/:domain",
                    get(handlers::icons::get_icon),
                )
                .route(
                    "/icons",
                    get(handlers::icons::get_all_icons),
                )
                .route(
                    "/icons/:domain/refresh",
                    post(handlers::icons::refresh_icon),
                )
                .route(
                    "/icons/cleanup",
                    post(handlers::icons::cleanup_icons),
                )
                // Task management
                .route(
                    "/tasks",
                    get(handlers::tasks::get_tasks),
                )
                .route(
                    "/tasks/:id",
                    post(handlers::tasks::execute_task),
                )
                .route(
                    "/tasks/:id/toggle",
                    post(handlers::tasks::toggle_task),
                )
                .route(
                    "/tasks/:id/history",
                    get(handlers::tasks::get_task_history),
                )
                .route(
                    "/health",
                    get(handlers::tasks::get_health_status),
                )
                // AI routes
                .nest(
                    "/ai",
                    Router::new()
                        .route("/summarize", post(handlers::ai::summarize_article))
                        .route("/translate", post(handlers::ai::translate_article))
                        .route("/translate-title", post(handlers::ai::translate_title)),
                ),
        )
        .with_state(app_state);

    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// 创建应用程序路由器（用于测试）
#[cfg(test)]
pub fn create_app(app_state: AppState) -> Router {
    Router::new()
        .route("/", get(health_check))
        .nest(
            "/api",
            Router::new()
                // Feeds
                .route(
                    "/feeds",
                    get(handlers::feeds::list_feeds).post(handlers::feeds::create_feed),
                )
                .route(
                    "/feeds/:id",
                    get(handlers::feeds::get_feed)
                        .put(handlers::feeds::update_feed)
                        .delete(handlers::feeds::delete_feed),
                )
                // Icons
                .route("/icons", get(handlers::icons::get_all_icons))
                .route("/icons/:domain/refresh", post(handlers::icons::refresh_icon))
                .route("/icons/cleanup", post(handlers::icons::cleanup_icons))
                // Tasks
                .route("/tasks", get(handlers::tasks::get_tasks))
                .route("/tasks/:id", post(handlers::tasks::execute_task))
                .route("/health", get(handlers::tasks::get_health_status))
                // Settings
                .route(
                    "/settings",
                    get(handlers::settings::get_settings)
                        .put(handlers::settings::update_settings),
                ),
        )
        .with_state(app_state)
}

async fn health_check(
    State(app_state): State<AppState>,
) -> Result<&'static str, StatusCode> {
    if let Err(err) = database::health_check(&app_state.db).await {
        tracing::error!("Database health check failed: {}", err);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok("RSS Backend API is running!")
}
