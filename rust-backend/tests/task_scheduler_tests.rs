use sea_orm::{ActiveModelTrait, Set};
use tokio_cron_scheduler::{Job, JobScheduler};

mod common;

use common::{create_test_app_state, TestFeedData};
use rss_backend::models::feed;
use rss_backend::services::task_scheduler::{TaskScheduler, TaskType};

/// 测试任务调度器启动和停止
#[tokio::test]
async fn test_task_scheduler_start_stop() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 测试启动
    assert!(scheduler.start().await.is_ok());

    // 测试停止
    assert!(scheduler.stop().await.is_ok());
}

/// 测试获取任务列表
#[tokio::test]
async fn test_get_tasks() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 启动调度器以初始化默认任务
    scheduler.start().await.unwrap();

    let tasks = scheduler.get_tasks().await;

    // 应该有3个默认任务：RSS Feed Refresh, Icon Cache Cleanup, Health Check
    assert_eq!(tasks.len(), 3);

    // 验证任务类型
    let task_types: Vec<_> = tasks.iter().map(|t| t.task_type).collect();
    assert!(task_types.contains(&TaskType::FeedRefresh));
    assert!(task_types.contains(&TaskType::IconCleanup));
    assert!(task_types.contains(&TaskType::HealthCheck));

    // 验证所有任务都是启用状态
    assert!(tasks.iter().all(|t| t.enabled));

    scheduler.stop().await.unwrap();
}

/// 测试手动执行健康检查任务
#[tokio::test]
async fn test_manual_health_check_execution() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 启动调度器
    scheduler.start().await.unwrap();

    // 获取健康检查任务的ID
    let tasks = scheduler.get_tasks().await;
    let health_task = tasks.iter()
        .find(|t| matches!(t.task_type, TaskType::HealthCheck))
        .unwrap();

    // 手动执行健康检查任务
    let result = scheduler.execute_task_manually(&health_task.id).await.unwrap();

    // 验证执行结果
    assert!(result.success);
    assert_eq!(result.task_name, "Health Check");
    assert!(result.completed_at.is_some());
    assert!(result.duration_ms.is_some());
    assert!(result.message.contains("Database"));

    scheduler.stop().await.unwrap();
}

/// 测试手动执行图标清理任务
#[tokio::test]
async fn test_manual_icon_cleanup_execution() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 启动调度器
    scheduler.start().await.unwrap();

    // 获取图标清理任务的ID
    let tasks = scheduler.get_tasks().await;
    let cleanup_task = tasks.iter()
        .find(|t| matches!(t.task_type, TaskType::IconCleanup))
        .unwrap();

    // 手动执行图标清理任务
    let result = scheduler.execute_task_manually(&cleanup_task.id).await.unwrap();

    // 验证执行结果
    assert!(result.success);
    assert_eq!(result.task_name, "Icon Cache Cleanup");
    assert!(result.completed_at.is_some());
    assert!(result.duration_ms.is_some());
    assert!(result.message.contains("Cleaned up"));

    scheduler.stop().await.unwrap();
}

/// 测试手动执行RSS源刷新任务
#[tokio::test]
async fn test_manual_feed_refresh_execution() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 先创建一个测试RSS源
    let test_feed = TestFeedData::new();
    let feed_model = feed::ActiveModel {
        id: Set(test_feed.id.clone()),
        title: Set(test_feed.title.clone()),
        url: Set(test_feed.url.clone()),
        category: Set(test_feed.category.clone()),
        ..Default::default()
    };
    feed_model.insert(&*db).await.unwrap();

    // 启动调度器
    scheduler.start().await.unwrap();

    // 获取RSS源刷新任务的ID
    let tasks = scheduler.get_tasks().await;
    let refresh_task = tasks.iter()
        .find(|t| matches!(t.task_type, TaskType::FeedRefresh))
        .unwrap();

    // 手动执行RSS源刷新任务
    let result = scheduler.execute_task_manually(&refresh_task.id).await.unwrap();

    // 验证执行结果
    // 注意：由于使用的是假URL，可能会失败，但任务应该能够执行
    assert!(result.completed_at.is_some());
    assert!(result.duration_ms.is_some());
    assert_eq!(result.task_name, "RSS Feed Refresh");
    assert!(result.message.contains("Refreshed"));

    scheduler.stop().await.unwrap();
}

