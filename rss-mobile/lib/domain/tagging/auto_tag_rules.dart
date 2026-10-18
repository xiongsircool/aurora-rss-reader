/// Rule-based auto-tagging: a curated catalog of broad categories with
/// Chinese and English keywords. ASCII keywords are matched on word
/// boundaries (so "email" never triggers "ai"); CJK keywords use
/// substring matching. Titles count double versus summaries.
///
/// Entries carrying a DOI are literature (科研); a PMID additionally
/// implies biomedical literature (生物). At most three tags are assigned
/// per entry — an untagged article is better than a wrong one.
library;

/// A single auto-tag category: a canonical (Chinese) tag name plus
/// lowercase match keywords. ASCII keywords match on word boundaries.
final class AutoTagCategory {
  const AutoTagCategory(this.name, this.keywords);

  final String name;
  final List<String> keywords;
}

const autoTagCatalog = <AutoTagCategory>[
  AutoTagCategory('科技', [
    '芯片', '半导体', '制程', '光刻', '操作系统', '开源', '发布会', '内存', '固态硬盘',
    '卫星', '航天', '火箭', '探测器', '电动车', '自动驾驶', '激光', '核能',
    'chip', 'semiconductor', 'lithography', 'operating system', 'open source',
    'satellite', 'rocket', 'spacex', 'tesla', 'self-driving',
    'autonomous driving', 'solid-state', 'laser', 'wearable',
  ]),
  AutoTagCategory('AI', [
    '人工智能', '大模型', '机器学习', '深度学习', '神经网络', '智能体', '提示词',
    '生成式', '幻觉', '多模态',
    'ai', 'llm', 'gpt', 'chatgpt', 'claude', 'gemini', 'deepseek', 'openai',
    'anthropic', 'midjourney', 'stable diffusion', 'transformer',
    'fine-tune', 'fine-tuning', 'agentic', 'copilot', 'embedding',
    'inference', 'diffusion model',
  ]),
  AutoTagCategory('编程', [
    '编程', '代码', '开发者', '程序员', '框架', '编译', '调试', '重构', '算法',
    '数据结构', '版本', '软件工程',
    'api', 'sdk', 'bug', 'python', 'rust', 'golang', 'java', 'javascript',
    'typescript', 'swift', 'kotlin', 'flutter', 'react', 'vue', 'node',
    'git', 'linux', 'shell', 'docker', 'kubernetes', 'k8s', 'devops',
    'cli', 'compiler', 'debug', 'refactor', 'openapi',
  ]),
  AutoTagCategory('数码硬件', [
    '手机', '平板', '耳机', '相机', '镜头', '显卡', '键盘', '鼠标', '显示器',
    '充电', '拆解', '评测', '续航', '折叠屏',
    'iphone', 'ipad', 'android', 'airpods', 'macbook', 'galaxy', 'gpu',
    'rtx', 'ryzen', 'keyboard', 'mouse', 'camera', 'lens', 'teardown',
    'review', 'smartwatch', 'gadget',
  ]),
  AutoTagCategory('财经', [
    '股市', '美股', 'a股', '港股', '基金', '债券', '汇率', '美联储', '加息',
    '降息', '通胀', '宏观', '财报', '营收', '利润', '市值', '估值', '融资',
    '加息周期', '加密货币', '比特币', '以太坊',
    'stock', 'market', 'fed', 'inflation', 'earnings', 'revenue', 'profit',
    'valuation', 'funding', 'ipo', 'bitcoin', 'crypto', 'etf', 'portfolio',
    'dividend',
  ]),
  AutoTagCategory('国际', [
    '美国', '欧盟', '英国', '法国', '德国', '日本', '韩国', '印度', '俄罗斯',
    '乌克兰', '以色列', '中东', '外交', '制裁', '关税', '白宫', '议会',
    '联合国', '北约', '国际社会', '峰',
    'uk', 'japan', 'korea', 'russia', 'ukraine', 'israel', 'gaza', 'nato',
    'diplomat', 'sanction', 'tariff', 'white house', 'parliament', 'g7',
    'g20',
  ]),
  AutoTagCategory('时政', [
    '政策', '国务院', '两会', '部委', '选举', '官员', '法案', '监管', '治理',
    '反腐', '地方政府', '党', '内政', '执政',
    'policy', 'election', 'senator', 'congress', 'regulator', 'legislation',
    'government', 'administrative',
  ]),
  AutoTagCategory('生活', [
    '生活方式', '旅行', '美食', '咖啡', '家居', '收纳', '育儿', '亲子', '习惯',
    '效率', '极简', '断舍离', '感悟', '随笔', '手账', '通勤', '假期',
    'travel', 'food', 'recipe', 'coffee', 'home', 'declutter', 'parenting',
    'habit', 'productivity', 'journal', 'minimalism', 'weekend',
  ]),
  AutoTagCategory('设计', [
    '设计', '交互', '字体', '排版', '品牌', '标志', '插画', '工业设计',
    '用户体验', '视觉', '配色', '原型', '设计师', '设计语言',
    'design', 'ui', 'ux', 'typography', 'font', 'layout', 'branding',
    'logo', 'illustration', 'designer', 'color palette', 'prototype',
    'wireframe', 'graphic',
  ]),
  AutoTagCategory('娱乐', [
    '电影', '电视剧', '综艺', '音乐', '专辑', '演唱会', '追剧', '剧集', '动漫',
    '漫画', '小说', '游戏', '玩家', '动画',
    'netflix', 'movie', 'film', 'series', 'drama', 'music', 'album',
    'concert', 'anime', 'manga', 'game', 'gaming', 'steam', 'nintendo',
    'playstation', 'xbox', 'disney',
  ]),
  AutoTagCategory('体育', [
    '足球', '篮球', '世界杯', '奥运', '联赛', '冠军', '球队', '转会', '球员',
    '电竞', '世锦赛', '决赛', '赛季',
    'nba', 'fifa', 'olympic', 'champion', 'league', 'transfer', 'player',
    'match', 'tournament', 'esports', 'goal', 'coach',
  ]),
  AutoTagCategory('健康', [
    '健康', '医疗', '就医', '疾病', '症状', '疫苗', '药物', '体检', '睡眠',
    '营养', '饮食', '减肥', '心理健康', '焦虑', '抑郁', '养生',
    'health', 'medical', 'disease', 'symptom', 'vaccine', 'drug', 'hospital',
    'doctor', 'sleep', 'nutrition', 'diet', 'exercise', 'fitness', 'anxiety',
    'depression', 'cancer', 'therapy', 'mental health', 'clinic',
  ]),
  AutoTagCategory('科研', [
    '论文', '期刊', '预印本', '实验室', '课题组', '学者', '教授', '博士',
    '诺贝尔', '学术', '引用', '量子计算', '量子通信', '核聚变', '研究成果',
    'arxiv', 'nature', 'science', 'pnas', 'lancet', 'nejm', 'journal',
    'preprint', 'breakthrough', 'research', 'laboratory', 'experiment',
    'university', 'institute', 'nobel', 'phd', 'academia', 'citation',
    'peer review', 'quantum computing', 'fusion',
  ]),
  AutoTagCategory('生物', [
    '基因', '基因组', '蛋白质', '细胞', '干细胞', '进化', '微生物', '细菌',
    '病毒', '生态', '物种', '遗传', '免疫', '脑科学', '神经科学', '生物制药',
    '合成生物学', '酶',
    'gene', 'genome', 'dna', 'rna', 'crispr', 'protein', 'cell',
    'stem cell', 'evolution', 'microbiome', 'bacteria', 'virus', 'species',
    'ecology', 'biodiversity', 'neuroscience', 'brain', 'immology',
    'immunology', 'biotech', 'pharma', 'enzyme', 'mutation', 'protein folding',
  ]),
];

