use chrono::{DateTime, Utc, Duration};
use sea_orm::{
    ColumnTrait, QueryFilter, DatabaseConnection, Select,
};

use crate::models::{
    feed::Entity as Feed,
    entry::Entity as Entry,
};

/// 时间范围过滤器
pub struct DateFilterer;

impl DateFilterer {
    /// 根据时间范围字符串计算开始时间
    pub fn parse_date_range(date_range: &str) -> Option<DateTime<Utc>> {
        let now = Utc::now();

        match date_range {
            "1d" => Some(now - Duration::days(1)),
            "2d" => Some(now - Duration::days(2)),
            "3d" => Some(now - Duration::days(3)),
            "7d" => Some(now - Duration::days(7)),
            "30d" => Some(now - Duration::days(30)),
            "90d" => Some(now - Duration::days(90)),
            "180d" => Some(now - Duration::days(180)),
            "365d" => Some(now - Duration::days(365)),
            "all" => None,
            _ => None,
        }
    }

    /// 解析时间字段名称
    pub fn parse_time_field(time_field: &str) -> &'static str {
        match time_field {
            "published_at" => "published_at",
            "inserted_at" => "created_at",
            _ => "created_at", // 默认使用创建时间
        }
    }

    /// 应用时间范围过滤到Entry查询
    pub fn apply_date_filter_to_entries(
        mut query: Select<Entry>,
        date_range: Option<&str>,
        time_field: Option<&str>,
    ) -> Select<Entry> {
        if let Some(range) = date_range {
            if let Some(start_time) = Self::parse_date_range(range) {
                let field = Self::parse_time_field(time_field.unwrap_or("created_at"));

                if field == "published_at" {
                    query = query
                        .filter(crate::models::entry::Column::PublishedAt.gte(start_time));
                } else {
                    query = query
                        .filter(crate::models::entry::Column::CreatedAt.gte(start_time));
                }
            }
        }
        query
    }

    /// 应用时间范围过滤到Feed查询（简化版，按feed的创建时间过滤）
    pub fn apply_date_filter_to_feeds(
        mut query: Select<Feed>,
        date_range: Option<&str>,
        _time_field: Option<&str>,
        _db: &DatabaseConnection,
    ) -> Select<Feed> {
        if let Some(range) = date_range {
            if let Some(start_time) = Self::parse_date_range(range) {
                // 暂时按feed的创建时间过滤
                query = query
                    .filter(crate::models::feed::Column::CreatedAt.gte(start_time));
            }
        }
        query
    }
}

/// 时间范围验证函数
#[allow(dead_code)]
pub fn validate_date_range(date_range: &str) -> bool {
    matches!(date_range, "1d" | "2d" | "3d" | "7d" | "30d" | "90d" | "180d" | "365d" | "all")
}

/// 时间字段验证函数
#[allow(dead_code)]
pub fn validate_time_field(time_field: &str) -> bool {
    matches!(time_field, "published_at" | "created_at" | "inserted_at")
}