/// 测试任务启用/禁用
#[tokio::test]
async fn test_toggle_task() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 启动调度器
    scheduler.start().await.unwrap();

    // 获取任意一个任务
    let tasks = scheduler.get_tasks().await;
    let test_task = &tasks[0];

    // 禁用任务
    assert!(scheduler.toggle_task(&test_task.id, false).await.is_ok());

    // 验证任务已被禁用
    let updated_tasks = scheduler.get_tasks().await;
    let updated_task = updated_tasks.iter()
        .find(|t| t.id == test_task.id)
        .unwrap();
    assert!(!updated_task.enabled);

    // 重新启用任务
    assert!(scheduler.toggle_task(&test_task.id, true).await.is_ok());

    // 验证任务已重新启用
    let final_tasks = scheduler.get_tasks().await;
    let final_task = final_tasks.iter()
        .find(|t| t.id == test_task.id)
        .unwrap();
    assert!(final_task.enabled);

    scheduler.stop().await.unwrap();
}

/// 测试任务统计更新
#[tokio::test]
async fn test_task_statistics_update() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 启动调度器
    scheduler.start().await.unwrap();

    // 获取健康检查任务
    let tasks = scheduler.get_tasks().await;
    let health_task = tasks.iter()
        .find(|t| matches!(t.task_type, TaskType::HealthCheck))
        .unwrap();

    // 记录初始统计
    assert_eq!(health_task.run_count, 0);
    assert_eq!(health_task.success_count, 0);
    assert_eq!(health_task.error_count, 0);
    assert!(health_task.last_run.is_none());

    // 手动执行任务
    scheduler.execute_task_manually(&health_task.id).await.unwrap();

    // 验证统计已更新
    let updated_tasks = scheduler.get_tasks().await;
    let updated_task = updated_tasks.iter()
        .find(|t| t.id == health_task.id)
        .unwrap();

    assert_eq!(updated_task.run_count, 1);
    assert_eq!(updated_task.success_count, 1);
    assert_eq!(updated_task.error_count, 0);
    assert!(updated_task.last_run.is_some());

    scheduler.stop().await.unwrap();
}

/// 测试执行不存在的任务
#[tokio::test]
async fn test_execute_nonexistent_task() {
    let db = common::get_test_db().await;
    let scheduler = TaskScheduler::new((*db).clone());

    let fake_id = uuid::Uuid::new_v4().to_string();

    // 尝试执行不存在的任务
    let result = scheduler.execute_task_manually(&fake_id).await;

    assert!(result.is_err());
}

/// 测试启用/禁用不存在的任务
#[tokio::test]
async fn test_toggle_nonexistent_task() {
    let db = common::get_test_db().await;
    let scheduler = TaskScheduler::new((*db).clone());

    let fake_id = uuid::Uuid::new_v4().to_string();

    // 尝试启用不存在的任务
    let result = scheduler.toggle_task(&fake_id, true).await;

    assert!(result.is_err());
}

/// 测试任务历史记录（虽然当前实现返回空数组）
#[tokio::test]
async fn test_get_task_history() {
    let db = common::get_test_db().await;
    let mut scheduler = TaskScheduler::new((*db).clone());

    // 启动调度器
    scheduler.start().await.unwrap();

    // 获取任意一个任务
    let tasks = scheduler.get_tasks().await;
    let test_task = &tasks[0];

    // 获取任务历史
    let history = scheduler.get_task_history(&test_task.id, Some(10)).await;

    // 当前实现返回空数组
    assert!(history.is_empty());

    scheduler.stop().await.unwrap();
}