use serde::{Deserialize, Serialize};
use sea_orm::entity::prelude::*;
use sea_orm::DeriveEntityModel;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "user_settings")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub rsshub_url: String,
    pub fetch_interval_minutes: i32,
    pub auto_refresh: bool,
    pub show_description: bool,
    pub items_per_page: i32,
    pub show_entry_summary: bool,
    pub max_auto_title_translations: i32,
    pub translation_display_mode: String,
    pub enable_date_filter: bool,
    pub default_date_range: String,
    pub time_field: String,
    pub default_language: String,
    pub theme: Option<String>,
    pub auto_mark_read: Option<bool>,
    pub show_read_entries: Option<bool>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {
}

// Type aliases for convenience
#[allow(dead_code)]
pub type UserSettings = Model;
#[allow(dead_code)]
pub type UserSettingsActiveModel = ActiveModel;

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserSettingsRequest {
    pub rsshub_url: Option<String>,
    pub fetch_interval_minutes: Option<i32>,
    pub auto_refresh: Option<bool>,
    pub show_description: Option<bool>,
    pub items_per_page: Option<i32>,
    pub show_entry_summary: Option<bool>,
    pub max_auto_title_translations: Option<i32>,
    pub translation_display_mode: Option<String>,
    pub enable_date_filter: Option<bool>,
    pub default_date_range: Option<String>,
    pub time_field: Option<String>,
    pub default_language: Option<String>,
    pub theme: Option<String>,
    pub auto_mark_read: Option<bool>,
    pub show_read_entries: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSettingsResponse {
    pub rsshub_url: String,
    pub fetch_interval_minutes: i32,
    pub auto_refresh: bool,
    pub show_description: bool,
    pub items_per_page: i32,
    pub show_entry_summary: bool,
    pub max_auto_title_translations: i32,
    pub translation_display_mode: String,
    pub enable_date_filter: bool,
    pub default_date_range: String,
    pub time_field: String,
    pub default_language: String,
    pub theme: Option<String>,
    pub auto_mark_read: Option<bool>,
    pub show_read_entries: Option<bool>,
}

impl From<Model> for UserSettingsResponse {
    fn from(settings: Model) -> Self {
        Self {
            rsshub_url: settings.rsshub_url,
            fetch_interval_minutes: settings.fetch_interval_minutes,
            auto_refresh: settings.auto_refresh,
            show_description: settings.show_description,
            items_per_page: settings.items_per_page,
            show_entry_summary: settings.show_entry_summary,
            max_auto_title_translations: settings.max_auto_title_translations,
            translation_display_mode: settings.translation_display_mode,
            enable_date_filter: settings.enable_date_filter,
            default_date_range: settings.default_date_range,
            time_field: settings.time_field,
            default_language: settings.default_language,
            theme: settings.theme,
            auto_mark_read: settings.auto_mark_read,
            show_read_entries: settings.show_read_entries,
        }
    }
}