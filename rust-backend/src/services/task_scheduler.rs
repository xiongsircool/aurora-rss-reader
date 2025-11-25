use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::services::fetcher::RSSFetcher;
use crate::services::icon_service::IconService;
use sea_orm::DatabaseConnection;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub task_type: TaskType,
    pub cron_expression: String,
    pub enabled: bool,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: Option<DateTime<Utc>>,
    pub run_count: u64,
    pub success_count: u64,
    pub error_count: u64,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TaskType {
    FeedRefresh,
    IconCleanup,
    HealthCheck,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskExecutionResult {
    pub task_id: String,
    pub task_name: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub success: bool,
    pub message: String,
    pub duration_ms: Option<u64>,
}

pub struct TaskScheduler {
    scheduler: Option<JobScheduler>,
    tasks: Arc<RwLock<HashMap<String, ScheduledTask>>>,
    db: DatabaseConnection,
}

impl TaskScheduler {
    pub fn new(db: DatabaseConnection) -> Self {
        Self {
            scheduler: None,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            db,
        }
    }

    /// 启动任务调度器
    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Starting task scheduler...");

        // 创建任务调度器
        let scheduler = JobScheduler::new().await?;

        // 初始化默认任务
        self.initialize_default_tasks(&scheduler).await?;

        // 启动调度器
        scheduler.start().await?;

        self.scheduler = Some(scheduler);
        info!("Task scheduler started successfully");

        Ok(())
    }

    /// 停止任务调度器
    pub async fn stop(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(mut scheduler) = self.scheduler.take() {
            info!("Stopping task scheduler...");
            scheduler.shutdown().await?;
            info!("Task scheduler stopped");
        }
        Ok(())
    }

    /// 初始化默认任务
    async fn initialize_default_tasks(
        &self,
        scheduler: &JobScheduler,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // RSS 源刷新任务 - 每分钟检查一次，但根据设置决定是否执行
        self.add_task(
            "RSS Feed Refresh",
            TaskType::FeedRefresh,
            "0 * * * * *", // 每分钟执行一次检查
            scheduler,
        )
        .await?;

        // 图标缓存清理任务 - 每天凌晨2点执行
        self.add_task(
            "Icon Cache Cleanup",
            TaskType::IconCleanup,
            "0 0 2 * * *", // 每天凌晨2点0分0秒
            scheduler,
        )
        .await?;

        // 健康检查任务 - 每5分钟执行一次
        self.add_task(
            "Health Check",
            TaskType::HealthCheck,
            "0 */5 * * * *", // 每5分钟的0秒执行
            scheduler,
        )
        .await?;

        Ok(())
    }

    /// 添加新任务
    pub async fn add_task(
        &self,
        name: &str,
        task_type: TaskType,
        cron_expression: &str,
        scheduler: &JobScheduler,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let task_id = Uuid::new_v4().to_string();
        let db = self.db.clone();
        let tasks = self.tasks.clone();
        let task_name = name.to_string();
        let task_id_for_closure = task_id.clone();
        let task_type_for_closure = task_type;

        // 创建任务
        let job = Job::new_async(cron_expression, move |_uuid, _l| {
            let db = db.clone();
            let tasks = tasks.clone();
            let task_id = task_id_for_closure.clone();
            let task_name = task_name.clone();
            let task_type = task_type_for_closure;

            Box::pin(async move {
                let start_time = Utc::now();

                // 检查是否需要执行任务
                if let TaskType::FeedRefresh = task_type {
                    let settings_service = crate::services::user_settings_service::Service::new(db.clone());
                    if let Ok(settings) = settings_service.get_settings().await {
                        // 1. 检查自动刷新开关
                        if !settings.auto_refresh {
                            // 自动刷新已关闭，跳过
                            return;
                        }

                        // 2. 检查刷新间隔
                        let tasks_guard = tasks.read().await;
                        if let Some(task) = tasks_guard.get(&task_id) {
                            if let Some(last_run) = task.last_run {
                                let elapsed = start_time.signed_duration_since(last_run);
                                if elapsed.num_minutes() < settings.fetch_interval_minutes as i64 {
                                    // 还没到刷新时间，跳过
                                    return;
                                }
                            }
                        }
                    }
                }

                debug!("Executing task: {}", task_name);

                let result = match task_type {
                    TaskType::FeedRefresh => execute_feed_refresh_task(db.clone()).await,
                    TaskType::IconCleanup => execute_icon_cleanup_task(db.clone()).await,
                    TaskType::HealthCheck => execute_health_check_task(db.clone()).await,
                };

                // 更新任务统计
                let mut tasks_guard = tasks.write().await;
                if let Some(task) = tasks_guard.get_mut(&task_id) {
                    task.last_run = Some(start_time);
                    task.run_count += 1;

                    if result.success {
                        task.success_count += 1;
                        task.last_error = None;
                    } else {
                        task.error_count += 1;
                        task.last_error = Some(result.message.clone());
                    }
                }

                info!(
                    "Task {} completed in {}ms with success: {}",
                    task_name,
                    result.duration_ms.unwrap_or(0),
                    result.success
                );
            })
        })?;

        // 添加到调度器
        scheduler.add(job).await?;

        // 创建任务记录
        let task = ScheduledTask {
            id: task_id.clone(),
            name: name.to_string(),
            task_type,
            cron_expression: cron_expression.to_string(),
            enabled: true,
            last_run: None,
            next_run: None, // 可以根据 cron 表达式计算
            run_count: 0,
            success_count: 0,
            error_count: 0,
            last_error: None,
        };

        // 保存到内存
        let mut tasks_guard = self.tasks.write().await;
        tasks_guard.insert(task_id.clone(), task);

        info!("Added task '{}' with ID: {}", name, task_id);
        Ok(task_id)
    }

    /// 获取所有任务
    pub async fn get_tasks(&self) -> Vec<ScheduledTask> {
        let tasks_guard = self.tasks.read().await;
        tasks_guard.values().cloned().collect()
    }

    /// 获取任务执行历史
    pub async fn get_task_history(
        &self,
        _task_id: &str,
        _limit: Option<usize>,
    ) -> Vec<TaskExecutionResult> {
        // TODO: 实现任务历史记录功能
        vec![]
    }

    /// 启用/禁用任务
    pub async fn toggle_task(
        &self,
        task_id: &str,
        enabled: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut tasks_guard = self.tasks.write().await;
        if let Some(task) = tasks_guard.get_mut(task_id) {
            task.enabled = enabled;
            info!(
                "Task '{}' {}",
                task.name,
                if enabled { "enabled" } else { "disabled" }
            );
            Ok(())
        } else {
            Err(format!("Task with ID {} not found", task_id).into())
        }
    }

    /// 手动执行任务
    pub async fn execute_task_manually(
        &self,
        task_id: &str,
    ) -> Result<TaskExecutionResult, Box<dyn std::error::Error + Send + Sync>> {
        let tasks_guard = self.tasks.read().await;
        if let Some(task) = tasks_guard.get(task_id) {
            let start_time = Utc::now();
            info!("Manually executing task: {}", task.name);

            let result = match task.task_type {
                TaskType::FeedRefresh => execute_feed_refresh_task(self.db.clone()).await,
                TaskType::IconCleanup => execute_icon_cleanup_task(self.db.clone()).await,
                TaskType::HealthCheck => execute_health_check_task(self.db.clone()).await,
            };

            // 更新任务统计
            drop(tasks_guard);
            let mut tasks_guard = self.tasks.write().await;
            if let Some(task) = tasks_guard.get_mut(task_id) {
                task.last_run = Some(start_time);
                task.run_count += 1;

                if result.success {
                    task.success_count += 1;
                    task.last_error = None;
                } else {
                    task.error_count += 1;
                    task.last_error = Some(result.message.clone());
                }
            }

            Ok(result)
        } else {
            Err(format!("Task with ID {} not found", task_id).into())
        }
    }
}

