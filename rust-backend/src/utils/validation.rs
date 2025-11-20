pub fn validate_url(url: &str) -> Result<(), String> {
    if url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    Ok(())
}

pub fn validate_rss_url(url: &str) -> Result<(), String> {
    validate_url(url)?;

    // Additional RSS-specific validation could be added here
    if !url.contains("rss") && !url.contains("feed") && !url.contains("xml") {
        // Just a warning, not an error
    }

    Ok(())
}

#[allow(dead_code)]
pub fn validate_pagination(page: u32, limit: u32) -> Result<(), String> {
    if page == 0 {
        return Err("Page must be greater than 0".to_string());
    }

    if limit == 0 || limit > 1000 {
        return Err("Limit must be between 1 and 1000".to_string());
    }

    Ok(())
}