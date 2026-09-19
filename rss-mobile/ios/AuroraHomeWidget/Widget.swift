// Aurora home screen widget — implements design doc v2.
//
// Data contract (written by Flutter via home_widget into the shared
// App Group UserDefaults, key "auroraWidgetData"):
// {
//   "updatedAt": 1758…,      // epoch ms of snapshot
//   "unreadCount": 12,
//   "articles": [
//     {"id","title","feed","publishedAtMs","unread","starred"} × 3
//   ],
//   "weekCount": 38,         // articles read in the last 7 days
//   "prevWeekCount": 33      // …in the 7 days before that
// }
//
// Design principles (Apple HIG Widgets, distilled):
// - Glanceable: two information layers only (meta line + title).
// - Size = amount of information, not a scaled copy of another size.
// - Dual encoding for unread state (weight + color) so the widget still
//   reads correctly in tinted/monochrome rendering modes.
// - Relative timestamps driven by the system (no refresh budget spent).
// - Honest staleness indicator when the snapshot is older than 12h.

import SwiftUI
import WidgetKit

// MARK: - Flavor

enum AuroraHomeWidgetFlavor {
  static let appGroupId = "group.com.xiongsircool.aurora.mobile"
  static let dataKey = "auroraWidgetData"

  static let orange = Color(red: 232 / 255, green: 93 / 255, blue: 36 / 255)
  static let teal = Color(red: 8 / 255, green: 126 / 255, blue: 139 / 255)
}

// MARK: - Data model

struct AuroraArticle: Codable, Identifiable {
  let id: String
  let title: String
  let feed: String
  let publishedAtMs: Int64
  let unread: Bool
  let starred: Bool

  var publishedAt: Date {
    Date(timeIntervalSince1970: Double(publishedAtMs) / 1000)
  }
}

struct AuroraWidgetData: Codable {
  let updatedAt: Int64
  let unreadCount: Int
  let articles: [AuroraArticle]
  let weekCount: Int
  let prevWeekCount: Int

  var updatedAtDate: Date {
    Date(timeIntervalSince1970: Double(updatedAt) / 1000)
  }

  /// Sample content used for the widget gallery placeholder.
  static let sample = AuroraWidgetData(
    updatedAt: Int64(Date().timeIntervalSince1970 * 1000),
    unreadCount: 12,
    articles: [
      AuroraArticle(
        id: "s1", title: "Flutter 3.35 发布:全新渲染管线带来性能提升",
        feed: "少数派", publishedAtMs: Int64(Date().timeIntervalSince1970 * 1000 - 480),
        unread: true, starred: false),
      AuroraArticle(
        id: "s2", title: "罕见病目录 CARD-Cv2 发布首个中国大陆人群版本",
        feed: "生物世界", publishedAtMs: Int64(Date().timeIntervalSince1970 * 1000 - 1920),
        unread: true, starred: true),
      AuroraArticle(
        id: "s3", title: "从零搭建一套 RSS 聚合服务的完整实践指南",
        feed: "少数派", publishedAtMs: Int64(Date().timeIntervalSince1970 * 1000 - 86400),
        unread: false, starred: false),
    ],
    weekCount: 38,
    prevWeekCount: 33
  )

  static func load() -> AuroraWidgetData? {
    guard
      let prefs = UserDefaults(suiteName: AuroraHomeWidgetFlavor.appGroupId),
      let json = prefs.string(forKey: AuroraHomeWidgetFlavor.dataKey)?.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(AuroraWidgetData.self, from: json)
  }
}

// MARK: - Timeline

struct AuroraHomeWidgetEntry: TimelineEntry {
  let date: Date
  let data: AuroraWidgetData?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> AuroraHomeWidgetEntry {
    AuroraHomeWidgetEntry(date: Date(), data: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (AuroraHomeWidgetEntry) -> Void) {
    completion(AuroraHomeWidgetEntry(date: Date(), data: AuroraWidgetData.load() ?? .sample))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AuroraHomeWidgetEntry>) -> Void) {
    let entry = AuroraHomeWidgetEntry(date: Date(), data: AuroraWidgetData.load())
    // Flutter pushes fresh snapshots after each feed refresh (every ~3h);
    // let the system pick the actual moment within its daily budget.
    completion(Timeline(entries: [entry], policy: .after(Date(timeIntervalSinceNow: 3 * 3600))))
  }
}

// MARK: - Shared pieces

