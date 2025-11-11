# RSS 时间解析说明

## 概述

RSS订阅源使用多种时间格式，系统现在支持全面的时间解析，包括RSSHub等服务使用的标准RSS `<pubDate>` 格式。

## 支持的时间格式

### 1. RSS 2.0 标准格式（RFC 822/2822）

最常见的RSS时间格式，用于 `<pubDate>` 标签：

```xml
<pubDate>Tue, 04 Nov 2014 00:00:00 GMT</pubDate>
```

**解析方法**：使用Python标准库 `email.utils.parsedate_to_datetime`

**示例来源**：
- RSSHub: `http://58.198.178.157:1200/nature/research/nrg`
- Nature期刊RSS feeds
- 大多数标准RSS 2.0 feeds

### 2. Atom 格式（ISO 8601）

Atom feeds使用ISO 8601格式：

```xml
<published>2014-11-04T00:00:00Z</published>
<updated>2014-11-04T00:00:00Z</updated>
```

**解析方法**：使用 `datetime.fromisoformat`

### 3. 其他格式

- **描述字段中的时间**：从HTML描述中提取（例如："Publication date: December 2025"）
- **多种字段名称**：支持 `published`, `updated`, `created`, `date`, `pubdate`, `issued` 等

## 解析策略

系统使用多层级的解析策略，按以下顺序尝试：

### 第1层：已解析的时间结构
- `published_parsed`
- `updated_parsed`
- `created_parsed`
- `date_parsed`
- `pubdate_parsed`
- `issued_parsed`

### 第2层：字符串时间字段
对每个时间字段尝试多种解析方法：

1. **RFC 822/2822 解析** (新增)
   - 使用 `email.utils.parsedate_to_datetime`
   - 专门处理RSS的 `<pubDate>` 格式
   - 示例：`Tue, 04 Nov 2014 00:00:00 GMT`

2. **ISO 8601 解析**
   - 使用 `datetime.fromisoformat`
   - 处理Atom格式和现代日期格式
   - 示例：`2014-11-04T00:00:00Z`

3. **Feedparser内置解析** (备用)
   - 仅在可用时使用
   - 提供额外的兼容性

### 第3层：从描述中提取
当标准字段都无法解析时，从内容描述中提取时间信息。

## 代码位置

### 主要解析函数
- **文件**：`backend/app/services/fetcher.py`
- **函数**：`_parse_datetime(item: Any) -> datetime | None`
- **行数**：272-357

### 数据库更新脚本
- **文件**：`backend/scripts/update_missing_times.py`
- **函数**：`_parse_datetime_enhanced_local(item)`
- **行数**：17-91

## 调试

解析函数包含详细的调试日志。要查看时间解析过程，可以启用DEBUG级别日志：

```python
import logging
logging.getLogger('app.services.fetcher').setLevel(logging.DEBUG)
```

日志输出示例：
```
DEBUG:app.services.fetcher:尝试解析时间字符串字段 published: Tue, 04 Nov 2014 00:00:00 GMT
DEBUG:app.services.fetcher:使用parsedate_to_datetime从published解析时间: 2014-11-04 00:00:00+00:00
```

## 测试

可以使用以下Python代码测试RSS feed的时间解析：

```python
import feedparser
from email.utils import parsedate_to_datetime

# 解析RSS feed
parsed = feedparser.parse('http://your-rss-feed-url')

# 查看第一个条目的时间字段
item = parsed.entries[0]
print("published:", item.get('published'))
print("published_parsed:", item.get('published_parsed'))

# 测试解析
if 'published' in item:
    dt = parsedate_to_datetime(item['published'])
    print("解析结果:", dt)
```

## 时区处理

所有解析的时间都会转换为UTC时区：
- 如果时间字符串包含时区信息，会被正确解析
- 如果没有时区信息，默认假设为UTC
- 数据库中存储的时间都是UTC时区

## 更新历史

- **2025-11-11**：添加对RSS `<pubDate>` RFC 822/2822格式的显式支持
- **之前**：支持feedparser已解析的时间结构和ISO格式

