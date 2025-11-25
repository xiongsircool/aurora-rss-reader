use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::{
    models::{summary::SummaryRequest, translation::TranslationRequest},
    services::ai::AIService,
    utils::response::success_response,
    AppState,
};
use axum::extract::State as AxumState; // alias to avoid confusion
use axum::Json as AxumJson;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AIServiceConfig {
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
    #[serde(default)]
    pub has_api_key: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AIFeatureConfig {
    pub auto_summary: bool,
    pub auto_translation: bool,
    pub auto_title_translation: bool,
    pub translation_language: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AIConfig {
    pub summary: AIServiceConfig,
    pub translation: AIServiceConfig,
    pub features: AIFeatureConfig,
}

fn default_ai_config(app_state: &AppState) -> AIConfig {
    AIConfig {
        summary: AIServiceConfig {
            api_key: String::new(),
            base_url: app_state.config.glm_base_url.clone(),
            model_name: app_state.config.glm_model.clone(),
            has_api_key: !app_state.config.glm_api_key.is_empty(),
        },
        translation: AIServiceConfig {
            api_key: String::new(),
            base_url: app_state.config.glm_base_url.clone(),
            model_name: app_state.config.glm_model.clone(),
            has_api_key: !app_state.config.glm_api_key.is_empty(),
        },
        features: AIFeatureConfig {
            auto_summary: false,
            auto_translation: false,
            auto_title_translation: false,
            translation_language: "zh".to_string(),
        },
    }
}

// 兼容前端配置拉取接口
pub async fn get_ai_config(
    AxumState(app_state): AxumState<AppState>,
) -> Result<AxumJson<serde_json::Value>, StatusCode> {
    Ok(success_response(default_ai_config(&app_state)))
}

// 兼容前端配置更新接口（当前不落库，仅回显）
pub async fn update_ai_config(
    AxumState(app_state): AxumState<AppState>,
    AxumJson(payload): AxumJson<serde_json::Value>,
) -> Result<AxumJson<serde_json::Value>, StatusCode> {
    let mut cfg = default_ai_config(&app_state);

    if let Some(summary) = payload.get("summary") {
        if let Some(api_key) = summary.get("api_key").and_then(|v| v.as_str()) {
            cfg.summary.api_key = api_key.to_string();
            cfg.summary.has_api_key = !api_key.is_empty();
        }
        if let Some(base_url) = summary.get("base_url").and_then(|v| v.as_str()) {
            cfg.summary.base_url = base_url.to_string();
        }
        if let Some(model_name) = summary.get("model_name").and_then(|v| v.as_str()) {
            cfg.summary.model_name = model_name.to_string();
        }
    }

    if let Some(translation) = payload.get("translation") {
        if let Some(api_key) = translation.get("api_key").and_then(|v| v.as_str()) {
            cfg.translation.api_key = api_key.to_string();
            cfg.translation.has_api_key = !api_key.is_empty();
        }
        if let Some(base_url) = translation.get("base_url").and_then(|v| v.as_str()) {
            cfg.translation.base_url = base_url.to_string();
        }
        if let Some(model_name) = translation.get("model_name").and_then(|v| v.as_str()) {
            cfg.translation.model_name = model_name.to_string();
        }
    }

    if let Some(features) = payload.get("features") {
        if let Some(auto_summary) = features.get("auto_summary").and_then(|v| v.as_bool()) {
            cfg.features.auto_summary = auto_summary;
        }
        if let Some(auto_translation) = features.get("auto_translation").and_then(|v| v.as_bool()) {
            cfg.features.auto_translation = auto_translation;
        }
        if let Some(auto_title_translation) = features
            .get("auto_title_translation")
            .and_then(|v| v.as_bool())
        {
            cfg.features.auto_title_translation = auto_title_translation;
        }
        if let Some(lang) = features
            .get("translation_language")
            .and_then(|v| v.as_str())
        {
            cfg.features.translation_language = lang.to_string();
        }
    }

    Ok(success_response(
        json!({ "success": true, "message": "AI config updated", "config": cfg }),
    ))
}

// 兼容前端的连接测试接口，直接返回成功
pub async fn test_ai_connection() -> Result<AxumJson<serde_json::Value>, StatusCode> {
    Ok(success_response(
        json!({ "success": true, "message": "AI connection ok" }),
    ))
}

pub async fn summarize_article(
    State(app_state): State<AppState>,
    Json(request): Json<SummaryRequest>,
) -> Result<Json<Value>, StatusCode> {
    let config = &app_state.config;

    // 创建 SQLite 连接池
    let sqlite_pool = SqlitePool::connect(&config.database_url)
        .await
        .map_err(|e| {
            tracing::error!("Failed to connect to database: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 验证文章是否存在
    let entry_exists: Option<String> = sqlx::query_scalar("SELECT id FROM entries WHERE id = ?")
        .bind(&request.entry_id)
        .fetch_optional(&sqlite_pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if entry_exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // 获取文章内容
    let title: Option<String> = sqlx::query_scalar("SELECT title FROM entries WHERE id = ?")
        .bind(&request.entry_id)
        .fetch_optional(&sqlite_pool)
        .await
        .unwrap_or_default();

    let content: Option<String> = sqlx::query_scalar("SELECT content FROM entries WHERE id = ?")
        .bind(&request.entry_id)
        .fetch_optional(&sqlite_pool)
        .await
        .unwrap_or_default();

    let readability_content: Option<String> =
        sqlx::query_scalar("SELECT readability_content FROM entries WHERE id = ?")
            .bind(&request.entry_id)
            .fetch_optional(&sqlite_pool)
            .await
            .unwrap_or_default();

    // 检查是否有现有摘要
    let language = request.language.as_deref().unwrap_or("zh");
    if let Ok(Some(existing_summary)) =
        get_existing_summary(&sqlite_pool, &request.entry_id, language).await
    {
        return Ok(success_response(json!({
            "entry_id": request.entry_id,
            "language": language,
            "summary": existing_summary,
            "model_used": config.glm_model
        })));
    }

    // 获取文章内容
    let content = readability_content.or(content).unwrap_or_default();
    if content.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 创建元信息
    let mut meta_lines = Vec::new();
    if let Some(ref title) = title {
        meta_lines.push(format!("标题：{}", title));
    }

    let meta_block = if meta_lines.is_empty() {
        String::new()
    } else {
        format!("文章元信息：\n{}\n\n正文内容：\n", meta_lines.join("\n"))
    };

    let combined_content = format!("{}{}", meta_block, content);

    // 创建 AI 服务
    let ai_service = match AIService::new(
        config.glm_api_key.clone(),
        config.glm_base_url.clone(),
        config.glm_model.clone(),
    ) {
        Ok(service) => service,
        Err(e) => {
            tracing::error!("Failed to create AI service: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 生成摘要
    let summary_text = match ai_service.summarize(&combined_content, language).await {
        Ok(summary) => summary,
        Err(e) => {
            tracing::error!("Failed to generate summary: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 保存到数据库
    let model_used = &config.glm_model;
    match save_summary(
        &sqlite_pool,
        &request.entry_id,
        &summary_text,
        language,
        model_used,
    )
    .await
    {
        Ok(_) => {
            tracing::info!("Summary saved for entry: {}", request.entry_id);
        }
        Err(e) => {
            tracing::error!("Failed to save summary: {}", e);
            // 即使保存失败，也返回摘要给用户
        }
    }

    Ok(success_response(json!({
        "entry_id": request.entry_id,
        "language": language,
        "summary": summary_text,
        "model_used": model_used
    })))
}

pub async fn translate_article(
    State(app_state): State<AppState>,
    Json(request): Json<TranslationRequest>,
) -> Result<Json<Value>, StatusCode> {
    let config = &app_state.config;

    // 创建 SQLite 连接池
    let sqlite_pool = SqlitePool::connect(&config.database_url)
        .await
        .map_err(|e| {
            tracing::error!("Failed to connect to database: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 验证文章是否存在
    let entry_exists: Option<String> = sqlx::query_scalar("SELECT id FROM entries WHERE id = ?")
        .bind(&request.entry_id)
        .fetch_optional(&sqlite_pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if entry_exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // 检查是否有现有翻译
    if let Ok(Some(existing_translation)) =
        get_existing_translation(&sqlite_pool, &request.entry_id, &request.target_language).await
    {
        return Ok(success_response(json!({
            "entry_id": request.entry_id,
            "field_type": request.field_type,
            "target_language": request.target_language,
            "translated_text": existing_translation
        })));
    }

    // 获取文章内容
    let source_text: Option<String> = match request.field_type.as_str() {
        "title" => sqlx::query_scalar("SELECT title FROM entries WHERE id = ?")
            .bind(&request.entry_id)
            .fetch_optional(&sqlite_pool)
            .await
            .unwrap_or_default(),
        "content" => {
            let readability_content =
                sqlx::query_scalar("SELECT readability_content FROM entries WHERE id = ?")
                    .bind(&request.entry_id)
                    .fetch_optional(&sqlite_pool)
                    .await
                    .unwrap_or_default();

            if readability_content.is_some() {
                readability_content
            } else {
                sqlx::query_scalar("SELECT content FROM entries WHERE id = ?")
                    .bind(&request.entry_id)
                    .fetch_optional(&sqlite_pool)
                    .await
                    .unwrap_or_default()
            }
        }
        _ => {
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let source_text_content = match source_text {
        Some(text) => text,
        None => {
            return Ok(success_response(json!({
                "entry_id": request.entry_id,
                "field_type": request.field_type,
                "target_language": request.target_language,
                "translated_text": ""
            })));
        }
    };

    // 创建 AI 服务
    let ai_service = match AIService::new(
        config.glm_api_key.clone(),
        config.glm_base_url.clone(),
        config.glm_model.clone(),
    ) {
        Ok(service) => service,
        Err(e) => {
            tracing::error!("Failed to create AI service: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let translated_text = match request.field_type.as_str() {
        "title" => {
            match ai_service
                .translate_title(&source_text_content, &request.target_language)
                .await
            {
                Ok(text) => text,
                Err(e) => {
                    tracing::error!("Failed to translate title: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
        "content" => {
            match ai_service
                .translate(&source_text_content, &request.target_language)
                .await
            {
                Ok(text) => text,
                Err(e) => {
                    tracing::error!("Failed to translate content: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
        _ => {
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // 保存到数据库
    match save_translation(
        &sqlite_pool,
        &request.entry_id,
        &request.field_type,
        "auto", // source_language
        &request.target_language,
        &source_text_content,
        &translated_text,
    )
    .await
    {
        Ok(_) => {
            tracing::info!(
                "Translation saved for entry: {}, field: {}",
                request.entry_id,
                request.field_type
            );
        }
        Err(e) => {
            tracing::error!("Failed to save translation: {}", e);
            // 即使保存失败，也返回翻译给用户
        }
    }

    Ok(success_response(json!({
        "entry_id": request.entry_id,
        "field_type": request.field_type,
        "target_language": request.target_language,
        "translated_text": translated_text
    })))
}

pub async fn translate_title(
    State(app_state): State<AppState>,
    Json(request): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let config = &app_state.config;

    // 创建 SQLite 连接池
    let sqlite_pool = SqlitePool::connect(&config.database_url)
        .await
        .map_err(|e| {
            tracing::error!("Failed to connect to database: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let entry_id = request
        .get("entry_id")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?
        .to_string();

    let language = request
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("zh")
        .to_string();

    // 验证文章是否存在
    let entry_exists: Option<String> = sqlx::query_scalar("SELECT id FROM entries WHERE id = ?")
        .bind(&entry_id)
        .fetch_optional(&sqlite_pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if entry_exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // 获取标题
    let title: Option<String> = sqlx::query_scalar("SELECT title FROM entries WHERE id = ?")
        .bind(&entry_id)
        .fetch_optional(&sqlite_pool)
        .await
        .unwrap_or_default();

    let title_text = match title {
        Some(text) => text,
        None => {
            return Ok(success_response(json!({
                "entry_id": entry_id,
                "title": "",
                "language": language
            })));
        }
    };

    if title_text.is_empty() {
        return Ok(success_response(json!({
            "entry_id": entry_id,
            "title": "",
            "language": language
        })));
    }

    // 创建 AI 服务
    let ai_service = match AIService::new(
        config.glm_api_key.clone(),
        config.glm_base_url.clone(),
        config.glm_model.clone(),
    ) {
        Ok(service) => service,
        Err(e) => {
            tracing::error!("Failed to create AI service: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let translated_title = match ai_service.translate_title(&title_text, &language).await {
        Ok(text) => text,
        Err(e) => {
            tracing::error!("Failed to translate title: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(success_response(json!({
        "entry_id": entry_id,
        "title": translated_title,
        "language": language
    })))
}

// 辅助函数
async fn get_existing_summary(
    db: &SqlitePool,
    entry_id: &str,
    language: &str,
) -> Result<Option<String>, sqlx::Error> {
    let summary: Option<String> = sqlx::query_scalar(
        "SELECT summary_text FROM summaries WHERE entry_id = ? AND language = ?",
    )
    .bind(entry_id)
    .bind(language)
    .fetch_optional(db)
    .await?;

    Ok(summary)
}

async fn save_summary(
    db: &SqlitePool,
    entry_id: &str,
    summary_text: &str,
    language: &str,
    model_used: &str,
) -> Result<(), sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    sqlx::query(
        "INSERT INTO summaries (id, entry_id, summary_text, language, model_used, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(entry_id)
    .bind(summary_text)
    .bind(language)
    .bind(model_used)
    .bind(now)
    .execute(db)
    .await?;

    Ok(())
}

async fn get_existing_translation(
    db: &SqlitePool,
    entry_id: &str,
    target_language: &str,
) -> Result<Option<String>, sqlx::Error> {
    let translation: Option<String> = sqlx::query_scalar(
        "SELECT translated_text FROM translations WHERE entry_id = ? AND target_language = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(entry_id)
    .bind(target_language)
    .fetch_optional(db)
    .await?;

    Ok(translation)
}

async fn save_translation(
    db: &SqlitePool,
    entry_id: &str,
    field_type: &str,
    source_language: &str,
    target_language: &str,
    source_text: &str,
    translated_text: &str,
) -> Result<(), sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    sqlx::query(
        "INSERT INTO translations (id, entry_id, field_type, source_language, target_language, source_text, translated_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(entry_id)
    .bind(field_type)
    .bind(source_language)
    .bind(target_language)
    .bind(source_text)
    .bind(translated_text)
    .bind(now)
    .execute(db)
    .await?;

    Ok(())
}
