use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set, QueryOrder,
};
use tracing::{error, info, warn};

use crate::models::feed::{Entity as Feed, ActiveModel as FeedActiveModel};

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
    pub async fn import_opml(&self, opml_content: &str) -> Result<Vec<OPMLEntry>, Box<dyn std::error::Error + Send + Sync>> {
        // Parse OPML content
        let opml_document = opml::OPML::from_str(opml_content)?;

        let mut imported_feeds = Vec::new();

        // Process each outline in the OPML
        for outline in opml_document.body.outlines {
            if let (Some(xml_url), Some(title)) = (outline.xml_url.as_ref(), Some(&outline.text)) {
                // Check if feed already exists
                let existing_feed = Feed::find()
                    .filter(crate::models::feed::Column::Url.eq(xml_url))
                    .one(&self.db)
                    .await?;

                if existing_feed.is_none() {
                    // Create new feed from OPML entry
                    let opml_entry = OPMLEntry {
                        title: title.clone(),
                        html_url: outline.html_url.clone().unwrap_or_default(),
                        xml_url: xml_url.clone(),
                        description: outline.description.clone(),
                        category: outline.category.clone(),
                    };

                    // Insert into database
                    let new_feed = FeedActiveModel {
                        id: Set(uuid::Uuid::new_v4().to_string()),
                        title: Set(title.clone()),
                        url: Set(xml_url.clone()),
                        category: Set(outline.category.clone()),
                        favicon: Set(None),
                        update_interval: Set(Some(60)), // Default 60 minutes
                        last_updated: Set(None),
                        last_status: Set(None),
                        error_count: Set(0),
                        created_at: Set(chrono::Utc::now()),
                        updated_at: Set(chrono::Utc::now()),
                    };

                    match new_feed.insert(&self.db).await {
                        Ok(_) => {
                            info!("Successfully imported feed: {}", title);
                            imported_feeds.push(opml_entry);
                        }
                        Err(e) => {
                            error!("Failed to import feed {}: {}", title, e);
                        }
                    }
                } else {
                    warn!("Feed already exists, skipping: {}", xml_url);
                }
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
    fn generate_opml_xml(&self, feeds: Vec<OPMLExportFeed>) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut xml = String::new();
        xml.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
        xml.push('\n');
        xml.push_str(r#"<opml version="2.0">"#);
        xml.push('\n');
        xml.push_str("  <head>\n");
        xml.push_str("    <title>RSS Feeds Export</title>\n");
        xml.push_str(&format!("    <dateCreated>{}</dateCreated>\n", chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S")));
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

/// Escape XML special characters
fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}