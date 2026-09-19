// Aurora Android home screen widget (Glance/Compose).
// Mirrors the iOS WidgetKit design doc v2: aurora hairline, unread badge,
// latest articles with dual-encoded unread state, deep links into the app.
package com.xiongsircool.aurora.mobile

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import es.antonborri.home_widget.HomeWidgetGlanceState
import es.antonborri.home_widget.HomeWidgetGlanceStateDefinition
import es.antonborri.home_widget.HomeWidgetPlugin
import es.antonborri.home_widget.actionStartActivity
import org.json.JSONObject

private const val WIDGET_DATA_KEY = "auroraWidgetData"

class AuroraHomeWidget : GlanceAppWidget() {
  override val stateDefinition = HomeWidgetGlanceStateDefinition()

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    provideContent { WidgetContent(context, currentState()) }
  }

  override suspend fun providePreview(context: Context, widgetCategory: Int) {
    provideContent {
      WidgetContent(context, HomeWidgetGlanceState(HomeWidgetPlugin.getData(context)))
    }
  }
}

private data class WidgetArticle(
  val id: String,
  val title: String,
  val feed: String,
  val publishedAtMs: Long,
  val unread: Boolean,
  val starred: Boolean,
)

@Composable
private fun WidgetContent(context: Context, currentState: HomeWidgetGlanceState) {
  val data = currentState.preferences.getString(WIDGET_DATA_KEY, null)?.let(::parse)
  val bg = ColorProvider(Color(context.getColor(R.color.aurora_widget_bg)))
  val onBg = ColorProvider(Color(context.getColor(R.color.aurora_widget_on_bg)))
  val secondary = ColorProvider(Color(context.getColor(R.color.aurora_widget_secondary)))
  val teal = ColorProvider(Color(context.getColor(R.color.aurora_widget_teal)))
  val orange = ColorProvider(Color(context.getColor(R.color.aurora_widget_orange)))
  val white = ColorProvider(Color(context.getColor(R.color.aurora_widget_white)))

  Box(
    modifier = GlanceModifier.fillMaxSize().background(bg).cornerRadius(20.dp)
  ) {
    if (data == null || data.articles.isEmpty()) {
      Column(
        modifier = GlanceModifier.fillMaxSize().padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.Vertical.CenterVertically,
      ) {
        Text("🎉", style = TextStyle(fontSize = 22.sp))
        Spacer(GlanceModifier.height(4.dp))
        Text("全部读完了", style = TextStyle(color = onBg, fontSize = 14.sp, fontWeight = FontWeight.Medium))
        Spacer(GlanceModifier.height(2.dp))
        Text("打开 Aurora 刷新订阅源", style = TextStyle(color = secondary, fontSize = 11.sp))
      }
      return@Box
    }
    Column(modifier = GlanceModifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 10.dp)) {
      // Aurora hairline + header.
      Box(
        modifier = GlanceModifier.fillMaxWidth().height(2.dp)
          .background(ImageProvider(R.drawable.aurora_widget_hairline))
      ) {}
      Spacer(GlanceModifier.height(6.dp))
      Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
        Text("AURORA", style = TextStyle(color = secondary, fontSize = 10.sp, fontWeight = FontWeight.Bold))
        Spacer(GlanceModifier.defaultWeight())
        if (data.unreadCount > 0) {
          Box(
            modifier = GlanceModifier.background(teal).cornerRadius(999.dp)
              .padding(horizontal = 7.dp, vertical = 2.dp)
          ) {
            Text("${data.unreadCount}", style = TextStyle(color = white, fontSize = 11.sp, fontWeight = FontWeight.Bold))
          }
        }
      }
      Spacer(GlanceModifier.height(6.dp))
      data.articles.take(3).forEach { article ->
        ArticleRow(context, article, onBg, secondary, teal, orange)
        Spacer(GlanceModifier.height(6.dp))
      }
    }
  }
}

@Composable
private fun ArticleRow(
  context: Context,
  article: WidgetArticle,
  onBg: ColorProvider,
  secondary: ColorProvider,
  teal: ColorProvider,
  orange: ColorProvider,
) {
  Column(
    modifier = GlanceModifier.fillMaxWidth().clickable(
      onClick = actionStartActivity<MainActivity>(
        context,
        Uri.parse("aurora://article/${article.id}?homeWidget"),
      )
    )
  ) {
    Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
      if (article.unread) {
        Box(modifier = GlanceModifier.size(5.dp).background(orange).cornerRadius(999.dp)) {}
        Spacer(GlanceModifier.width(4.dp))
      }
      if (article.feed.isNotEmpty()) {
        Text(article.feed, style = TextStyle(color = teal, fontSize = 11.sp, fontWeight = FontWeight.Medium))
        Spacer(GlanceModifier.width(3.dp))
        Text("·", style = TextStyle(color = secondary, fontSize = 11.sp))
        Spacer(GlanceModifier.width(3.dp))
      }
      Text(relativeTime(article.publishedAtMs), style = TextStyle(color = secondary, fontSize = 11.sp))
      if (article.starred) {
        Spacer(GlanceModifier.width(3.dp))
        Text("★", style = TextStyle(color = orange, fontSize = 10.sp))
      }
    }
    Spacer(GlanceModifier.height(1.dp))
    Text(
      article.title,
      maxLines = 2,
      style = TextStyle(
        color = if (article.unread) onBg else secondary,
        fontSize = 14.sp,
        fontWeight = if (article.unread) FontWeight.Bold else FontWeight.Normal,
      ),
    )
  }
}

private class WidgetData(
  val unreadCount: Int,
  val articles: List<WidgetArticle>,
)

private fun parse(json: String): WidgetData? = try {
  val root = JSONObject(json)
  val articles = buildList {
    val arr = root.optJSONArray("articles") ?: return@buildList
    for (i in 0 until minOf(arr.length(), 6)) {
      val a = arr.getJSONObject(i)
      add(
        WidgetArticle(
          id = a.optString("id"),
          title = a.optString("title", ""),
          feed = a.optString("feed", ""),
          publishedAtMs = a.optLong("publishedAtMs", System.currentTimeMillis()),
          unread = a.optBoolean("unread", false),
          starred = a.optBoolean("starred", false),
        )
      )
    }
  }
  WidgetData(unreadCount = root.optInt("unreadCount", 0), articles = articles)
} catch (_: Exception) {
  null
}

private fun relativeTime(ms: Long): String {
  val diff = System.currentTimeMillis() - ms
  return when {
    diff < 60_000L -> "刚刚"
    diff < 3_600_000L -> "${diff / 60_000} 分钟前"
    diff < 86_400_000L -> "${diff / 3_600_000} 小时前"
    diff < 7 * 86_400_000L -> "${diff / 86_400_000} 天前"
    else -> "一周前"
  }
}
