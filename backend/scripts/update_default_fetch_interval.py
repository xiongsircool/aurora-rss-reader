#!/usr/bin/env python3
"""
更新默认RSS刷新间隔为12小时的迁移脚本
"""

from sqlmodel import Session, select
from app.db.session import SessionLocal
from app.models.user_settings import UserSettings
from loguru import logger


def update_default_fetch_interval():
    """更新所有用户的默认刷新间隔为12小时（720分钟）"""

    try:
        with SessionLocal() as session:
            # 查找所有用户设置
            all_settings = session.exec(select(UserSettings)).all()

            updated_count = 0
            for settings in all_settings:
                # 如果当前间隔小于4小时（240分钟），则更新为12小时
                if settings.fetch_interval_minutes < 240:
                    old_interval = settings.fetch_interval_minutes
                    settings.fetch_interval_minutes = 720
                    session.add(settings)
                    updated_count += 1
                    logger.info(f"用户ID {settings.id}: {old_interval}分钟 -> 720分钟")

            # 提交更改
            session.commit()

            logger.info(f"✅ 迁移完成！更新了 {updated_count} 个用户的刷新间隔为12小时")

    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}")
        raise


if __name__ == "__main__":
    update_default_fetch_interval()