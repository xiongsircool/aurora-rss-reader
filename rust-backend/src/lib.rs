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