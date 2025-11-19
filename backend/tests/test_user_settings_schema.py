import sqlite3

from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, create_engine

from app.services import user_settings_service as service_module
from app.services.user_settings_service import UserSettingsService


def test_get_settings_backfills_missing_columns(tmp_path):
    """Legacy databases missing new columns should be patched on demand."""
    legacy_db = tmp_path / "legacy.sqlite"

    with sqlite3.connect(legacy_db) as conn:
        conn.execute(
            """
            CREATE TABLE user_settings (
                id INTEGER PRIMARY KEY,
                rsshub_url TEXT DEFAULT 'https://rsshub.app',
                fetch_interval_minutes INTEGER DEFAULT 720,
                auto_refresh BOOLEAN DEFAULT 1,
                show_description BOOLEAN DEFAULT 1,
                items_per_page INTEGER DEFAULT 50,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            )
            """
        )
        conn.commit()

    test_engine = create_engine(
        f"sqlite:///{legacy_db}",
        connect_args={"check_same_thread": False},
    )
    test_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
        class_=Session,
    )

    original_engine = service_module.engine
    original_session_local = service_module.SessionLocal
    original_schema_checked = service_module._schema_checked

    try:
        service_module.engine = test_engine
        service_module.SessionLocal = test_session_local
        service_module._schema_checked = False

        settings = UserSettingsService.get_settings()

        assert settings.show_entry_summary is True
        assert settings.enable_date_filter is True
        assert settings.default_date_range == "30d"
        assert settings.time_field == "inserted_at"
        # 新增字段应当在旧库上自动回填
        assert isinstance(settings.max_auto_title_translations, int)
        assert settings.max_auto_title_translations >= 0
    finally:
        service_module.engine = original_engine
        service_module.SessionLocal = original_session_local
        service_module._schema_checked = original_schema_checked
