use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use tracing::{error, info, warn};

use crate::models::feed::{ActiveModel as FeedActiveModel, Entity as Feed};
use crate::services::fetcher::RSSFetcher;

pub struct OPMLService {
    db: DatabaseConnection,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct OPMLEntry {
    pub title: String,
    pub html_url: String,
    pub xml_url: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct OPMLExportFeed {
    pub title: String,
    pub html_url: Option<String>,
    pub xml_url: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

impl OPMLService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Import feeds from OPML content
    pub async fn import_opml(
        &self,
        opml_content: &str,
    ) -> Result<Vec<OPMLEntry>, Box<dyn std::error::Error + Send + Sync>> {
        // Parse OPML content
        let opml_document = opml::OPML::from_str(opml_content)?;

        let mut imported_feeds = Vec::new();

        // Process each outline in the OPML with nested structure support
        // Use iterative approach to avoid recursion
        let mut stack: Vec<(&opml::Outline, Option<String>)> = opml_document
            .body
            .outlines
            .iter()
            .map(|outline| (outline, None))
            .collect();

        while let Some((outline, parent_category)) = stack.pop() {
            // Process current outline
            if let Some(xml_url) = &outline.xml_url {
                // This is a feed entry
                let category = if outline.xml_url.is_some() && outline.html_url.is_some() {
                    // This is likely a feed, use the parent category
                    parent_category.clone()
                } else {
                    // This might be a category name, use it
                    if !outline.text.is_empty() {
                        Some(outline.text.clone())
                    } else {
                        parent_category.clone()
                    }
                };

                // Check if feed already exists
                let existing_feed = Feed::find()
                    .filter(crate::models::feed::Column::Url.eq(xml_url))
                    .one(&self.db)
                    .await?;

                if existing_feed.is_none() {
                    let title = if !outline.text.is_empty() {
                        outline.text.clone()
                    } else {
                        // Fallback: extract title from URL or use a default
                        extract_title_from_url(xml_url)
                    };

                    // Create new feed from OPML entry
                    let opml_entry = OPMLEntry {
                        title: title.clone(),
                        html_url: outline.html_url.clone().unwrap_or_default(),
                        xml_url: xml_url.clone(),
                        description: outline.description.clone(),
                        category: category.clone(),
                    };

                    // Insert into database
                    let new_feed = FeedActiveModel {
                        id: Set(uuid::Uuid::new_v4().to_string()),
                        title: Set(title.clone()),
                        url: Set(xml_url.clone()),
                        category: Set(category),
                        favicon: Set(None),
                        update_interval: Set(Some(60)), // Default 60 minutes
                        last_updated: Set(None),
                        last_status: Set(None),
                        error_count: Set(0),
                        created_at: Set(chrono::Utc::now()),
                        updated_at: Set(chrono::Utc::now()),
                    };

                    match new_feed.insert(&self.db).await {
                        Ok(inserted_feed) => {
                            info!("Successfully imported feed: {}", title);
                            imported_feeds.push(opml_entry);

                            // Trigger immediate refresh in background
                            let db_clone = self.db.clone();
                            let feed_id = inserted_feed.id.clone();
                            tokio::spawn(async move {
                                if let Ok(fetcher) = RSSFetcher::new(db_clone) {
                                    match fetcher.fetch_feed(&feed_id).await {
                                        Ok(_) => info!("Initial refresh successful for imported feed: {}", feed_id),
                                        Err(e) => warn!("Initial refresh failed for imported feed {}: {}", feed_id, e),
                                    }
                                }
                            });
                        }
                        Err(e) => {
                            error!("Failed to import feed {}: {}", title, e);
                        }
                    }
                } else {
                    warn!("Feed already exists, skipping: {}", xml_url);
                }
            }

            // Add child outlines to the stack (reverse order to maintain hierarchy)
            let current_category = if outline.xml_url.is_none() && !outline.text.is_empty() {
                // This outline looks like a category/group
                Some(outline.text.clone())
            } else {
                parent_category
            };

            for child_outline in outline.outlines.iter().rev() {
                stack.push((child_outline, current_category.clone()));
            }
        }

        Ok(imported_feeds)
    }

    /// Export feeds to OPML format
    pub async fn export_opml(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Get all feeds from database
        let feeds = Feed::find()
            .order_by_asc(crate::models::feed::Column::Title)
            .all(&self.db)
            .await?;

        // Convert to OPML format
        let mut opml_feeds = Vec::new();
        for feed in feeds {
            opml_feeds.push(OPMLExportFeed {
                title: feed.title,
                html_url: Some(feed.url.clone()), // For now, use RSS URL as HTML URL
                xml_url: feed.url,
                description: None,
                category: feed.category,
            });
        }

        // Generate OPML XML
        let opml_content = self.generate_opml_xml(opml_feeds)?;

        Ok(opml_content)
    }

    /// Generate OPML XML content
    fn generate_opml_xml(
        &self,
        feeds: Vec<OPMLExportFeed>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut xml = String::new();
        xml.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
        xml.push('\n');
        xml.push_str(r#"<opml version="2.0">"#);
        xml.push('\n');
        xml.push_str("  <head>\n");
        xml.push_str("    <title>RSS Feeds Export</title>\n");
        xml.push_str(&format!(
            "    <dateCreated>{}</dateCreated>\n",
            chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S")
        ));
        xml.push_str("  </head>\n");
        xml.push_str("  <body>\n");

        for feed in feeds {
            xml.push_str("    <outline ");
            xml.push_str(&format!("text=\"{}\" ", escape_xml(&feed.title)));
            xml.push_str(&format!("xmlUrl=\"{}\" ", escape_xml(&feed.xml_url)));

            if let Some(html_url) = &feed.html_url {
                xml.push_str(&format!("htmlUrl=\"{}\" ", escape_xml(html_url)));
            }

            if let Some(category) = &feed.category {
                xml.push_str(&format!("category=\"{}\" ", escape_xml(category)));
            }

            xml.push_str("/>\n");
        }

        xml.push_str("  </body>\n");
        xml.push_str("</opml>");

        Ok(xml)
    }
}

/// Extract a title from URL when no title is provided
fn extract_title_from_url(url: &str) -> String {
    // Try to extract a meaningful title from the URL
    if let Some(last_part) = url.split('/').last() {
        if let Some(name_without_ext) = last_part.split('.').next() {
            // Convert dashes and underscores to spaces and capitalize
            let title = name_without_ext
                .replace(['-', '_'], " ")
                .split_whitespace()
                .map(|word| {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                    }
                })
                .collect::<Vec<String>>()
                .join(" ");

            if !title.is_empty() && title.len() > 2 {
                return title;
            }
        }
    }

    // Fallback: use domain name
    if let Ok(parsed_url) = url::Url::parse(url) {
        if let Some(domain) = parsed_url.domain() {
            return domain.to_string();
        }
    }

    // Final fallback: use a generic name
    "Unknown RSS Feed".to_string()
}

/// Escape XML special characters
fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
