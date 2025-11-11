from __future__ import annotations

import html
import re
from typing import Optional

from bs4 import BeautifulSoup

_WHITESPACE_RE = re.compile(r"\s+")


def clean_html_text(value: Optional[str]) -> Optional[str]:
    """
    Convert a HTML snippet into a compact plain-text string.

    - Strips tags while keeping anchor text.
    - Decodes common HTML entities.
    - Collapses whitespace, newlines, and repeated spaces.
    """
    if not value:
        return None

    # BeautifulSoup gracefully handles most malformed markup from feeds.
    soup = BeautifulSoup(value, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    if not text:
        return None

    unescaped = html.unescape(text)
    normalized = _WHITESPACE_RE.sub(" ", unescaped).strip()
    return normalized or None
