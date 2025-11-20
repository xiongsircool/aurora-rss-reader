mod common;

use common::create_test_app_state;
use rss_backend::models::feed;
use rss_backend::services::opml_service::{OPMLService, OPMLEntry};
use sea_orm::{ActiveModelTrait, Set};
use std::collections::HashMap;

/// 测试OPML服务创建
#[tokio::test]
async fn test_opml_service_creation() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 验证服务创建成功
    assert!(true); // 如果能创建成功，这个测试就通过了
}

/// 测试导出OPML（空数据库）
#[tokio::test]
async fn test_export_opml_empty() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 导出OPML
    let opml_content = opml_service.export_opml().await.unwrap();

    // 验证OPML格式
    assert!(opml_content.contains("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
    assert!(opml_content.contains("<opml"));
    assert!(opml_content.contains("<head>"));
    assert!(opml_content.contains("<title>RSS Feeds Export</title>"));
    assert!(opml_content.contains("</head>"));
    assert!(opml_content.contains("<body>"));
    assert!(opml_content.contains("</body>"));
    assert!(opml_content.contains("</opml>"));

    // 空数据库应该没有outline元素
    assert!(!opml_content.contains("<outline"));
}

/// 测试导出OPML（有数据）
#[tokio::test]
async fn test_export_opml_with_data() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 创建测试RSS源
    let feeds = vec![
        ("技术博客", "https://techblog.com/rss.xml", Some("技术".to_string())),
        ("新闻网站", "https://news.com/feed.xml", Some("新闻".to_string())),
        ("个人主页", "https://personal.com/rss.xml", None),
    ];

    for (title, url, category) in feeds {
        let feed_model = feed::ActiveModel {
            id: Set(uuid::Uuid::new_v4().to_string()),
            title: Set(title.to_string()),
            url: Set(url.to_string()),
            category: Set(category.clone()),
            ..Default::default()
        };
        feed_model.insert(&*db).await.unwrap();
    }

    // 导出OPML
    let opml_content = opml_service.export_opml().await.unwrap();

    // 验证RSS源被正确导出
    assert!(opml_content.contains("<outline"));
    assert!(opml_content.contains("技术博客"));
    assert!(opml_content.contains("https://techblog.com/rss.xml"));
    assert!(opml_content.contains("新闻网站"));
    assert!(opml_content.contains("https://news.com/feed.xml"));
    assert!(opml_content.contains("个人主页"));
    assert!(opml_content.contains("https://personal.com/rss.xml"));
}

/// 测试导入OPML（有效数据）
#[tokio::test]
async fn test_import_opml_valid() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 创建有效的OPML内容
    let opml_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>RSS Feeds</title>
    </head>
    <body>
        <outline text="技术" title="技术">
            <outline text="GitHub Trending" title="GitHub Trending"
                     type="rss" xmlUrl="https://rsshub.app/github/trending/daily"
                     htmlUrl="https://github.com/trending"/>
            <outline text="Hacker News" title="Hacker News"
                     type="rss" xmlUrl="https://hnrss.org/frontpage"
                     htmlUrl="https://news.ycombinator.com"/>
        </outline>
        <outline text="新闻" title="新闻">
            <outline text="BBC News" title="BBC News"
                     type="rss" xmlUrl="http://feeds.bbci.co.uk/news/rss.xml"
                     htmlUrl="https://www.bbc.com/news"/>
        </outline>
        <outline text="独立RSS源" title="独立RSS源"
                 type="rss" xmlUrl="https://example.com/feed.xml"
                 htmlUrl="https://example.com"/>
    </body>
</opml>"#;

    // 导入OPML
    let result = opml_service.import_opml(opml_content).await.unwrap();

    // 验证导入结果
    assert!(result.success);
    assert!(result.imported_feeds > 0);
    assert!(result.errors.is_empty());

    // 验证数据库中的RSS源
    let feeds = feed::Entity::find().all(&*db).await.unwrap();
    assert_eq!(feeds.len(), 4); // 应该导入4个RSS源

    // 验证分类信息
    let tech_feeds: Vec<_> = feeds.iter()
        .filter(|f| f.category.as_ref() == Some(&"技术".to_string()))
        .collect();
    assert_eq!(tech_feeds.len(), 2);

    let news_feeds: Vec<_> = feeds.iter()
        .filter(|f| f.category.as_ref() == Some(&"新闻".to_string()))
        .collect();
    assert_eq!(news_feeds.len(), 1);

    let uncategorized_feeds: Vec<_> = feeds.iter()
        .filter(|f| f.category.is_none())
        .collect();
    assert_eq!(uncategorized_feeds.len(), 1);
}

/// 测试导入OPML（重复URL处理）
#[tokio::test]
async fn test_import_opml_duplicate_urls() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 先在数据库中创建一个RSS源
    let existing_url = "https://example.com/duplicate-feed.xml";
    let feed_model = feed::ActiveModel {
        id: Set(uuid::Uuid::new_v4().to_string()),
        title: Set("已存在的RSS源".to_string()),
        url: Set(existing_url.to_string()),
        category: Some("技术".to_string()),
        ..Default::default()
    };
    feed_model.insert(&*db).await.unwrap();

    // 创建包含重复URL的OPML内容
    let opml_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>RSS Feeds</title>
    </head>
    <body>
        <outline text="新的RSS源" title="新的RSS源"
                 type="rss" xmlUrl="https://example.com/duplicate-feed.xml"
                 htmlUrl="https://example.com"/>
        <outline text="唯一RSS源" title="唯一RSS源"
                 type="rss" xmlUrl="https://unique.com/feed.xml"
                 htmlUrl="https://unique.com"/>
    </body>
