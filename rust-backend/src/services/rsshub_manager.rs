use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set, QueryOrder,
};
use tracing::{error, info, warn};

use crate::models::rsshub_config_entity::{Entity as RSSHubConfig, ActiveModel as RSSHubConfigActiveModel};
use crate::models::rsshub_config::{RSSHubConfig as RSSHubConfigResponse, CreateRSSHubConfigRequest, UpdateRSSHubConfigRequest};

pub struct Service {
    db: DatabaseConnection,
}

impl Service {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Get all RSSHub configurations ordered by priority and active status
    pub async fn list_configs(&self) -> Result<Vec<RSSHubConfigResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let configs = RSSHubConfig::find()
            .order_by_desc(crate::models::rsshub_config_entity::Column::IsActive)
            .order_by_asc(crate::models::rsshub_config_entity::Column::Priority)
            .all(&self.db)
            .await?;

        let config_responses: Vec<RSSHubConfigResponse> = configs
            .into_iter()
            .map(|config| RSSHubConfigResponse {
                id: config.id,
                url: config.url,
                priority: config.priority,
                is_active: config.is_active,
                last_tested: config.last_tested,
                response_time: config.response_time,
                error_count: config.error_count,
                created_at: config.created_at,
                updated_at: config.updated_at,
            })
            .collect();

