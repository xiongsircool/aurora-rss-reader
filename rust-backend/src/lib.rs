// 导出模块供测试使用
pub mod config;
pub mod database;
pub mod handlers;
pub mod models;
pub mod services;
pub mod utils;

// Re-export AppState for handlers
pub use config::Config;
use sea_orm::DatabaseConnection;

// Application state
#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub config: Config,
    pub task_scheduler: std::sync::Arc<tokio::sync::Mutex<services::task_scheduler::TaskScheduler>>,
}

// 创建应用程序路由器（用于测试）
#[cfg(test)]
pub mod main {
    use super::*;
    use axum::{
        extract::State,
        http::StatusCode,
        routing::{get, post},
        Router,
    };

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
                    .route(
                        "/icons/:domain/refresh",
                        post(handlers::icons::refresh_icon),
                    )
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

    async fn health_check(State(app_state): State<AppState>) -> Result<&'static str, StatusCode> {
        if let Err(err) = database::health_check(&app_state.db).await {
            tracing::error!("Database health check failed: {}", err);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }

        Ok("RSS Backend API is running!")
    }
}
