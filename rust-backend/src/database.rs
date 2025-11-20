use sea_orm::{Database, DatabaseConnection, DbErr, ConnectionTrait};
use std::sync::Arc;
use crate::config::Config;
use crate::models::user_settings;

pub mod migrations;

#[allow(dead_code)]
pub type DbConnection = Arc<DatabaseConnection>;

pub async fn establish_connection(config: &Config) -> Result<DatabaseConnection, DbErr> {
    // Ensure data directory exists. The database_url uses the `sqlite:` URL scheme,
    // so we need to extract the actual filesystem path before creating directories.
    if let Some(db_path) = config
        .database_url
        .strip_prefix("sqlite://")
        .or_else(|| config.database_url.strip_prefix("sqlite:"))
    {
        if let Some(parent) = std::path::Path::new(db_path).parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| DbErr::Custom(format!("Failed to create data directory: {}", e)))?;
        }
    }

    let db = Database::connect(&config.database_url).await?;

    // Run migrations
    migrations::run_migrations(&db).await?;

    // Initialize default data
    init_default_data(&db).await?;

    Ok(db)
}

async fn init_default_data(db: &DatabaseConnection) -> Result<(), DbErr> {
    use sea_orm::{ActiveModelTrait, EntityTrait, Set};

    // Initialize default user settings if not exists
    let existing_settings = user_settings::Entity::find().one(db).await?;

    if existing_settings.is_none() {
        let default_settings = user_settings::ActiveModel {
            id: Set(1),
            rsshub_url: Set("https://rsshub.app".to_string()),
            fetch_interval_minutes: Set(720), // 12 hours
            auto_refresh: Set(true),
            show_description: Set(true),
            items_per_page: Set(50),
            show_entry_summary: Set(true),
            max_auto_title_translations: Set(6),
            translation_display_mode: Set("replace".to_string()),
            enable_date_filter: Set(true),
            default_date_range: Set("30d".to_string()),
            time_field: Set("inserted_at".to_string()),
            default_language: Set("zh-CN".to_string()),
            theme: Set(Some("light".to_string())),
            auto_mark_read: Set(Some(false)),
            show_read_entries: Set(Some(true)),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
        };

        default_settings.insert(db).await?;
        tracing::info!("Initialized default user settings");
    }

    // Initialize default RSSHub configurations
    // Note: We'll skip auto-initialization for now to avoid the RecordNotFound issue
    // Users can create RSSHub configs via the API instead
    tracing::info!("RSSHub configurations initialization skipped");

    Ok(())
}

pub async fn health_check(db: &DatabaseConnection) -> Result<(), DbErr> {
    use sea_orm::Statement;
    use sea_orm::DatabaseBackend;

    let stmt = Statement::from_string(
        DatabaseBackend::Sqlite,
        "SELECT 1".to_string(),
    );

    db.query_one(stmt).await?;
    Ok(())
}
