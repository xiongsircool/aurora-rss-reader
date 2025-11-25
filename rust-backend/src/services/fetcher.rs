use crate::models::entry::{ActiveModel as EntryActiveModel, Entity as Entry};
use crate::models::feed::{ActiveModel as FeedActiveModel, Entity as Feed};
use crate::utils::validation::validate_rss_url;
use chrono::{DateTime, Utc};
use syndication::Feed as SyndicationFeed;

use reqwest::Client;
use scraper::{Html, Selector};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::time::Duration;

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

// Enhanced time extraction function


// Helper to parse date from RSS item
fn parse_rss_date(date_str: &str) -> Option<DateTime<Utc>> {
    // Try RFC2822 first
    if let Ok(dt) = DateTime::parse_from_rfc2822(date_str) {
        return Some(dt.with_timezone(&Utc));
    }
    // Try common patterns
    parse_time_from_text(date_str)
}

// Parse time from text content using common patterns
fn parse_time_from_text(text: &str) -> Option<DateTime<Utc>> {
    use chrono::DateTime;
    use regex::Regex;

    // Common time patterns in RSS feeds
    let patterns = vec![
        // ISO 8601 formats
        (r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", "%Y-%m-%dT%H:%M:%SZ"),
        (r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z", "%Y-%m-%dT%H:%M:%S%.fZ"),
        (r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}", "%Y-%m-%dT%H:%M:%S%z"),

        // Chinese date formats
        (r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2}):(\d{2})", "%Y年%m月%d日 %H:%M:%S"),
        (r"(\d{4})年(\d{1,2})月(\d{1,2})日", "%Y年%m月%d日"),

        // US date formats
        (r"(\w{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})", "%b %d %Y %H:%M:%S"),
        (r"(\w{3})\s+(\d{1,2})\s+(\d{4})", "%b %d %Y"),

        // RFC 2822 format
        (r"\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+\w{3}", "%a, %d %b %Y %H:%M:%S %Z"),

        // Simple formats
        (r"(\d{4})/(\d{1,2})/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})", "%Y/%m/%d %H:%M:%S"),
        (r"(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})", "%m/%d/%Y %H:%M:%S"),
    ];

    for (pattern, format_str) in patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(captures) = re.captures(text) {
                // Extract the matched text
                let matched_text = captures.get(0).unwrap().as_str();

                // Try to parse with the corresponding format
                if let Ok(dt) = DateTime::parse_from_str(matched_text, format_str) {
                    return Some(dt.with_timezone(&Utc));
                }
            }
        }
    }

    None
}

