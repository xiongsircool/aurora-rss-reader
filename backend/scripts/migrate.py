from __future__ import annotations

import logging
from alembic import command
from alembic.config import Config
from app.core.config import BACKEND_DIR, settings

def run_migrations() -> None:
    """Run Alembic migrations to upgrade the database to the head revision."""
    logging.info(f"Running migrations for {settings.sqlite_path}...")
    
    # 指向 alembic.ini 的绝对路径
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    # 设置脚本位置的绝对路径
    alembic_cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    # 动态设置数据库 URL
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{settings.sqlite_path}")

    try:
        command.upgrade(alembic_cfg, "head")
        logging.info("Migrations completed successfully.")
    except Exception as e:
        logging.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()
