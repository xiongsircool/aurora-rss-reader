"""Default RSSHub mirror configuration helpers."""
from __future__ import annotations

from copy import deepcopy
from typing import Dict, List


_DEFAULT_RSSHUB_MIRRORS: List[Dict[str, object]] = [
    {
        "name": "主镜像 (官方)",
        "base_url": "https://rsshub.app",
        "priority": 1,
        "is_default": True,
        "description": "RSSHub官方镜像",
    },
    {
        "name": "备用镜像1",
        "base_url": "https://rsshub.rssforever.com",
        "priority": 2,
        "description": "RSSHub备用镜像1",
    },
    {
        "name": "备用镜像2",
        "base_url": "https://rsshub.ktachibana.party",
        "priority": 3,
        "description": "RSSHub备用镜像2",
    },
    {
        "name": "备用镜像3",
        "base_url": "https://rsshub.cskaoyan.com",
        "priority": 4,
        "description": "RSSHub备用镜像3",
    },
]


def get_default_rsshub_mirrors() -> List[Dict[str, object]]:
    """Return a deep copy of the structured default mirror definitions."""
    return deepcopy(_DEFAULT_RSSHUB_MIRRORS)


def get_default_rsshub_base_urls() -> List[str]:
    """Return the base URLs from the default mirror definitions."""
    return [mirror["base_url"] for mirror in _DEFAULT_RSSHUB_MIRRORS]


# Backwards-compatible exports for modules that still expect constants
DEFAULT_RSSHUB_MIRRORS = get_default_rsshub_mirrors()
DEFAULT_RSSHUB_BASE_URLS = get_default_rsshub_base_urls()
