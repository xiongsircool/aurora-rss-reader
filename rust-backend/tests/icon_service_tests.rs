mod common;

use common::create_test_app_state;
use rss_backend::models::site_icon;
use rss_backend::services::icon_service::IconService;
use sea_orm::{ActiveModelTrait, Set};
use std::time::Duration;
use tokio::time::sleep;

/// 测试图标服务创建
#[tokio::test]
async fn test_icon_service_creation() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 验证服务创建成功
    assert!(true); // 如果能创建成功，这个测试就通过了
}

/// 测试图标URL生成
#[tokio::test]
async fn test_generate_icon_urls() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    let domain = "example.com";
    let urls = icon_service.generate_icon_urls(domain);

    // 应该生成多个图标URL
    assert!(urls.len() > 0);

    // 检查是否包含常见的图标URL模式
    let expected_urls = vec![
        format!("https://{}/favicon.ico", domain),
        format!("https://{}/favicon.png", domain),
        format!("https://{}/apple-touch-icon.png", domain),
        format!("https://www.{}/favicon.ico", domain),
        format!("https://icons.duckduckgo.com/ip3/{}.ico", domain),
        format!("https://www.google.com/s2/favicons?domain={}", domain),
    ];

    for expected_url in expected_urls {
        assert!(urls.contains(&expected_url), "Missing URL: {}", expected_url);
    }
}

/// 测试从数据库获取缓存的图标
#[tokio::test]
async fn test_get_cached_icon() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 先在数据库中创建一个图标记录
    let domain = "cached-domain.com";
    let icon_id = uuid::Uuid::new_v4().to_string();

    let icon_model = site_icon::ActiveModel {
        id: Set(icon_id.clone()),
        domain: Set(domain.to_string()),
        icon_url: Set(Some("https://example.com/favicon.ico".to_string())),
        icon_data: Set(Some("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string())), // 1x1透明PNG的base64
        icon_type: Set(Some("image/png".to_string())),
        icon_size: Set(Some(67)),
        last_fetched: Set(Some(chrono::Utc::now())),
        expires_at: Set(Some(chrono::Utc::now() + chrono::Duration::days(7))),
        error_count: Set(0),
        ..Default::default()
    };

    icon_model.insert(&*db).await.unwrap();

    // 尝试获取缓存的图标
    let icon_data = icon_service.get_cached_icon(domain).await.unwrap();

    // 应该找到缓存的图标
    assert!(icon_data.is_some());

    let icon = icon_data.unwrap();
    assert_eq!(icon.domain, domain);
    assert!(icon.icon_data.is_some());
    assert_eq!(icon.icon_type, Some("image/png".to_string()));
}

/// 测试获取过期的缓存图标
#[tokio::test]
async fn test_get_expired_cached_icon() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 先在数据库中创建一个过期的图标记录
    let domain = "expired-domain.com";
    let icon_id = uuid::Uuid::new_v4().to_string();

    let icon_model = site_icon::ActiveModel {
        id: Set(icon_id.clone()),
        domain: Set(domain.to_string()),
        icon_url: Set(Some("https://example.com/favicon.ico".to_string())),
        icon_data: Set(Some("fake-icon-data".to_string())),
        icon_type: Set(Some("image/x-icon".to_string())),
        icon_size: Set(Some(100)),
        last_fetched: Set(Some(chrono::Utc::now() - chrono::Duration::days(8))), // 8天前
        expires_at: Set(Some(chrono::Utc::now() - chrono::Duration::days(1))), // 昨天
        error_count: Set(0),
        ..Default::default()
    };

    icon_model.insert(&*db).await.unwrap();

    // 尝试获取过期的缓存图标
    let icon_data = icon_service.get_cached_icon(domain).await.unwrap();

    // 应该返回None，因为图标已过期
    assert!(icon_data.is_none());
}

/// 测试图标缓存失效
#[tokio::test]
async fn test_invalidate_cache() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 先在数据库中创建一个图标记录
    let domain = "invalidate-domain.com";
    let icon_id = uuid::Uuid::new_v4().to_string();

    let icon_model = site_icon::ActiveModel {
        id: Set(icon_id.clone()),
        domain: Set(domain.to_string()),
        icon_url: Set(Some("https://example.com/favicon.ico".to_string())),
        icon_data: Set(Some("cached-icon-data".to_string())),
        icon_type: Set(Some("image/png".to_string())),
        icon_size: Set(Some(100)),
        last_fetched: Set(Some(chrono::Utc::now())),
        expires_at: Set(Some(chrono::Utc::now() + chrono::Duration::days(7))),
        error_count: Set(0),
        ..Default::default()
    };

    icon_model.insert(&*db).await.unwrap();

    // 验证图标存在
    let icon_before = icon_service.get_cached_icon(domain).await.unwrap();
    assert!(icon_before.is_some());

    // 失效缓存
    icon_service.invalidate_cache(domain).await.unwrap();

    // 验证图标已被删除
    let icon_after = icon_service.get_cached_icon(domain).await.unwrap();
    assert!(icon_after.is_none());
}