impl RSSFetcher {
    pub fn new(db: DatabaseConnection) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("RSS-Reader/1.0 (https://github.com/aurora-rss-reader)")
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        Ok(Self { client, db })
    }

    pub async fn fetch_feed(
        &self,
        feed_id: &str,
    ) -> Result<FetchResult, Box<dyn std::error::Error + Send + Sync>> {
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

        // Parse RSS feed using syndication
        let feed_data = content.parse::<SyndicationFeed>()
            .map_err(|e| format!("Failed to parse RSS feed: {}", e))?;

        let (feed_title, entries) = match feed_data {
            SyndicationFeed::Atom(atom_feed) => {
                let title = atom_feed.title().to_string();
                let entries = atom_feed.entries().iter().map(|entry| {
                    let url = entry.links().first().map(|l| l.href().to_string()).unwrap_or_default();
                    // Handle Atom date (parse from string)
                    let published = entry.published().or(Some(entry.updated()))
                        .and_then(|d| DateTime::parse_from_rfc3339(d).ok())
                        .map(|dt| dt.with_timezone(&Utc));
                    
                    // Extract content
                    let content = entry.content().and_then(|c| c.value().map(|v| v.to_string()))
                        .or_else(|| entry.summary().map(|s| s.to_string()));

                    ParsedEntry {
                        title: entry.title().to_string(),
                        url,
                        author: entry.authors().first().map(|a| a.name().to_string()),
                        summary: entry.summary().map(|s| s.to_string()),
                        content,
                        published_at: published,
                    }
                }).collect::<Vec<_>>();
                (title, entries)
            },
            SyndicationFeed::RSS(rss_feed) => {
                let title = rss_feed.title.clone();
                let entries = rss_feed.items.iter().map(|item| {
                    let published = item.pub_date.as_deref().and_then(parse_rss_date);
                    
                    // Extract content
                    let content = item.content.clone()
                        .or_else(|| item.description.clone());

                    ParsedEntry {
                        title: item.title.clone().unwrap_or_else(|| "Untitled".to_string()),
                        url: item.link.clone().unwrap_or_default(),
                        author: item.author.clone(), // Simple author string in RSS
                        summary: item.description.clone(),
                        content,
                        published_at: published,
                    }
                }).collect::<Vec<_>>();
                (title, entries)
            }
        };

        tracing::info!(
            "Parsed {} entries from feed: {}",
            entries.len(),
            feed_title
        );

        // Store total entries count for result
        let total_entries_count = entries.len();

        // Process entries
        let mut new_entries_count = 0;
        let mut processed_entries = Vec::new();

        for parsed_entry in entries {
            if !parsed_entry.url.is_empty() {

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
        let mut successfully_inserted = 0;
        for parsed_entry in processed_entries {
            let entry_title = parsed_entry.title.clone();
            let new_entry = EntryActiveModel {
                id: Set(uuid::Uuid::new_v4().to_string()),
                feed_id: Set(feed_id.to_string()),
                title: Set(parsed_entry.title),
                url: Set(parsed_entry.url),
                author: Set(parsed_entry.author),
                content: Set(parsed_entry.content),
                summary: Set(parsed_entry.summary),
                published_at: Set(parsed_entry.published_at),
                created_at: Set(Utc::now()),
                updated_at: Set(Utc::now()),
                is_read: Set(false),
                is_starred: Set(false),
                reading_time: Set(None),
                word_count: Set(None),
            };

            match new_entry.insert(&self.db).await {
                Ok(_) => {
                    successfully_inserted += 1;
                    tracing::debug!("Successfully inserted entry: {}", entry_title);
                }
                Err(e) => {
                    tracing::error!("Failed to insert entry '{}': {}", entry_title, e);
                    // Continue with other entries instead of failing completely
                }
            }
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
            "Successfully fetched feed {} ({} processed, {} inserted, {}ms)",
            feed_title,
            new_entries_count,
            successfully_inserted,
            response_time
        );

        Ok(FetchResult {
            success: true,
            message: "Successfully fetched feed".to_string(),
            entries_count: total_entries_count,
            new_entries_count: successfully_inserted,
            response_time_ms: response_time,
        })
    }

    #[allow(dead_code)]
    pub async fn extract_content(
        &self,
        url: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
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
            if let Ok(sel) = Selector::parse(selector) {
                if let Some(element) = document.select(&sel).next() {
                    let content = element.inner_html();
                    // Clean up HTML
                    let clean_content = self.clean_html_content(&content);
                    if clean_content.len() > 100 {
                        return Ok(clean_content);
                    }
                }
            } else {
                tracing::warn!("Invalid CSS selector: {}", selector);
            }
        }

        // Fallback to body content
        if let Ok(body_selector) = Selector::parse("body") {
            if let Some(body) = document.select(&body_selector).next() {
                let content = body.inner_html();
                Ok(self.clean_html_content(&content))
            } else {
                Err("Could not extract content from page".into())
            }
        } else {
            Err("Could not parse body selector".into())
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
        clean_html = clean_html.split_whitespace().collect::<Vec<_>>().join(" ");

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
        let favicon_selectors = vec!["link[rel*='icon']", "link[rel*='shortcut icon']"];

        for selector in favicon_selectors {
            if let Ok(sel) = Selector::parse(selector) {
                if let Some(element) = document.select(&sel).next() {
                    if let Some(href) = element.value().attr("href") {
                        let favicon_url = if href.starts_with("http") {
                            href.to_string()
                        } else {
                            format!(
                                "{}{}",
                                base_url.trim_end_matches('/'),
                                href.trim_start_matches('/')
                            )
                        };
                        return Some(favicon_url);
                    }
                }
            }
        }

        None
    }
}