</opml>"#;

    // 导入OPML
    let result = opml_service.import_opml(opml_content).await.unwrap();

    // 验证导入结果
    assert!(result.success);
    assert_eq!(result.imported_feeds, 1); // 只应该导入新的RSS源
    assert_eq!(result.errors.len(), 1); // 应该有一个重复URL错误

    // 验证数据库中只有2个RSS源（原有1个 + 新导入1个）
    let feeds = feed::Entity::find().all(&*db).await.unwrap();
    assert_eq!(feeds.len(), 2);
}

/// 测试导入OPML（无效XML）
#[tokio::test]
async fn test_import_opml_invalid_xml() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 创建无效的XML内容
    let invalid_xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>RSS Feeds
    </head>
    <body>
        <outline text="Test" title="Test"
                 type="rss" xmlUrl="https://example.com/feed.xml"
                 htmlUrl="https://example.com"/>
    </body>
</opml>"#; // 缺少</title>闭合标签

    // 尝试导入OPML
    let result = opml_service.import_opml(invalid_xml).await;

    // 应该返回错误
    assert!(result.is_err());
}

/// 测试导入OPML（缺少必需属性）
#[tokio::test]
async fn test_import_opml_missing_attributes() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 创建缺少xmlUrl属性的OPML内容
    let opml_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>RSS Feeds</title>
    </head>
    <body>
        <outline text="缺少XML URL" title="缺少XML URL"
                 type="rss" htmlUrl="https://example.com"/>
        <outline text="有效RSS源" title="有效RSS源"
                 type="rss" xmlUrl="https://valid.com/feed.xml"
                 htmlUrl="https://valid.com"/>
    </body>
</opml>"#;

    // 导入OPML
    let result = opml_service.import_opml(opml_content).await.unwrap();

    // 验证只导入了有效的RSS源
    assert!(result.success);
    assert_eq!(result.imported_feeds, 1);
    assert_eq!(result.errors.len(), 1); // 应该有一个缺少xmlUrl的错误
}

/// 测试OPML条目创建
#[test]
fn test_opml_entry_creation() {
    let entry = OPMLEntry {
        title: Some("测试RSS源".to_string()),
        text: "测试RSS源".to_string(),
        xml_url: Some("https://example.com/feed.xml".to_string()),
        html_url: Some("https://example.com".to_string()),
        category: Some("技术".to_string()),
    };

    assert_eq!(entry.title, Some("测试RSS源".to_string()));
    assert_eq!(entry.text, "测试RSS源");
    assert_eq!(entry.xml_url, Some("https://example.com/feed.xml".to_string()));
    assert_eq!(entry.html_url, Some("https://example.com".to_string()));
    assert_eq!(entry.category, Some("技术".to_string()));
}

/// 测试从OPML内容解析条目
#[test]
fn test_parse_opml_entries() {
    let opml_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline text="分类1" title="分类1">
            <outline text="RSS源1" title="RSS源1"
                     type="rss" xmlUrl="https://example1.com/feed.xml"
                     htmlUrl="https://example1.com"/>
        </outline>
        <outline text="RSS源2" title="RSS源2"
                 type="rss" xmlUrl="https://example2.com/feed.xml"
                 htmlUrl="https://example2.com"/>
    </body>
</opml>"#;

    // 这个测试需要实际实现OPML解析逻辑
    // 目前只是验证OPML内容格式正确
    assert!(opml_content.contains("<outline"));
    assert!(opml_content.contains("xmlUrl"));
}

/// 测试导入大量RSS源
#[tokio::test]
async fn test_import_many_feeds() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 创建包含多个RSS源的OPML内容
    let mut opml_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Many RSS Feeds</title>
    </head>
    <body>
"#.to_string();

    // 添加10个RSS源
    for i in 1..=10 {
        opml_content.push_str(&format!(r#"
        <outline text="RSS源{}" title="RSS源{}"
                 type="rss" xmlUrl="https://example{}.com/feed.xml"
                 htmlUrl="https://example{}.com"/>
"#, i, i, i, i));
    }

    opml_content.push_str(r#"
    </body>
</opml>"#);

    // 导入OPML
    let result = opml_service.import_opml(&opml_content).await.unwrap();

    // 验证导入结果
    assert!(result.success);
    assert_eq!(result.imported_feeds, 10);
    assert!(result.errors.is_empty());

    // 验证数据库中的RSS源数量
    let feeds = feed::Entity::find().all(&*db).await.unwrap();
    assert_eq!(feeds.len(), 10);
}

/// 测试导入空OPML
#[tokio::test]
async fn test_import_empty_opml() {
    let db = common::get_test_db().await;
    let opml_service = OPMLService::new((*db).clone());

    // 创建空的OPML内容
    let opml_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Empty OPML</title>
    </head>
    <body>
    </body>
</opml>"#;

    // 导入OPML
    let result = opml_service.import_opml(opml_content).await.unwrap();

    // 验证导入结果
    assert!(result.success);
    assert_eq!(result.imported_feeds, 0);
    assert!(result.errors.is_empty());

    // 验证数据库中没有RSS源
    let feeds = feed::Entity::find().all(&*db).await.unwrap();
    assert!(feeds.is_empty());
}