use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RSSHubConfig {
    pub base_url: String,
    pub fetch_interval_minutes: u64,
    pub max_articles_per_feed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub base_url: String,
    pub model: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub default_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigFile {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub rsshub: RSSHubConfig,
    pub ai: AIConfig,
    pub app: AppConfig,
}

/// Main configuration structure for the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub rsshub_base: String,
    pub fetch_interval_minutes: u64,
    pub glm_base_url: String,
    pub glm_model: String,
    pub glm_api_key: String,
    pub max_articles_per_feed: usize,
    pub default_language: String,
}

impl Config {
    /// Load configuration from config.toml file
    /// Falls back to environment variables if needed
    /// Priority: config.toml > environment variables > default values
    pub fn from_env() -> anyhow::Result<Self> {
        // Try to load from config.toml first
        let config_path = std::env::current_dir()?.join("config.toml");
        
        let config_file = if config_path.exists() {
            tracing::info!("Loading configuration from: {}", config_path.display());
            let config_str = std::fs::read_to_string(&config_path)?;
            toml::from_str::<ConfigFile>(&config_str)?
        } else {
            tracing::warn!("config.toml not found, using default values");
            // Use default config
            ConfigFile {
                server: ServerConfig {
                    host: "127.0.0.1".to_string(),
                    port: 27495,
                },
                database: DatabaseConfig {
                    path: "data/rss.db".to_string(),
                },
                rsshub: RSSHubConfig {
                    base_url: "https://rsshub.app".to_string(),
                    fetch_interval_minutes: 15,
                    max_articles_per_feed: 1000,
                },
                ai: AIConfig {
                    base_url: "https://open.bigmodel.cn".to_string(),
                    model: "glm-4-flash".to_string(),
                    api_key: String::new(),
                },
                app: AppConfig {
                    default_language: "zh-CN".to_string(),
                },
            }
        };

        // Determine data directory
        // Priority: AURORA_DATA_DIR env var > current directory
        let data_dir: PathBuf = std::env::var("AURORA_DATA_DIR")
            .ok()
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                let current_dir = std::env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."));
                tracing::info!("Current directory: {}", current_dir.display());
                let data_dir = current_dir.join("data");
                tracing::info!("Data directory will be: {}", data_dir.display());
                data_dir
            });

        // Construct database URL
        let db_filename = PathBuf::from(&config_file.database.path)
            .file_name()
            .unwrap_or(std::ffi::OsStr::new("rss.db"))
            .to_string_lossy()
            .to_string();
            
        let database_url = format!(
            "sqlite://{}?mode=rwc",
            data_dir.join(db_filename).to_string_lossy()
        );

        tracing::info!("Final database URL: {}", database_url);

        // Allow GLM API key override via environment variable
        let glm_api_key = std::env::var("AURORA_GLM_API_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| {
                if config_file.ai.api_key.is_empty() {
                    None
                } else {
                    Some(config_file.ai.api_key.clone())
                }
            })
            .unwrap_or_default();

        if glm_api_key.is_empty() {
            tracing::warn!("GLM API key not configured. AI features will not work.");
        }

        Ok(Config {
            host: config_file.server.host,
            port: config_file.server.port,
            database_url,
            rsshub_base: config_file.rsshub.base_url,
            fetch_interval_minutes: config_file.rsshub.fetch_interval_minutes,
            glm_base_url: config_file.ai.base_url,
            glm_model: config_file.ai.model,
            glm_api_key,
            max_articles_per_feed: config_file.rsshub.max_articles_per_feed,
            default_language: config_file.app.default_language,
        })
    }
}