// 任务执行函数
async fn execute_feed_refresh_task(db: DatabaseConnection) -> TaskExecutionResult {
    let start_time = Utc::now();

    // 获取所有需要刷新的 RSS 源
    match crate::models::feed::Entity::find()
        .filter(crate::models::feed::Column::ErrorCount.lt(5)) // 只刷新错误次数少于5次的源
        .all(&db)
        .await
    {
        Ok(feeds) => {
            let fetcher = match RSSFetcher::new(db.clone()) {
                Ok(fetcher) => fetcher,
                Err(e) => {
                    tracing::error!("Failed to create RSS fetcher: {}", e);
                    return TaskExecutionResult {
                        task_id: "feed_refresh".to_string(),
                        task_name: "RSS Feed Refresh".to_string(),
                        started_at: chrono::Utc::now(),
                        completed_at: Some(chrono::Utc::now()),
                        success: false,
                        message: format!("Failed to create RSS fetcher: {}", e),
                        duration_ms: Some(0),
                    };
                }
            };
            let mut success_count = 0;
            let mut error_count = 0;
            let feeds_count = feeds.len();

            for feed in feeds {
                match fetcher.fetch_feed(&feed.url).await {
                    Ok(_) => success_count += 1,
                    Err(e) => {
                        error_count += 1;
                        warn!("Failed to refresh feed {}: {}", feed.url, e);
                    }
                }
            }

            let completed_at = Utc::now();
            let duration = completed_at.signed_duration_since(start_time);

            TaskExecutionResult {
                task_id: "feed-refresh".to_string(),
                task_name: "RSS Feed Refresh".to_string(),
                started_at: start_time,
                completed_at: Some(completed_at),
                success: error_count == 0,
                message: format!(
                    "Refreshed {} feeds, {} successful, {} failed",
                    feeds_count, success_count, error_count
                ),
                duration_ms: Some(duration.num_milliseconds() as u64),
            }
        }
        Err(e) => {
            let completed_at = Utc::now();
            let duration = completed_at.signed_duration_since(start_time);

            TaskExecutionResult {
                task_id: "feed-refresh".to_string(),
                task_name: "RSS Feed Refresh".to_string(),
                started_at: start_time,
                completed_at: Some(completed_at),
                success: false,
                message: format!("Failed to fetch feeds: {}", e),
                duration_ms: Some(duration.num_milliseconds() as u64),
            }
        }
    }
}