private struct MetaLine: View {
  let article: AuroraArticle

  var body: some View {
    HStack(spacing: 4) {
      if article.unread {
        Circle()
          .fill(AuroraHomeWidgetFlavor.orange)
          .frame(width: 5, height: 5)
      }
      if !article.feed.isEmpty {
        Text(article.feed)
          .foregroundStyle(AuroraHomeWidgetFlavor.teal)
      }
      if !article.feed.isEmpty {
        Text("·").foregroundStyle(.secondary)
      }
      // System-managed relative time: stays fresh without spending
      // any of the widget's daily refresh budget.
      Text(article.publishedAt, style: .offset)
      if article.starred {
        Image(systemName: "star.fill")
          .font(.system(size: 8))
          .foregroundStyle(.yellow)
      }
    }
    .font(.system(size: 11, weight: .medium))
    .foregroundStyle(.secondary)
    .lineLimit(1)
  }
}

private struct ArticleRow: View {
  let article: AuroraArticle

  var body: some View {
    Link(destination: URL(string: "aurora://article/\(article.id)?homeWidget")!) {
      VStack(alignment: .leading, spacing: 2) {
        MetaLine(article: article)
        HStack(alignment: .top, spacing: 4) {
          Text(article.title)
            // Dual encoding: weight AND color carry the unread state so
            // tinted/monochrome rendering stays readable (HIG).
            .font(.system(size: 14, weight: article.unread ? .semibold : .regular))
            .foregroundStyle(article.unread ? Color.primary : Color.secondary)
            .lineLimit(2)
        }
      }
    }
  }
}

private struct Hairline: View {
  var body: some View {
    LinearGradient(
      colors: [AuroraHomeWidgetFlavor.orange, AuroraHomeWidgetFlavor.teal],
      startPoint: .leading, endPoint: .trailing
    )
    .frame(height: 2.5)
  }
}

private struct UnreadBadge: View {
  let count: Int

  var body: some View {
    Text("\(count)")
      .font(.system(size: 11, weight: .bold))
      .foregroundStyle(.white)
      .padding(.horizontal, 7)
      .padding(.vertical, 2)
      .background(Capsule().fill(AuroraHomeWidgetFlavor.teal))
  }
}

// MARK: - Medium: latest articles

private struct MediumView: View {
  let entry: AuroraHomeWidgetEntry

  private var staleHours: Int? {
    guard let updated = entry.data?.updatedAtDate else { return nil }
    let age = Date().timeIntervalSince(updated)
    guard age > 12 * 3600 else { return nil }
    return Int(age / 3600)
  }

  var body: some View {
    VStack(spacing: 0) {
      Hairline()
      if let data = entry.data, !data.articles.isEmpty {
        VStack(alignment: .leading, spacing: 7) {
          HStack(spacing: 6) {
            Text("AURORA")
              .font(.system(size: 10, weight: .heavy))
              .kerning(1.5)
              .foregroundStyle(.secondary)
            if let hours = staleHours {
              Text("· \(hours)小时前更新")
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
            }
            Spacer()
            if data.unreadCount > 0 {
              UnreadBadge(count: data.unreadCount)
            }
          }
          ForEach(data.articles) { ArticleRow(article: $0) }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
      } else {
        // All caught up — celebrate instead of showing an error.
        VStack(spacing: 4) {
          Text("🎉").font(.system(size: 28))
          Text("全部读完了").font(.system(size: 14, weight: .semibold))
          Text("打开 Aurora 刷新订阅源")
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "aurora://home?homeWidget"))
      }
    }
  }
}

// MARK: - Small: weekly reading stats (one idea only — HIG)

private struct SmallStatsView: View {
  let entry: AuroraHomeWidgetEntry

  private var deltaText: (String, Color)? {
    guard let data = entry.data else { return nil }
    let delta = data.weekCount - data.prevWeekCount
    if delta > 0 { return ("↑ 比上周多 \(delta) 篇", AuroraHomeWidgetFlavor.teal) }
    if delta < 0 { return ("↓ 比上周少 \(-delta) 篇", .secondary) }
    return ("与上周持平", .secondary)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Spacer(minLength: 0)
      Text(entry.data?.articles.isEmpty == false ? "本周已读" : "🎉 本周读完")
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(.secondary)
      HStack(alignment: .firstTextBaseline, spacing: 3) {
        Text("\(entry.data?.weekCount ?? 0)")
          .font(.system(size: 38, weight: .bold, design: .rounded))
          .foregroundStyle(AuroraHomeWidgetFlavor.orange)
        Text("篇")
          .font(.system(size: 13))
          .foregroundStyle(.secondary)
      }
      .minimumScaleFactor(0.6)
      if let (text, color) = deltaText {
        Text(text)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(color)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .widgetURL(URL(string: "aurora://stats?homeWidget"))
  }
}

// MARK: - Lock screen accessories (iOS 16+)

@available(iOSApplicationExtension 16.0, *)
private struct InlineView: View {
  let entry: AuroraHomeWidgetEntry

