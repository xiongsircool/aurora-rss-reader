import sys
import logging
from pathlib import Path
from alembic import command
from alembic.config import Config
from app.core.config import BACKEND_DIR, settings

def get_base_path() -> Path:
    """Get the base path for resources, handling PyInstaller's _MEIPASS."""
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS)
    return BACKEND_DIR

def run_migrations() -> None:
    """Run Alembic migrations to upgrade the database to the head revision."""
    logging.info(f"Running migrations for {settings.sqlite_path}...")
    
    base_path = get_base_path()
    ini_path = base_path / "alembic.ini"
    script_location = base_path / "migrations"
    
    # 指向 alembic.ini 的绝对路径
    alembic_cfg = Config(str(ini_path))
    # 设置脚本位置的绝对路径
    alembic_cfg.set_main_option("script_location", str(script_location))
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
