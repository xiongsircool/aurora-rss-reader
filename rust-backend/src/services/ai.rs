use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;


#[derive(Debug, Clone)]
pub struct AIService {
    http_client: reqwest::Client,
    api_key: String,
    base_url: String,
    model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GLMMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct GLMRequest {
    pub model: String,
    pub messages: Vec<GLMMessage>,
    pub max_tokens: u32,
    pub temperature: f32,
}

#[derive(Debug, Deserialize)]
pub struct GLMChoice {
    pub message: GLMMessage,
}

#[derive(Debug, Deserialize)]
pub struct GLMResponse {
    pub choices: Vec<GLMChoice>,
}

impl AIService {
    pub fn new(api_key: String, base_url: String, model: String) -> Self {
        Self {
            http_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(90))
                .build()
                .unwrap(),
            api_key,
            base_url,
            model,
        }
    }

    fn get_language_name(&self, language: &str) -> String {
        match language {
            "zh" => "中文".to_string(),
            "en" => "English".to_string(),
            "ja" => "日本語".to_string(),
            "ko" => "한국어".to_string(),
            "fr" => "Français".to_string(),
            "de" => "Deutsch".to_string(),
            "es" => "Español".to_string(),
            _ => language.to_string(),
        }
    }

    async fn call_api(&self, messages: Vec<GLMMessage>, max_tokens: u32) -> Result<String> {
        if self.api_key.is_empty() {
            return Err(anyhow!("AI API key is not configured"));
        }

        let request = GLMRequest {
            model: self.model.clone(),
            messages,
            max_tokens,
            temperature: 0.7,
        };

        let response = self
            .http_client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("AI API request failed: {}", error_text));
        }

        let glm_response: GLMResponse = response.json().await?;

        if glm_response.choices.is_empty() {
            return Err(anyhow!("No response from AI API"));
        }

        Ok(glm_response.choices[0].message.content.clone())
    }

    pub async fn summarize(&self, content: &str, language: &str) -> Result<String> {
        let max_input_length = 8000;
        let content = if content.len() > max_input_length {
            format!("{}...", &content[..max_input_length])
        } else {
            content.to_string()
        };

        let lang_display = self.get_language_name(language);

        let messages = vec![
            GLMMessage {
                role: "system".to_string(),
                content: format!(
                    "你是一个专业的RSS阅读器助手。你会收到一段文章文本，其中开头部分可能包含文章的标题、作者、时间等元信息，之后是正文内容。请用{}对整体内容生成全面而精炼的摘要。摘要应该：\n\
                    1. 抓住文章的核心观点和主要论据\n\
                    2. 包含重要的细节和支撑数据\n\
                    3. 保持逻辑结构清晰，层次分明\n\
                    4. 适当保持原文的风格和语调\n\
                    5. 控制长度在合理范围内，确保信息密度",
                    lang_display
                ),
            },
            GLMMessage {
                role: "user".to_string(),
                content,
            },
        ];

        // 60秒超时
        let result = timeout(Duration::from_secs(60), self.call_api(messages, 1000)).await??;
        Ok(result)
    }

    pub async fn translate(&self, text: &str, target_language: &str) -> Result<String> {
        let lang_display = self.get_language_name(target_language);

        let messages = vec![
            GLMMessage {
                role: "system".to_string(),
                content: format!(
                    "你是专业翻译助手。请将以下文本翻译为{}，保持 Markdown 格式和 HTML 标签不变，只翻译文本内容。",
                    lang_display
                ),
            },
            GLMMessage {
                role: "user".to_string(),
                content: text.to_string(),
            },
        ];

        // 90秒超时
        let result = timeout(Duration::from_secs(90), self.call_api(messages, 2048)).await??;
        Ok(result)
    }

    pub async fn translate_title(&self, title: &str, target_language: &str) -> Result<String> {
        if title.is_empty() {
            return Ok(String::new());
        }
        self.translate(title, target_language).await
    }
}