        Ok(config_responses)
    }

    /// Get a specific RSSHub configuration by ID
    pub async fn get_config(&self, id: &str) -> Result<Option<RSSHubConfigResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let config = RSSHubConfig::find_by_id(id).one(&self.db).await?;

        match config {
            Some(config) => Ok(Some(RSSHubConfigResponse {
                id: config.id,
                url: config.url,
                priority: config.priority,
                is_active: config.is_active,
                last_tested: config.last_tested,
                response_time: config.response_time,
                error_count: config.error_count,
                created_at: config.created_at,
                updated_at: config.updated_at,
            })),
            None => Ok(None),
        }
    }

    /// Create a new RSSHub configuration
    pub async fn create_config(&self, request: CreateRSSHubConfigRequest) -> Result<RSSHubConfigResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Check if URL already exists
        let existing = RSSHubConfig::find()
            .filter(crate::models::rsshub_config_entity::Column::Url.eq(&request.url))
            .one(&self.db)
            .await?;

        if existing.is_some() {
            return Err("RSSHub configuration with this URL already exists".into());
        }

        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now();

        let new_config = RSSHubConfigActiveModel {
            id: Set(id.clone()),
            url: Set(request.url),
            priority: Set(request.priority),
            is_active: Set(true),
            last_tested: Set(None),
            response_time: Set(None),
            error_count: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
        };

        let config = new_config.insert(&self.db).await?;
        info!("Created RSSHub config with ID: {}", config.id);

        Ok(RSSHubConfigResponse {
            id: config.id,
            url: config.url,
            priority: config.priority,
            is_active: config.is_active,
            last_tested: config.last_tested,
            response_time: config.response_time,
            error_count: config.error_count,
            created_at: config.created_at,
            updated_at: config.updated_at,
        })
    }

    /// Update an existing RSSHub configuration
    pub async fn update_config(&self, id: &str, request: UpdateRSSHubConfigRequest) -> Result<Option<RSSHubConfigResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let existing_config = RSSHubConfig::find_by_id(id).one(&self.db).await?;

        match existing_config {
            Some(config) => {
                let mut active_config: RSSHubConfigActiveModel = config.into();

                // Update fields if provided
                if let Some(url) = request.url {
                    // Check if new URL already exists for different config
                    let url_exists = RSSHubConfig::find()
                        .filter(crate::models::rsshub_config_entity::Column::Url.eq(&url))
                        .filter(crate::models::rsshub_config_entity::Column::Id.ne(id))
                        .one(&self.db)
                        .await?;

                    if url_exists.is_some() {
                        return Err("RSSHub configuration with this URL already exists".into());
                    }

                    active_config.url = Set(url);
                }

                if let Some(priority) = request.priority {
                    active_config.priority = Set(priority);
                }

                if let Some(is_active) = request.is_active {
                    active_config.is_active = Set(is_active);
                }

                active_config.updated_at = Set(chrono::Utc::now());

                let updated_config = active_config.update(&self.db).await?;
                info!("Updated RSSHub config with ID: {}", id);

                Ok(Some(RSSHubConfigResponse {
                    id: updated_config.id,
                    url: updated_config.url,
                    priority: updated_config.priority,
                    is_active: updated_config.is_active,
                    last_tested: updated_config.last_tested,
                    response_time: updated_config.response_time,
                    error_count: updated_config.error_count,
                    created_at: updated_config.created_at,
                    updated_at: updated_config.updated_at,
                }))
            }
            None => Ok(None),
        }
    }

    /// Delete a RSSHub configuration
    pub async fn delete_config(&self, id: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let config = RSSHubConfig::find_by_id(id).one(&self.db).await?;

        match config {
            Some(_) => {
                let result = RSSHubConfig::delete_by_id(id).exec(&self.db).await?;
                let deleted = result.rows_affected > 0;

                if deleted {
                    info!("Deleted RSSHub config with ID: {}", id);
                }

                Ok(deleted)
            }
            None => Ok(false),
        }
    }

    /// Test RSSHub mirror availability and update performance metrics
    pub async fn test_rsshub(&self, id: &str) -> Result<Option<RSSHubConfigResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let config = RSSHubConfig::find_by_id(id).one(&self.db).await?;

        match config {
            Some(config) => {
                let config_url = config.url.clone(); // Clone URL for later use
                let start_time = std::time::Instant::now();

                // Test the RSSHub mirror by making a simple HTTP request
                let test_url = format!("{}/api/health", config.url);
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(10))
                    .build()?;

                let response_time = match client.get(&test_url).send().await {
                    Ok(response) => {
                        if response.status().is_success() {
                            let elapsed = start_time.elapsed();
                            Some(elapsed.as_millis() as i32)
                        } else {
                            None
                        }
                    }
                    Err(_) => None,
                };

                let now = chrono::Utc::now();
                let is_active = response_time.is_some();
                let error_count = if is_active { 0 } else { config.error_count + 1 };

                // Update the configuration with test results
                let mut active_config: RSSHubConfigActiveModel = config.into();
                active_config.last_tested = Set(Some(now));
                active_config.response_time = Set(response_time);
                active_config.is_active = Set(is_active);
                active_config.error_count = Set(error_count);
                active_config.updated_at = Set(now);

                let updated_config = active_config.update(&self.db).await?;

                if is_active {
                    info!("RSSHub mirror {} is healthy (response time: {}ms)", config_url, response_time.unwrap_or(0));
                } else {
                    warn!("RSSHub mirror {} is not responding", config_url);
                }

                Ok(Some(RSSHubConfigResponse {
                    id: updated_config.id,
                    url: updated_config.url,
                    priority: updated_config.priority,
                    is_active: updated_config.is_active,
                    last_tested: updated_config.last_tested,
                    response_time: updated_config.response_time,
                    error_count: updated_config.error_count,
                    created_at: updated_config.created_at,
                    updated_at: updated_config.updated_at,
                }))
            }
            None => Ok(None),
        }
    }

    /// Test all active RSSHub mirrors
    pub async fn test_all_active_mirrors(&self) -> Result<Vec<RSSHubConfigResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let configs = RSSHubConfig::find()
            .filter(crate::models::rsshub_config_entity::Column::IsActive.eq(true))
            .all(&self.db)
            .await?;

        let mut results = Vec::new();

        for config in configs {
            match self.test_rsshub(&config.id).await {
                Ok(Some(updated_config)) => results.push(updated_config),
                Ok(None) => warn!("Failed to test RSSHub config with ID: {}", config.id),
                Err(e) => {
                    error!("Error testing RSSHub config {}: {}", config.id, e);
                }
            }
        }

        Ok(results)
    }

    /// Get the best available RSSHub mirror (highest priority, active, and most recently tested)
    pub async fn get_best_mirror(&self) -> Result<Option<RSSHubConfigResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let config = RSSHubConfig::find()
            .filter(crate::models::rsshub_config_entity::Column::IsActive.eq(true))
            .order_by_desc(crate::models::rsshub_config_entity::Column::Priority)
            .order_by_desc(crate::models::rsshub_config_entity::Column::LastTested)
            .one(&self.db)
            .await?;

        match config {
            Some(config) => Ok(Some(RSSHubConfigResponse {
                id: config.id,
                url: config.url,
                priority: config.priority,
                is_active: config.is_active,
                last_tested: config.last_tested,
                response_time: config.response_time,
                error_count: config.error_count,
                created_at: config.created_at,
                updated_at: config.updated_at,
            })),
            None => Ok(None),
        }
    }
}
