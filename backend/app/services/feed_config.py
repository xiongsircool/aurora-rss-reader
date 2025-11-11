"""
RSS源的特殊配置和处理规则
"""

# RSSHub备用镜像配置 (作为备用，主要使用动态配置)
DEFAULT_RSSHUB_MIRRORS = [
    'https://rsshub.app',
    'https://rsshub.rssforever.com',
    'https://rsshub.ktachibana.party',
    'https://rsshub.cskaoyan.com'
]

# 动态获取RSSHub镜像的函数
async def get_rsshub_mirrors():
    """动态获取RSSHub镜像列表"""
    try:
        from app.services.rsshub_manager import rsshub_manager
        mirrors = await rsshub_manager.get_available_mirrors()
        return [mirror.base_url for mirror in mirrors]
    except Exception:
        # 如果动态获取失败，使用默认配置
        return DEFAULT_RSSHUB_MIRRORS

# 需要特殊User-Agent的域名
SPECIAL_USER_AGENTS = {
    'academic.oup.com': 'Mozilla/5.0 (compatible; RSS Reader/1.0; Academic)',
    'nature.com': 'Mozilla/5.0 (compatible; RSS Reader/1.0; Nature)',
    'science.org': 'Mozilla/5.0 (compatible; RSS Reader/1.0; Science)',
}

# 已知的问题RSS源和替代方案
KNOWN_ALTERNATIVES = {
    # 原URL -> 替代URL列表 (按优先级排序)
    'https://rsshub.app/nature/research/ng': [
        'https://www.nature.com/ng/current.rss',  # 首选 - 实测有效
        'https://feeds.nature.com/ng/current',    # 备选 - 406错误
    ],
    'https://rsshub.app/nature/research/nmeth': [
        'https://www.nature.com/nmeth/current.rss',  # 首选
        'https://feeds.nature.com/nmeth/current',    # 备选
    ],
    # 其他可能有问题的RSSHub链接
    'https://rsshub.app/nature/research/nat': [
        'https://www.nature.com/nature/current.rss',
    ],
    'https://rsshub.app/nature/research/ncomms': [
        'https://www.nature.com/ncomms/rss/current',
    ],
}

# 超时配置（秒）
TIMEOUT_CONFIG = {
    'connect': 10.0,
    'read': 30.0,
    'write': 10.0,
    'pool': 60.0
}

# 重试配置
RETRY_CONFIG = {
    'max_retries': 3,
    'retry_delay': 1.0,  # 秒
    'retry_on_status': [408, 429, 500, 502, 503, 504]
}