/// Forced, evidence-based tags: a DOI means literature; a PMID means
/// biomedical literature on top of that.
const _kResearchTagName = '科研';
const _kBiologyTagName = '生物';

/// Maximum tags assigned to one entry, forced (DOI/PMID) ones included.
const kMaxAutoTagsPerEntry = 3;

/// Matches [autoTagCatalog] against an entry's title and summary.
/// Title hits count double. Returns at most [kMaxAutoTagsPerEntry]
/// category names, best score first; may be empty.
List<String> matchAutoTags({
  required String title,
  String? summary,
  String? doi,
  String? pmid,
}) {
  final forced = <String>{};
  if (doi != null && doi.trim().isNotEmpty) forced.add(_kResearchTagName);
  if (pmid != null && pmid.trim().isNotEmpty) {
    forced
      ..add(_kResearchTagName)
      ..add(_kBiologyTagName);
  }

  final titleText = _plainText(title).toLowerCase();
  final summaryText = _plainText(summary ?? '').toLowerCase();
  if (titleText.isEmpty && summaryText.isEmpty) {
    return forced.take(kMaxAutoTagsPerEntry).toList();
  }

  final scores = <String, int>{};
  for (final compiled in _compiledCatalog) {
    var score = 0;
    if (titleText.isNotEmpty) {
      score += compiled.countMatches(titleText) * 2;
    }
    if (summaryText.isNotEmpty) {
      score += compiled.countMatches(summaryText);
    }
    if (score > 0) scores[compiled.name] = score;
  }

  final ranked = scores.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value));
  final result = <String>[...forced.take(kMaxAutoTagsPerEntry)];
  for (final entry in ranked) {
    if (result.length >= kMaxAutoTagsPerEntry) break;
    if (!result.contains(entry.key)) result.add(entry.key);
  }
  return result;
}

/// Strips HTML tags and collapses whitespace so keyword matching runs on
/// readable text, not markup.
String _plainText(String? html) {
  if (html == null || html.isEmpty) return '';
  return html
      .replaceAll(RegExp(r'<[^>]*>'), ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

final class _CompiledCategory {
  _CompiledCategory._(this.name, this.asciiPattern, this.cjkKeywords);

  factory _CompiledCategory.of(AutoTagCategory category) {
    final ascii = <String>[];
    final cjk = <String>[];
    for (final keyword in category.keywords) {
      // Mixed-script keywords (e.g. "a股") fall back to substring matching.
      if (RegExp(r'^[a-z0-9 .\-]+$').hasMatch(keyword)) {
        ascii.add(keyword);
      } else {
        cjk.add(keyword.toLowerCase());
      }
    }
    final pattern = ascii.isEmpty
        ? null
        : RegExp('\\b(${ascii.map(_escape).join('|')})\\b');
    return _CompiledCategory._(category.name, pattern, cjk);
  }

  final String name;
  final RegExp? asciiPattern;
  final List<String> cjkKeywords;

  int countMatches(String text) {
    var count = 0;
    final pattern = asciiPattern;
    if (pattern != null) count += pattern.allMatches(text).length;
    for (final keyword in cjkKeywords) {
      if (text.contains(keyword)) count += 1;
    }
    return count;
  }
}

String _escape(String keyword) => keyword.replaceAll('/', '\\/');

final List<_CompiledCategory> _compiledCatalog = [
  for (final category in autoTagCatalog) _CompiledCategory.of(category),
];
