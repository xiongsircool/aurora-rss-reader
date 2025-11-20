use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub environment: Environment,
    pub database_url: String,
    pub rsshub_base: String,
    pub fetch_interval_minutes: u64,
    pub glm_base_url: String,
    pub glm_model: String,
    pub glm_api_key: String,
    pub max_articles_per_feed: usize,
    pub default_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Environment {
    Development,
    Production,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        // 根据环境变量决定运行模式
        let environment = match env::var("RUST_ENV").unwrap_or_default().as_str() {
            "production" => Environment::Production,
            _ => Environment::Development,
        };

        let database_url = if matches!(environment, Environment::Development) {
            format!("sqlite://{}/data/rss.db", env::current_dir()?.display())
        } else {
            format!(
                "sqlite://{}",
                dirs::data_dir()
                    .unwrap_or_else(|| env::current_dir().unwrap())
                    .join("aurora-rss-reader")
                    .join("data")
                    .join("rss.db")
                    .to_string_lossy()
            )
        };

        Ok(Config {
            host: "127.0.0.1".to_string(),
            port: 27495,
            environment,
            database_url,
            rsshub_base: "https://rsshub.app".to_string(),
            fetch_interval_minutes: 15,
            glm_base_url: "https://open.bigmodel.cn".to_string(),
            glm_model: "glm-4-flash".to_string(),
            glm_api_key: String::new(), // 空字符串，需要用户自行配置
            max_articles_per_feed: 1000,
            default_language: "zh-CN".to_string(),
        })
    }

    pub fn is_development(&self) -> bool {
        matches!(self.environment, Environment::Development)
    }
}