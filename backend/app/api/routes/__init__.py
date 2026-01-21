from fastapi import APIRouter

from . import ai, ai_batch, entries, feeds, health, opml, rsshub, user_settings, icons

router = APIRouter()
router.include_router(health.router)
router.include_router(feeds.router)
router.include_router(entries.router)
router.include_router(ai.router)
router.include_router(ai_batch.router)
router.include_router(opml.router)
router.include_router(rsshub.router)
router.include_router(user_settings.router)
router.include_router(icons.router)

__all__ = ["router"]