  var body: some View {
    if let first = entry.data?.articles.first {
      // Inline accessory supports a single tap target (HIG).
      Text("● \(first.title)")
        .widgetURL(URL(string: "aurora://article/\(first.id)?homeWidget"))
    } else {
      Text("Aurora · 全部读完")
        .widgetURL(URL(string: "aurora://home?homeWidget"))
    }
  }
}

@available(iOSApplicationExtension 16.0, *)
private struct RectangularView: View {
  let entry: AuroraHomeWidgetEntry

  var body: some View {
    if let first = entry.data?.articles.first {
      VStack(alignment: .leading, spacing: 2) {
        Text("AURORA")
          .font(.system(size: 10, weight: .heavy))
          .kerning(1.2)
          .foregroundStyle(AuroraHomeWidgetFlavor.teal)
        Text(first.title)
          .font(.system(size: 13, weight: .semibold))
          .lineLimit(2)
        HStack(spacing: 4) {
          if !first.feed.isEmpty { Text(first.feed) }
          if !first.feed.isEmpty { Text("·") }
          Text(first.publishedAt, style: .offset)
        }
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
      }
      .widgetURL(URL(string: "aurora://article/\(first.id)?homeWidget"))
    } else {
      VStack(alignment: .leading, spacing: 2) {
        Text("AURORA")
          .font(.system(size: 10, weight: .heavy))
          .kerning(1.2)
          .foregroundStyle(AuroraHomeWidgetFlavor.teal)
        Text("🎉 全部读完了")
          .font(.system(size: 13, weight: .semibold))
      }
      .widgetURL(URL(string: "aurora://home?homeWidget"))
    }
  }
}

// MARK: - Root view

struct AuroraHomeWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: AuroraHomeWidgetEntry

  @ViewBuilder
  var body: some View {
    content.auroraWidgetBackground()
  }

  @ViewBuilder
  private var content: some View {
    switch family {
    case .systemSmall:
      SmallStatsView(entry: entry)
    case .accessoryInline:
      if #available(iOSApplicationExtension 16.0, *) {
        InlineView(entry: entry)
      } else {
        SmallStatsView(entry: entry)
      }
    case .accessoryRectangular:
      if #available(iOSApplicationExtension 16.0, *) {
        RectangularView(entry: entry)
      } else {
        SmallStatsView(entry: entry)
      }
    default:
      MediumView(entry: entry)
    }
  }
}

// MARK: - Widget registration

struct AuroraHomeWidget: Widget {
  let kind: String = "AuroraHomeWidget"

  private var supportedFamilies: [WidgetFamily] {
    var families: [WidgetFamily] = [.systemSmall, .systemMedium]
    if #available(iOSApplicationExtension 16.0, *) {
      families.append(contentsOf: [.accessoryInline, .accessoryRectangular])
    }
    return families
  }

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      AuroraHomeWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Aurora 最新文章")
    .description("最新未读文章与每周阅读统计,点按直达正文。")
    .supportedFamilies(supportedFamilies)
  }
}

// MARK: - Container background (iOS 17 tinted/clear modes)

extension View {
  @ViewBuilder
  func auroraWidgetBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      self.containerBackground(.fill.tertiary, for: .widget)
    } else if #available(iOSApplicationExtension 15.0, *) {
      self.background()
    } else {
      self
    }
  }
}

#Preview("medium", body: {
  AuroraHomeWidgetEntryView(
    entry: AuroraHomeWidgetEntry(date: Date(), data: .sample)
  )
  .previewContext(WidgetPreviewContext(family: .systemMedium))
})

#Preview("small", body: {
  AuroraHomeWidgetEntryView(
    entry: AuroraHomeWidgetEntry(date: Date(), data: .sample)
  )
  .previewContext(WidgetPreviewContext(family: .systemSmall))
})
