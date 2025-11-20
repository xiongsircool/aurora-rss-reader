use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set,
    QueryOrder,
};
use tracing::{info, warn, debug};
use base64::{Engine as _, engine::general_purpose};

use crate::models::site_icon_entity::{Entity as SiteIcon, ActiveModel as SiteIconActiveModel};
use crate::models::site_icon::{SiteIcon as SiteIconModel, SiteIconResponse};

pub struct IconService {
    db: DatabaseConnection,
}

impl IconService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Get icon for a domain, with optional force refresh
    pub async fn get_icon(&self, domain: &str, force_refresh: bool) -> Result<Option<SiteIconResponse>, Box<dyn std::error::Error + Send + Sync>> {
        // Normalize domain
        let normalized_domain = self.normalize_domain(domain);

        if !force_refresh {
            // Try to get cached icon first
            if let Some(cached_icon) = self.get_cached_icon(&normalized_domain).await? {
                debug!("Found cached icon for domain: {}", normalized_domain);
                return Ok(Some(cached_icon));
            }
        }

        // Fetch fresh icon
        debug!("Fetching fresh icon for domain: {}", normalized_domain);
        self.fetch_and_cache_icon(&normalized_domain).await
    }

    /// Get cached icon if it's still valid
    async fn get_cached_icon(&self, domain: &str) -> Result<Option<SiteIconResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let icon = SiteIcon::find()
            .filter(crate::models::site_icon_entity::Column::Domain.eq(domain))
            .filter(crate::models::site_icon_entity::Column::IconData.is_not_null())
            .filter(
                crate::models::site_icon_entity::Column::ExpiresAt.gt(chrono::Utc::now())
                    .or(crate::models::site_icon_entity::Column::ExpiresAt.is_null())
            )
            .one(&self.db)
            .await?;

        match icon {
            Some(icon) => {
                Ok(Some(SiteIconResponse {
                    domain: icon.domain.clone(),
                    icon_url: icon.icon_url.clone(),
                    icon_data: icon.icon_data.clone(),
                    icon_type: icon.icon_type.clone(),
                    icon_size: icon.icon_size,
                    cached: true,
                }))
            }
            None => Ok(None),
        }
    }

    /// Fetch and cache icon for a domain
    async fn fetch_and_cache_icon(&self, domain: &str) -> Result<Option<SiteIconResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let icon_urls = self.generate_icon_urls(domain);
        let now = chrono::Utc::now();

        for icon_url in icon_urls {
            debug!("Trying icon URL: {}", icon_url);

            match self.fetch_icon_from_url(&icon_url).await {
                Ok((icon_data, icon_type, icon_size)) => {
                    info!("Successfully fetched icon for domain: {} from {}", domain, icon_url);

                    // Cache the icon
                    let expires_at = now + chrono::Duration::days(7); // Cache for 7 days
                    let active_icon = SiteIconActiveModel {
                        id: Set(uuid::Uuid::new_v4().to_string()),
                        domain: Set(domain.to_string()),
                        icon_url: Set(Some(icon_url.clone())),
                        icon_data: Set(Some(icon_data.clone())),
                        icon_type: Set(Some(icon_type.clone())),
                        icon_size: Set(Some(icon_size)),
                        last_fetched: Set(Some(now)),
                        expires_at: Set(Some(expires_at)),
                        error_count: Set(0),
                        created_at: Set(now),
                        updated_at: Set(now),
                    };

                    // Try to insert or update
                    if let Err(_) = active_icon.insert(&self.db).await {
                        // If insert fails (probably because domain already exists), update it
                        let existing_icon = SiteIcon::find()
                            .filter(crate::models::site_icon_entity::Column::Domain.eq(domain))
                            .one(&self.db)
                            .await?;

                        if let Some(existing) = existing_icon {
                            let mut update_icon: SiteIconActiveModel = existing.into();
                            update_icon.icon_url = Set(Some(icon_url.clone()));
                            update_icon.icon_data = Set(Some(icon_data.clone()));
                            update_icon.icon_type = Set(Some(icon_type.clone()));
                            update_icon.icon_size = Set(Some(icon_size));
                            update_icon.last_fetched = Set(Some(now));
                            update_icon.expires_at = Set(Some(expires_at));
                            update_icon.error_count = Set(0);
                            update_icon.updated_at = Set(now);
                            update_icon.update(&self.db).await?;
                        }
                    }

                    return Ok(Some(SiteIconResponse {
                        domain: domain.to_string(),
                        icon_url: Some(icon_url.clone()),
                        icon_data: Some(icon_data.clone()),
                        icon_type: Some(icon_type.clone()),
                        icon_size: Some(icon_size),
                        cached: false,
                    }));
                }
                Err(e) => {
                    debug!("Failed to fetch icon from {}: {}", icon_url, e);
                    continue;
                }
            }
        }

        // If all URLs failed, update error count
        self.increment_error_count(domain).await?;
        warn!("Failed to fetch icon for domain: {}", domain);
        Ok(None)
    }

    /// Generate possible icon URLs for a domain
    fn generate_icon_urls(&self, domain: &str) -> Vec<String> {
        vec![
            format!("https://{}/favicon.ico", domain),
            format!("https://{}/favicon.png", domain),
            format!("https://{}/apple-touch-icon.png", domain),
            format!("https://{}/apple-touch-icon-precomposed.png", domain),
            format!("https://www.{}/favicon.ico", domain),
            format!("https://icons.duckduckgo.com/ip3/{}.ico", domain),
            // Google's favicon service (deprecated but still works)
            format!("https://www.google.com/s2/favicons?domain={}", domain),
        ]
    }

    /// Fetch icon data from URL
    async fn fetch_icon_from_url(&self, url: &str) -> Result<(String, String, i32), Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("RSS-Backend/1.0 Icon-Fetcher")
            .build()?;

        let response = client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()).into());
        }

        let content_type = response.headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/x-icon")
            .to_string();

        let bytes = response.bytes().await?;
        let size = bytes.len() as i32;

        // Validate size (don't cache too large icons)
        if size > 1024 * 1024 { // 1MB limit
            return Err("Icon too large".into());
        }

        // Encode to base64
        let icon_data = general_purpose::STANDARD.encode(&bytes);

        Ok((icon_data, content_type, size))
    }

    /// Increment error count for a domain
    async fn increment_error_count(&self, domain: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let now = chrono::Utc::now();

        if let Some(icon) = SiteIcon::find()
            .filter(crate::models::site_icon_entity::Column::Domain.eq(domain))
            .one(&self.db)
            .await?
        {
            let error_count = icon.error_count;
            let mut update_icon: SiteIconActiveModel = icon.into();
            update_icon.error_count = Set(error_count + 1);
            update_icon.last_fetched = Set(Some(now));
            update_icon.updated_at = Set(now);

            // If error count is too high, mark as expired to retry later
            if error_count >= 3 {
                let expires_at = now + chrono::Duration::hours(1);
                update_icon.expires_at = Set(Some(expires_at));
            }

            update_icon.update(&self.db).await?;
        } else {
            // Create a record with error
            let active_icon = SiteIconActiveModel {
                id: Set(uuid::Uuid::new_v4().to_string()),
                domain: Set(domain.to_string()),
                icon_url: Set(None),
                icon_data: Set(None),
                icon_type: Set(None),
                icon_size: Set(None),
                last_fetched: Set(Some(now)),
                expires_at: Set(Some(now + chrono::Duration::hours(1))),
                error_count: Set(1),
                created_at: Set(now),
                updated_at: Set(now),
            };

            // Use insert or update logic
            if let Err(_) = active_icon.insert(&self.db).await {
                // Domain might already exist, try update
                let existing = SiteIcon::find()
                    .filter(crate::models::site_icon_entity::Column::Domain.eq(domain))
                    .one(&self.db)
                    .await?;

                if let Some(existing) = existing {
                    let mut update_icon: SiteIconActiveModel = existing.into();
                    update_icon.error_count = Set(1);
                    update_icon.last_fetched = Set(Some(now));
                    update_icon.expires_at = Set(Some(now + chrono::Duration::hours(1)));
                    update_icon.updated_at = Set(now);
                    update_icon.update(&self.db).await?;
                }
            }
        }

        Ok(())
    }

    /// Normalize domain name
    fn normalize_domain(&self, domain: &str) -> String {
        // Remove protocol if present
        let domain = domain.trim_start_matches("http://")
            .trim_start_matches("https://")
            .trim_start_matches("www.");

        // Remove path if present
        if let Some(slash_pos) = domain.find('/') {
            domain[..slash_pos].to_string()
        } else {
            domain.to_lowercase()
        }
    }

    /// Get all cached icons
    pub async fn get_all_icons(&self) -> Result<Vec<SiteIconModel>, Box<dyn std::error::Error + Send + Sync>> {
        let icons = SiteIcon::find()
            .filter(crate::models::site_icon_entity::Column::IconData.is_not_null())
            .order_by_desc(crate::models::site_icon_entity::Column::UpdatedAt)
            .all(&self.db)
            .await?;

        let icon_models: Vec<SiteIconModel> = icons
            .into_iter()
            .map(SiteIconModel::from)
            .collect();

        Ok(icon_models)
    }

    /// Clean up expired icons
    pub async fn cleanup_expired_icons(&self) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let expired_before = chrono::Utc::now();

        let result = SiteIcon::delete_many()
            .filter(crate::models::site_icon_entity::Column::ExpiresAt.lt(expired_before))
            .filter(crate::models::site_icon_entity::Column::ErrorCount.gte(3))
            .exec(&self.db)
            .await?;

        let deleted_count = result.rows_affected;
        if deleted_count > 0 {
            info!("Cleaned up {} expired icons", deleted_count);
        }

        Ok(deleted_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_icon_urls() {
        let db = DatabaseConnection::connect("sqlite::memory:")
            .await
            .expect("Failed to create test database");
        let icon_service = IconService::new(db);

        let domain = "example.com";
        let urls = icon_service.generate_icon_urls(domain);

        // 应该生成多个图标URL
        assert!(urls.len() > 0);

        // 检查是否包含预期的URL
        let expected_urls = vec![
            format!("https://{}/favicon.ico", domain),
            format!("https://{}/favicon.png", domain),
            format!("https://{}/apple-touch-icon.png", domain),
            format!("https://www.{}/favicon.ico", domain),
            format!("https://icons.duckduckgo.com/ip3/{}.ico", domain),
            format!("https://www.google.com/s2/favicons?domain={}", domain),
        ];

        for expected_url in expected_urls {
            assert!(urls.contains(&expected_url), "Missing URL: {}", expected_url);
        }
    }

    #[test]
    fn test_domain_normalization() {
        let db = DatabaseConnection::connect("sqlite::memory:")
            .await
            .expect("Failed to create test database");
        let icon_service = IconService::new(db);

        // 测试域名规范化
        let test_cases = vec![
            ("example.com", "example.com"),
            ("www.example.com", "example.com"),
            ("sub.example.com", "sub.example.com"),
            ("EXAMPLE.COM", "example.com"), // 大写转小写
            ("http://example.com", "example.com"), // 移除协议
            ("https://www.example.com", "example.com"), // 移除协议和www
        ];

        for (input, expected) in test_cases {
            assert_eq!(icon_service.normalize_domain(input), expected);
        }
    }

    #[test]
    fn test_is_valid_icon_url() {
        let db = DatabaseConnection::connect("sqlite::memory:")
            .await
            .expect("Failed to create test database");
        let icon_service = IconService::new(db);

        // 测试有效的图标URL
        let valid_urls = vec![
            "https://example.com/favicon.ico",
            "http://example.com/favicon.png",
            "https://example.com/apple-touch-icon.png",
        ];

        for url in valid_urls {
            assert!(icon_service.is_valid_icon_url(url));
        }

        // 测试无效的图标URL
        let invalid_urls = vec![
            "",
            "not-a-url",
            "ftp://example.com/file.ico", // 不支持的协议
            "https://example.com/page.html", // 不是图标文件
        ];

        for url in invalid_urls {
            assert!(!icon_service.is_valid_icon_url(url));
        }
    }
}