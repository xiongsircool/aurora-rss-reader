from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Health check")
def read_health() -> dict[str, str]:
    return {"status": "ok"}
