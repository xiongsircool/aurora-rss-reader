use sea_orm::{DbErr, Statement, DatabaseConnection, ConnectionTrait};

pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Create feeds table
    let feeds_sql = r#"
    CREATE TABLE IF NOT EXISTS feeds (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        category TEXT,
        favicon TEXT,
        update_interval INTEGER,
        last_updated DATETIME,
        last_status TEXT,
        error_count INTEGER DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, feeds_sql.to_string());
    db.execute(stmt).await?;
    tracing::info!("Created feeds table");

    // Create entries table
    let entries_sql = r#"
    CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        feed_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        author TEXT,
        content TEXT,
        summary TEXT,
        published_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE,
        is_starred BOOLEAN DEFAULT FALSE,
        reading_time INTEGER,
        word_count INTEGER,
        FOREIGN KEY (feed_id) REFERENCES feeds (id) ON DELETE CASCADE,
        UNIQUE(feed_id, url)
    )
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, entries_sql.to_string());
    db.execute(stmt).await?;

    // Create indexes for entries
    let indexes = vec![
        "CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries (feed_id)",
        "CREATE INDEX IF NOT EXISTS idx_entries_is_read ON entries (is_read)",
        "CREATE INDEX IF NOT EXISTS idx_entries_is_starred ON entries (is_starred)",
        "CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries (published_at)",
    ];

    for index_sql in indexes {
        let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, index_sql.to_string());
        db.execute(stmt).await?;
    }

    tracing::info!("Created entries table and indexes");

    // Create user_settings table
    let settings_sql = r#"
    CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY,
        rsshub_url TEXT NOT NULL DEFAULT 'https://rsshub.app',
        fetch_interval_minutes INTEGER NOT NULL DEFAULT 720,
        auto_refresh BOOLEAN NOT NULL DEFAULT TRUE,
        show_description BOOLEAN NOT NULL DEFAULT TRUE,
        items_per_page INTEGER NOT NULL DEFAULT 50,
        show_entry_summary BOOLEAN NOT NULL DEFAULT TRUE,
        max_auto_title_translations INTEGER NOT NULL DEFAULT 6,
        translation_display_mode TEXT NOT NULL DEFAULT 'replace',
        enable_date_filter BOOLEAN NOT NULL DEFAULT TRUE,
        default_date_range TEXT NOT NULL DEFAULT '30d',
        time_field TEXT NOT NULL DEFAULT 'inserted_at',
        default_language TEXT NOT NULL DEFAULT 'zh-CN',
        theme TEXT,
        auto_mark_read BOOLEAN,
        show_read_entries BOOLEAN,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, settings_sql.to_string());
    db.execute(stmt).await?;
    tracing::info!("Created user_settings table");

    // Add missing columns to user_settings table for backward compatibility
    let user_settings_migrations = vec![
        "ALTER TABLE user_settings ADD COLUMN rsshub_url TEXT DEFAULT 'https://rsshub.app'",
        "ALTER TABLE user_settings ADD COLUMN auto_refresh BOOLEAN DEFAULT TRUE",
        "ALTER TABLE user_settings ADD COLUMN show_description BOOLEAN DEFAULT TRUE",
        "ALTER TABLE user_settings ADD COLUMN items_per_page INTEGER DEFAULT 50",
        "ALTER TABLE user_settings ADD COLUMN show_entry_summary BOOLEAN DEFAULT TRUE",
        "ALTER TABLE user_settings ADD COLUMN max_auto_title_translations INTEGER DEFAULT 6",
        "ALTER TABLE user_settings ADD COLUMN translation_display_mode TEXT DEFAULT 'replace'",
        "ALTER TABLE user_settings ADD COLUMN enable_date_filter BOOLEAN DEFAULT TRUE",
        "ALTER TABLE user_settings ADD COLUMN default_date_range TEXT DEFAULT '30d'",
        "ALTER TABLE user_settings ADD COLUMN time_field TEXT DEFAULT 'inserted_at'",
    ];

    for migration_sql in user_settings_migrations {
        if let Err(_) = db.execute(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            migration_sql.to_string(),
        )).await {
            // Column probably already exists, which is fine
            tracing::info!("User settings column already exists or could not be added");
        } else {
            tracing::info!("Added column to user_settings table");
        }
    }

    // Create summaries table
    let summaries_sql = r#"
    CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        summary_text TEXT NOT NULL,
        language TEXT NOT NULL,
        model_used TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE,
        UNIQUE(entry_id, language)
    )
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, summaries_sql.to_string());
    db.execute(stmt).await?;
    tracing::info!("Created summaries table");

    // Create translations table
    let translations_sql = r#"
    CREATE TABLE IF NOT EXISTS translations (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        field_type TEXT NOT NULL,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        source_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE
    )
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, translations_sql.to_string());
    db.execute(stmt).await?;
    tracing::info!("Created translations table");

    // Create indexes for AI tables
    let ai_indexes = vec![
        "CREATE INDEX IF NOT EXISTS idx_summaries_entry_id ON summaries (entry_id)",
        "CREATE INDEX IF NOT EXISTS idx_summaries_language ON summaries (language)",
        "CREATE INDEX IF NOT EXISTS idx_translations_entry_id ON translations (entry_id)",
        "CREATE INDEX IF NOT EXISTS idx_translations_target_language ON translations (target_language)",
        "CREATE INDEX IF NOT EXISTS idx_translations_field_type ON translations (field_type)",
    ];

    for index_sql in ai_indexes {
        let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, index_sql.to_string());
        db.execute(stmt).await?;
    }

    // Add readability_content column to entries table
    let readability_sql = r#"
    ALTER TABLE entries ADD COLUMN readability_content TEXT
    "#;

    // Try to add the column, but ignore if it already exists
    if let Err(_) = db.execute(Statement::from_string(
        sea_orm::DatabaseBackend::Sqlite,
        readability_sql.to_string(),
    )).await {
        // Column probably already exists, which is fine
        tracing::info!("readability_content column already exists or could not be added");
    } else {
        tracing::info!("Added readability_content column to entries table");
    }

    // Create rsshub_configs table
    let rsshub_configs_sql = r#"
    CREATE TABLE IF NOT EXISTS rsshub_configs (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        priority INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_tested DATETIME,
        response_time INTEGER,
        error_count INTEGER DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, rsshub_configs_sql.to_string());
    db.execute(stmt).await?;
    tracing::info!("Created rsshub_configs table");

    // Create indexes for rsshub_configs
    let rsshub_indexes = vec![
        "CREATE INDEX IF NOT EXISTS idx_rsshub_configs_is_active ON rsshub_configs (is_active)",
        "CREATE INDEX IF NOT EXISTS idx_rsshub_configs_priority ON rsshub_configs (priority)",
    ];

    for index_sql in rsshub_indexes {
        let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, index_sql.to_string());
        db.execute(stmt).await?;
    }

    // Create site_icons table
    let site_icons_sql = r#"
    CREATE TABLE IF NOT EXISTS site_icons (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        icon_url TEXT,
        icon_data TEXT,
        icon_type TEXT,
        icon_size INTEGER,
        last_fetched DATETIME,
        expires_at DATETIME,
        error_count INTEGER DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, site_icons_sql.to_string());
    db.execute(stmt).await?;
    tracing::info!("Created site_icons table");

    // Create indexes for site_icons
    let site_icon_indexes = vec![
        "CREATE INDEX IF NOT EXISTS idx_site_icons_domain ON site_icons (domain)",
        "CREATE INDEX IF NOT EXISTS idx_site_icons_expires_at ON site_icons (expires_at)",
    ];

    for index_sql in site_icon_indexes {
        let stmt = Statement::from_string(sea_orm::DatabaseBackend::Sqlite, index_sql.to_string());
        db.execute(stmt).await?;
    }

    tracing::info!("All migrations completed successfully");
    Ok(())
}