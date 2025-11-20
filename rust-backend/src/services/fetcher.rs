use std::time::Duration;
use chrono::{DateTime, Utc};
use feed_rs::parser;
use reqwest::Client;
use scraper::{Html, Selector};
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, QueryFilter, ColumnTrait};
use crate::models::feed::{Entity as Feed, ActiveModel as FeedActiveModel};
use crate::models::entry::{Entity as Entry, ActiveModel as EntryActiveModel};
use crate::utils::validation::validate_rss_url;

pub struct RSSFetcher {
    client: Client,
    pub db: DatabaseConnection,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FetchResult {
    pub success: bool,
    pub message: String,
    pub entries_count: usize,
    pub new_entries_count: usize,
    pub response_time_ms: u64,
}

#[derive(Debug, Clone)]
pub struct ParsedEntry {
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
}

impl RSSFetcher {
    pub fn new(db: DatabaseConnection) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("RSS-Reader/1.0 (https://github.com/aurora-rss-reader)")
            .build()
            .expect("Failed to create HTTP client");

        Self { client, db }
    }

    pub async fn fetch_feed(&self, feed_id: &str) -> Result<FetchResult, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = std::time::Instant::now();

        // Get feed from database
        let feed = Feed::find_by_id(feed_id)
            .one(&self.db)
            .await?
            .ok_or_else(|| format!("Feed with id {} not found", feed_id))?;

        // Validate URL
        validate_rss_url(&feed.url)?;

        tracing::info!("Fetching RSS feed: {}", feed.url);

        // Fetch RSS content
        let response = self.client.get(&feed.url).send().await?;
        let response_time = start_time.elapsed().as_millis() as u64;

        if !response.status().is_success() {
            return Err(format!("HTTP {} - {}", response.status(), response.text().await?).into());
        }

        let content = response.text().await?;

        // Parse RSS feed
        let parsed_feed = parser::parse(content.as_bytes())
            .map_err(|e| format!("Failed to parse RSS feed: {}", e))?;

        tracing::info!("Parsed {} entries from feed: {}", parsed_feed.entries.len(), feed.title);

        // Store total entries count for result
        let total_entries_count = parsed_feed.entries.len();

        // Process entries
        let mut new_entries_count = 0;
        let mut processed_entries = Vec::new();

        for entry in &parsed_feed.entries {
            if let Some(link) = entry.links.first() {
                let parsed_entry = ParsedEntry {
                    title: entry.title.as_ref().map(|t| t.content.clone()).unwrap_or_else(|| "Untitled".to_string()),
                    url: link.href.clone(),
                    author: entry.authors.first().map(|a| a.name.clone()),
                    summary: entry.summary.as_ref().map(|s| s.content.clone()),
                    content: entry.content.as_ref().and_then(|c| c.body.clone()),
                    published_at: entry.published,
                };

                // Check if entry already exists
                let exists = Entry::find()
                    .filter(crate::models::entry::Column::FeedId.eq(feed_id))
                    .filter(crate::models::entry::Column::Url.eq(&parsed_entry.url))
                    .one(&self.db)
                    .await?;

                if exists.is_none() {
                    processed_entries.push(parsed_entry);
                    new_entries_count += 1;
                }
            }
        }

        // Insert new entries into database
        let mut inserted_entries = Vec::new();
        for parsed_entry in processed_entries {
            let new_entry = EntryActiveModel {
                id: Set(uuid::Uuid::new_v4().to_string()),
                feed_id: Set(feed_id.to_string()),
                title: Set(parsed_entry.title),
                url: Set(parsed_entry.url),
                author: Set(parsed_entry.author),
                content: Set(parsed_entry.content),
                summary: Set(parsed_entry.summary),
                published_at: Set(parsed_entry.published_at.map(|dt| dt)),
                created_at: Set(Utc::now()),
                updated_at: Set(Utc::now()),
                is_read: Set(false),
                is_starred: Set(false),
                reading_time: Set(None),
                word_count: Set(None),
            };

            let inserted = new_entry.insert(&self.db).await?;
            inserted_entries.push(inserted);
        }

