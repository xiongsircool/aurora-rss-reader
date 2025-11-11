from fastapi import APIRouter

from . import ai, entries, feeds, health, opml, settings

router = APIRouter()
router.include_router(health.router)
router.include_router(feeds.router)
router.include_router(entries.router)
router.include_router(ai.router)
router.include_router(opml.router)
router.include_router(settings.router)

__all__ = ["router"]