async fn execute_icon_cleanup_task(db: DatabaseConnection) -> TaskExecutionResult {
    let start_time = Utc::now();

    let icon_service = IconService::new(db.clone());
    match icon_service.cleanup_expired_icons().await {
        Ok(deleted_count) => {
            let completed_at = Utc::now();
            let duration = completed_at.signed_duration_since(start_time);

            TaskExecutionResult {
                task_id: "icon-cleanup".to_string(),
                task_name: "Icon Cache Cleanup".to_string(),
                started_at: start_time,
                completed_at: Some(completed_at),
                success: true,
                message: format!("Cleaned up {} expired icons", deleted_count),
                duration_ms: Some(duration.num_milliseconds() as u64),
            }
        }
        Err(e) => {
            let completed_at = Utc::now();
            let duration = completed_at.signed_duration_since(start_time);

            TaskExecutionResult {
                task_id: "icon-cleanup".to_string(),
                task_name: "Icon Cache Cleanup".to_string(),
                started_at: start_time,
                completed_at: Some(completed_at),
                success: false,
                message: format!("Failed to cleanup icons: {}", e),
                duration_ms: Some(duration.num_milliseconds() as u64),
            }
        }
    }
}

async fn execute_health_check_task(db: DatabaseConnection) -> TaskExecutionResult {
    let start_time = Utc::now();

    // 检查数据库连接
    let db_healthy = crate::database::health_check(&db).await.is_ok();

    // 检查服务器状态
    let memory_usage = get_memory_usage();

    let completed_at = Utc::now();
    let duration = completed_at.signed_duration_since(start_time);

    TaskExecutionResult {
        task_id: "health-check".to_string(),
        task_name: "Health Check".to_string(),
        started_at: start_time,
        completed_at: Some(completed_at),
        success: db_healthy,
        message: format!(
            "Database: {}, Memory: {} MB",
            if db_healthy { "OK" } else { "ERROR" },
            memory_usage
        ),
        duration_ms: Some(duration.num_milliseconds() as u64),
    }
}

fn get_memory_usage() -> u64 {
    // 简单的内存使用估算（实际应用中可以使用更精确的方法）

    // 这里只是示例，实际应该使用系统调用来获取真实的内存使用情况
    0 // 占位符
}