        // Store feed title for logging
        let feed_title = feed.title.clone();

        // Update feed status
        let mut active_feed: FeedActiveModel = feed.into();
        active_feed.last_updated = Set(Some(Utc::now()));
        active_feed.last_status = Set(Some("success".to_string()));
        active_feed.error_count = Set(0);
        active_feed.update(&self.db).await?;

        tracing::info!(
            "Successfully fetched feed {} ({} new entries, {}ms)",
            feed_title,
            new_entries_count,
            response_time
        );

        Ok(FetchResult {
            success: true,
            message: "Successfully fetched feed".to_string(),
            entries_count: total_entries_count,
            new_entries_count,
            response_time_ms: response_time,
        })
    }

    #[allow(dead_code)]
    pub async fn extract_content(&self, url: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let response = self.client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(format!("Failed to fetch content: HTTP {}", response.status()).into());
        }

        let html = response.text().await?;
        let document = Html::parse_document(&html);

        // Try to extract main content using common selectors
        let content_selectors = vec![
            "article",
            ".post-content",
            ".entry-content",
            ".content",
            "#content",
            ".main-content",
        ];

        for selector in content_selectors {
            let sel = Selector::parse(selector).unwrap();
            if let Some(element) = document.select(&sel).next() {
                let content = element.inner_html();
                // Clean up HTML
                let clean_content = self.clean_html_content(&content);
                if clean_content.len() > 100 {
                    return Ok(clean_content);
                }
            }
        }

        // Fallback to body content
        if let Some(body) = document.select(&Selector::parse("body").unwrap()).next() {
            let content = body.inner_html();
            Ok(self.clean_html_content(&content))
        } else {
            Err("Could not extract content from page".into())
        }
    }

    #[allow(dead_code)]
    fn clean_html_content(&self, html: &str) -> String {
        // Simple HTML cleaning - remove script and style tags
        let mut clean_html = html.to_string();

        // Remove script tags
        while let Some(start) = clean_html.find("<script") {
            if let Some(end) = clean_html.find("</script>") {
                clean_html = clean_html[..start].to_string() + &clean_html[end + 9..];
            } else {
                break;
            }
        }

        // Remove style tags
        while let Some(start) = clean_html.find("<style") {
            if let Some(end) = clean_html.find("</style>") {
                clean_html = clean_html[..start].to_string() + &clean_html[end + 8..];
            } else {
                break;
            }
        }

        // Clean up excessive whitespace
        clean_html = clean_html
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");

        clean_html
    }

    #[allow(dead_code)]
    pub async fn get_favicon_url(&self, base_url: &str) -> Option<String> {
        let url = format!("{}/favicon.ico", base_url.trim_end_matches('/'));

        match self.client.head(&url).send().await {
            Ok(response) if response.status().is_success() => Some(url),
            Ok(_) => {
                // Try to find favicon in HTML
                self.extract_favicon_from_html(base_url).await
            }
            Err(_) => None,
        }
    }

    #[allow(dead_code)]
    async fn extract_favicon_from_html(&self, base_url: &str) -> Option<String> {
        let response = self.client.get(base_url).send().await.ok()?;

        if !response.status().is_success() {
            return None;
        }

        let html = response.text().await.ok()?;
        let document = Html::parse_document(&html);

        // Look for favicon link tags
        let favicon_selectors = vec![
            "link[rel*='icon']",
            "link[rel*='shortcut icon']",
        ];

        for selector in favicon_selectors {
            if let Ok(sel) = Selector::parse(selector) {
                if let Some(element) = document.select(&sel).next() {
                    if let Some(href) = element.value().attr("href") {
                        let favicon_url = if href.starts_with("http") {
                            href.to_string()
                        } else {
                            format!("{}{}", base_url.trim_end_matches('/'), href.trim_start_matches('/'))
                        };
                        return Some(favicon_url);
                    }
                }
            }
        }

        None
    }
}
