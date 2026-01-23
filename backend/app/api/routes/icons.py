from __future__ import annotations

import base64
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.utils.network import fetch_with_redirects


router = APIRouter(prefix="/icons", tags=["icons"])

# 1x1 transparent GIF
_TRANSPARENT_GIF = base64.b64decode(
    b"R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="
)


def _build_headers(target_url: str) -> dict[str, str]:
    parsed = urlparse(target_url)
    origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/119.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
        "Referer": origin or target_url,
    }


@router.get("/proxy")
async def proxy_icon(url: str = Query(..., description="Remote icon URL to proxy")) -> Response:
    """Proxy a remote icon and always return a successful image response.

    If the remote fetch fails or isn't an image, return a 1x1 transparent GIF
    with 200 to avoid noisy console errors in the frontend.
    """
    if not url:
        return Response(
            content=_TRANSPARENT_GIF,
            media_type="image/gif",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await fetch_with_redirects(client, url, headers=_build_headers(url))
            ctype = r.headers.get("content-type", "").lower()
            if r.status_code == 200 and ctype.startswith("image/") and r.content:
                return Response(
                    content=r.content,
                    media_type=ctype.split(";")[0] or "image/octet-stream",
                    headers={"Cache-Control": "public, max-age=86400"},
                )
    except Exception:
        # Swallow all errors and fall back to placeholder
        pass

    return Response(
        content=_TRANSPARENT_GIF,
        media_type="image/gif",
        headers={"Cache-Control": "public, max-age=86400"},
    )
