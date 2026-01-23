import asyncio
import importlib
import sys
from pathlib import Path

from sqlmodel import select


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def test_priority_auto_increment(monkeypatch, tmp_path):
    monkeypatch.setenv("AURORA_DATA_DIR", str(tmp_path))

    from app.core import config as config_module
    importlib.reload(config_module)

    from app.models import rsshub_config as rsshub_config_module

    from app.db import session as session_module
    importlib.reload(session_module)
    asyncio.run(session_module.init_db())

    from app.services import rsshub_manager as manager_module
    importlib.reload(manager_module)

    manager = manager_module.RSSHubManager()

    asyncio.run(
        manager.add_mirror(name="Mirror A", base_url="https://a.example.com", priority=None)
    )
    asyncio.run(
        manager.add_mirror(name="Mirror B", base_url="https://b.example.com", priority=None)
    )

    async def fetch_mirrors():
        async with session_module.async_session_maker() as session:
            result = await session.exec(
                select(rsshub_config_module.RSSHubConfig).order_by(
                    rsshub_config_module.RSSHubConfig.priority
                )
            )
            return result.all()

    mirrors = asyncio.run(fetch_mirrors())

    assert [mirror.priority for mirror in mirrors] == [1, 2]
    assert [mirror.base_url for mirror in mirrors] == [
        "https://a.example.com",
        "https://b.example.com",
    ]
