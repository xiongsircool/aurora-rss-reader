use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use tracing::{error, info};

use crate::utils::response::{success_response, success_response_with_message};
use crate::AppState;

// 获取所有任务
pub async fn get_tasks(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let scheduler_guard = app_state.task_scheduler.lock().await;
    let tasks = scheduler_guard.get_tasks().await;
    Ok(success_response(tasks))
}

// 获取任务历史
pub async fn get_task_history(
    Path(task_id): Path<String>,
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let scheduler_guard = app_state.task_scheduler.lock().await;
    let history = scheduler_guard.get_task_history(&task_id, None).await;
    Ok(success_response_with_message(
        history,
        &format!("History for task {}", task_id),
    ))
}

// 手动执行任务
pub async fn execute_task(
    Path(task_id): Path<String>,
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let scheduler_guard = app_state.task_scheduler.lock().await;
    match scheduler_guard.execute_task_manually(&task_id).await {
        Ok(result) => {
            info!("Task {} executed successfully: {}", task_id, result.message);
            Ok(success_response_with_message(
                result,
                &format!("Task {} executed", task_id),
            ))
        }
        Err(e) => {
            error!("Failed to execute task {}: {}", task_id, e);
            Ok(success_response_with_message(
                serde_json::json!({"error": e.to_string()}),
                &format!("Failed to execute task {}", task_id),
            ))
        }
    }
}

// 启用/禁用任务
pub async fn toggle_task(
    Path(task_id): Path<String>,
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 这里需要从请求中获取启用状态，现在简化为禁用
    let enabled = false; // 可以从请求体或查询参数中获取

    let scheduler_guard = app_state.task_scheduler.lock().await;
    match scheduler_guard.toggle_task(&task_id, enabled).await {
        Ok(()) => {
            info!(
                "Task {} {} successfully",
                task_id,
                if enabled { "enabled" } else { "disabled" }
            );
            Ok(success_response_with_message(
                serde_json::json!({"task_id": task_id, "enabled": enabled}),
                &format!(
                    "Task {} {}",
                    task_id,
                    if enabled { "enabled" } else { "disabled" }
                ),
            ))
        }
        Err(e) => {
            error!("Failed to toggle task {}: {}", task_id, e);
            Ok(success_response_with_message(
                serde_json::json!({"error": e.to_string()}),
                &format!("Failed to toggle task {}", task_id),
            ))
        }
    }
}

// 获取系统健康状态
pub async fn get_health_status(
    State(app_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let db_healthy = crate::database::health_check(&app_state.db).await.is_ok();

    let health_info = serde_json::json!({
        "status": if db_healthy { "healthy" } else { "unhealthy" },
        "database": if db_healthy { "connected" } else { "error" },
        "timestamp": chrono::Utc::now(),
        "uptime": "N/A", // 需要实现启动时间跟踪
    });

    if db_healthy {
        Ok(success_response(health_info))
    } else {
        error!("Database health check failed");
        Ok(success_response_with_message(
            health_info,
            "Database connection failed",
        ))
    }
}
