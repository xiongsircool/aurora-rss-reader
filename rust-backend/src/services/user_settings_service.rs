use sea_orm::{
    ActiveModelTrait, DatabaseConnection, EntityTrait, Set,
};
use tracing::info;

use crate::models::user_settings::{
    Entity as UserSettings, ActiveModel, Model, UpdateUserSettingsRequest,
};

pub struct Service {
    db: DatabaseConnection,
}

impl Service {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Get user settings (always returns the first record, creating default if needed)
    pub async fn get_settings(&self) -> Result<Model, Box<dyn std::error::Error + Send + Sync>> {
        let settings = UserSettings::find()
            .one(&self.db)
            .await?;

        match settings {
            Some(settings) => Ok(settings),
            None => {
                // Create default settings if none exist
                info!("Creating default user settings");
                self.create_default_settings().await
            }
        }
    }

    /// Update user settings
    pub async fn update_settings(
        &self,
        request: UpdateUserSettingsRequest,
    ) -> Result<Model, Box<dyn std::error::Error + Send + Sync>> {
        // Get existing settings or create default ones
        let existing_settings = self.get_settings().await?;
        let mut active_settings: ActiveModel = existing_settings.into();

        // Update fields if provided
        if let Some(rsshub_url) = request.rsshub_url {
            active_settings.rsshub_url = Set(rsshub_url);
        }

        if let Some(fetch_interval_minutes) = request.fetch_interval_minutes {
            active_settings.fetch_interval_minutes = Set(fetch_interval_minutes);
        }

        if let Some(auto_refresh) = request.auto_refresh {
            active_settings.auto_refresh = Set(auto_refresh);
        }

        if let Some(show_description) = request.show_description {
            active_settings.show_description = Set(show_description);
        }

        if let Some(items_per_page) = request.items_per_page {
            active_settings.items_per_page = Set(items_per_page);
        }

        if let Some(show_entry_summary) = request.show_entry_summary {
            active_settings.show_entry_summary = Set(show_entry_summary);
        }

        if let Some(max_auto_title_translations) = request.max_auto_title_translations {
            active_settings.max_auto_title_translations = Set(max_auto_title_translations);
        }

        if let Some(enable_date_filter) = request.enable_date_filter {
            active_settings.enable_date_filter = Set(enable_date_filter);
        }

        if let Some(default_date_range) = request.default_date_range {
            active_settings.default_date_range = Set(default_date_range);
        }

        if let Some(time_field) = request.time_field {
            active_settings.time_field = Set(time_field);
        }

        if let Some(default_language) = request.default_language {
            active_settings.default_language = Set(default_language);
        }

        if let Some(theme) = request.theme {
            active_settings.theme = Set(Some(theme));
        }

        if let Some(auto_mark_read) = request.auto_mark_read {
            active_settings.auto_mark_read = Set(Some(auto_mark_read));
        }

        if let Some(show_read_entries) = request.show_read_entries {
            active_settings.show_read_entries = Set(Some(show_read_entries));
        }

        // Update timestamp
        active_settings.updated_at = Set(chrono::Utc::now());

        // Save to database
        let updated_settings = active_settings.update(&self.db).await?;
        info!("Updated user settings successfully");

        Ok(updated_settings)
    }

    /// Create default user settings
    async fn create_default_settings(&self) -> Result<Model, Box<dyn std::error::Error + Send + Sync>> {
        let default_settings = ActiveModel {
            id: Set(1), // Always use ID 1 for single user settings
            rsshub_url: Set("https://rsshub.app".to_string()),
            fetch_interval_minutes: Set(720), // 12 hours, matching Python version
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
            theme: Set(None),
            auto_mark_read: Set(None),
            show_read_entries: Set(None),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
        };

        let settings = default_settings.insert(&self.db).await?;
        info!("Created default user settings with ID: {}", settings.id);

        Ok(settings)
    }
}