/// 测试清理过期图标
#[tokio::test]
async fn test_cleanup_expired_icons() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 创建一个过期图标
    let expired_domain = "expired-cleanup.com";
    let expired_icon_id = uuid::Uuid::new_v4().to_string();

    let expired_icon = site_icon::ActiveModel {
        id: Set(expired_icon_id.clone()),
        domain: Set(expired_domain.to_string()),
        icon_url: Set(Some("https://example.com/favicon.ico".to_string())),
        icon_data: Set(Some("expired-icon-data".to_string())),
        icon_type: Set(Some("image/png".to_string())),
        icon_size: Set(Some(100)),
        last_fetched: Set(Some(chrono::Utc::now() - chrono::Duration::days(8))),
        expires_at: Set(Some(chrono::Utc::now() - chrono::Duration::days(1))), // 已过期
        error_count: Set(0),
        ..Default::default()
    };

    expired_icon.insert(&*db).await.unwrap();

    // 创建一个未过期图标
    let valid_domain = "valid-cleanup.com";
    let valid_icon_id = uuid::Uuid::new_v4().to_string();

    let valid_icon = site_icon::ActiveModel {
        id: Set(valid_icon_id.clone()),
        domain: Set(valid_domain.to_string()),
        icon_url: Set(Some("https://example.com/favicon.ico".to_string())),
        icon_data: Set(Some("valid-icon-data".to_string())),
        icon_type: Set(Some("image/png".to_string())),
        icon_size: Set(Some(100)),
        last_fetched: Set(Some(chrono::Utc::now())),
        expires_at: Set(Some(chrono::Utc::now() + chrono::Duration::days(7))), // 未过期
        error_count: Set(0),
        ..Default::default()
    };

    valid_icon.insert(&*db).await.unwrap();

    // 清理过期图标
    let deleted_count = icon_service.cleanup_expired_icons().await.unwrap();

    // 应该删除了1个过期图标
    assert_eq!(deleted_count, 1);

    // 验证过期图标已被删除
    let expired_check = site_icon::Entity::find_by_id(expired_icon_id)
        .one(&*db)
        .await
        .unwrap();
    assert!(expired_check.is_none());

    // 验证未过期图标仍然存在
    let valid_check = site_icon::Entity::find_by_id(valid_icon_id)
        .one(&*db)
        .await
        .unwrap();
    assert!(valid_check.is_some());
}

/// 测试错误次数过多的图标清理
#[tokio::test]
async fn test_cleanup_high_error_icons() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 创建一个错误次数过多的图标
    let high_error_domain = "high-error.com";
    let high_error_icon_id = uuid::Uuid::new_v4().to_string();

    let high_error_icon = site_icon::ActiveModel {
        id: Set(high_error_icon_id.clone()),
        domain: Set(high_error_domain.to_string()),
        icon_url: Set(Some("https://example.com/favicon.ico".to_string())),
        icon_data: Set(None), // 没有图标数据
        icon_type: Set(None),
        icon_size: Set(None),
        last_fetched: Set(Some(chrono::Utc::now())),
        expires_at: Set(None),
        error_count: Set(5), // 错误次数过多
        ..Default::default()
    };

    high_error_icon.insert(&*db).await.unwrap();

    // 创建一个错误次数较少的图标
    let low_error_domain = "low-error.com";
    let low_error_icon_id = uuid::Uuid::new_v4().to_string();

    let low_error_icon = site_icon::ActiveModel {
        id: Set(low_error_icon_id.clone()),
        domain: Set(low_error_domain.to_string()),
        icon_url: Set(Some("https://example.com/favicon.ico".to_string())),
        icon_data: Set(None),
        icon_type: Set(None),
        icon_size: Set(None),
        last_fetched: Set(Some(chrono::Utc::now())),
        expires_at: Set(None),
        error_count: Set(2), // 错误次数较少
        ..Default::default()
    };

    low_error_icon.insert(&*db).await.unwrap();

    // 清理错误次数过多的图标
    let deleted_count = icon_service.cleanup_expired_icons().await.unwrap();

    // 应该删除了1个错误次数过多的图标
    assert_eq!(deleted_count, 1);

    // 验证错误次数过多的图标已被删除
    let high_error_check = site_icon::Entity::find_by_id(high_error_icon_id)
        .one(&*db)
        .await
        .unwrap();
    assert!(high_error_check.is_none());

    // 验证错误次数较少的图标仍然存在
    let low_error_check = site_icon::Entity::find_by_id(low_error_icon_id)
        .one(&*db)
        .await
        .unwrap();
    assert!(low_error_check.is_some());
}

/// 测试获取所有图标
#[tokio::test]
async fn test_get_all_icons() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 创建多个图标记录
    for i in 1..=3 {
        let domain = format!("domain{}.com", i);
        let icon_id = uuid::Uuid::new_v4().to_string();

        let icon_model = site_icon::ActiveModel {
            id: Set(icon_id),
            domain: Set(domain),
            icon_url: Set(Some(format!("https://domain{}.com/favicon.ico", i))),
            icon_data: Set(Some(format!("icon-data-{}", i))),
            icon_type: Set(Some("image/x-icon".to_string())),
            icon_size: Set(Some(100)),
            last_fetched: Set(Some(chrono::Utc::now())),
            expires_at: Set(Some(chrono::Utc::now() + chrono::Duration::days(7))),
            error_count: Set(0),
            ..Default::default()
        };

        icon_model.insert(&*db).await.unwrap();
    }

    // 获取所有图标
    let icons = icon_service.get_all_icons().await.unwrap();

    // 应该返回3个图标
    assert_eq!(icons.len(), 3);

    // 验证图标数据
    for icon in icons {
        assert!(icon.icon_data.is_some());
        assert_eq!(icon.icon_type, Some("image/x-icon".to_string()));
    }
}

/// 测试获取所有图标（无数据时）
#[tokio::test]
async fn test_get_all_icons_empty() {
    let db = common::get_test_db().await;
    let icon_service = IconService::new((*db).clone());

    // 获取所有图标（数据库为空）
    let icons = icon_service.get_all_icons().await.unwrap();

    // 应该返回空列表
    assert!(icons.is_empty());
}