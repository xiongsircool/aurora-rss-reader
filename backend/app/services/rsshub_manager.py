"""
RSSHub配置管理服务
"""
import asyncio
from typing import List, Optional
from sqlmodel import Session, select
from app.db.session import SessionLocal
from app.models.rsshub_config import RSSHubConfig, RSSHubURLMapping
from app.services.rsshub_defaults import get_default_rsshub_mirrors


class RSSHubManager:
    """RSSHub配置管理器"""

    def __init__(self):
        self._mirrors_cache: List[RSSHubConfig] = []
        self._url_mappings_cache: List[RSSHubURLMapping] = []
        self._cache_timestamp: float = 0
        self._cache_ttl: float = 300  # 缓存5分钟

    async def get_available_mirrors(self) -> List[RSSHubConfig]:
        """获取可用的RSSHub镜像列表"""
        current_time = asyncio.get_event_loop().time()

        # 检查缓存
        if current_time - self._cache_timestamp < self._cache_ttl and self._mirrors_cache:
            return [m for m in self._mirrors_cache if m.enabled]

        # 从数据库加载
        with SessionLocal() as session:
            mirrors = session.exec(
                select(RSSHubConfig).where(RSSHubConfig.enabled == True)
                .order_by(RSSHubConfig.priority)
            ).all()

        self._mirrors_cache = mirrors
        self._cache_timestamp = current_time
        return mirrors

    async def get_default_mirror(self) -> Optional[RSSHubConfig]:
        """获取默认镜像"""
        mirrors = await self.get_available_mirrors()
        for mirror in mirrors:
            if mirror.is_default:
                return mirror
        return mirrors[0] if mirrors else None

    async def add_mirror(self, name: str, base_url: str, priority: int = None,
                        is_default: bool = False, description: str = None) -> RSSHubConfig:
        """添加新的RSSHub镜像"""
        with SessionLocal() as session:
            # 检查URL是否已存在
            existing = session.exec(
                select(RSSHubConfig).where(RSSHubConfig.base_url == base_url)
            ).first()

            if existing:
                existing.enabled = True
                existing.name = name
                if priority is not None:
                    existing.priority = priority
                if description:
                    existing.description = description
                session.add(existing)
                session.commit()
                session.refresh(existing)
                return existing

            # 如果设置为默认，清除其他默认设置
            if is_default:
                session.exec(
                    select(RSSHubConfig).where(RSSHubConfig.is_default == True)
                ).all()
                for item in session.exec(select(RSSHubConfig).where(RSSHubConfig.is_default == True)).all():
                    item.is_default = False
                    session.add(item)

            # 创建新镜像
            if priority is None:
                # 自动分配最低优先级
                max_priority = session.exec(select(RSSHubConfig)).order_by(RSSHubConfig.priority.desc()).first()
                priority = (max_priority.priority + 1) if max_priority else 1

            mirror = RSSHubConfig(
                name=name,
                base_url=base_url.rstrip('/'),
                priority=priority,
                is_default=is_default,
                description=description
            )
            session.add(mirror)
            session.commit()
            session.refresh(mirror)

        self._clear_cache()
        return mirror

    async def set_default_mirror(self, mirror_id: int) -> bool:
        """设置默认镜像"""
        with SessionLocal() as session:
            mirror = session.get(RSSHubConfig, mirror_id)
            if not mirror:
                return False

            # 清除所有默认设置
            all_mirrors = session.exec(select(RSSHubConfig)).all()
            for m in all_mirrors:
                m.is_default = False
                session.add(m)

            # 设置新的默认镜像
            mirror.is_default = True
            session.add(mirror)
            session.commit()

        self._clear_cache()
        return True

    async def disable_mirror(self, mirror_id: int) -> bool:
        """禁用镜像"""
        with SessionLocal() as session:
            mirror = session.get(RSSHubConfig, mirror_id)
            if not mirror:
                return False

            mirror.enabled = False
            session.add(mirror)
            session.commit()

        self._clear_cache()
        return True

    async def test_mirror_connectivity(self, base_url: str) -> dict:
        """测试镜像连通性"""
        import httpx
        from datetime import datetime

        # 使用一个简单的测试路径
        test_url = f"{base_url.rstrip('/')}/api/it之家/news"  # 使用一个简单的RSSHub路由进行测试

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(test_url)

                return {
                    "success": response.status_code == 200,
                    "status_code": response.status_code,
                    "response_time": response.elapsed.total_seconds() if hasattr(response, 'elapsed') else None,
                    "test_time": datetime.utcnow().isoformat(),
                    "message": f"状态码: {response.status_code}" if response.status_code != 200 else "连接成功"
                }
        except Exception as e:
            return {
                "success": False,
                "status_code": None,
                "response_time": None,
                "test_time": datetime.utcnow().isoformat(),
                "message": f"连接失败: {str(e)}"
            }

    async def get_url_mappings(self) -> List[RSSHubURLMapping]:
        """获取URL映射表"""
        current_time = asyncio.get_event_loop().time()

        # 检查缓存
        if current_time - self._cache_timestamp < self._cache_ttl and self._url_mappings_cache:
            return [m for m in self._url_mappings_cache if m.enabled]

        # 从数据库加载
        with SessionLocal() as session:
            mappings = session.exec(
                select(RSSHubURLMapping).where(RSSHubURLMapping.enabled == True)
            ).all()

        self._url_mappings_cache = mappings
        self._cache_timestamp = current_time
        return mappings

    async def add_url_mapping(self, original_url: str, alternative_url: str,
                            description: str = None) -> RSSHubURLMapping:
        """添加URL映射"""
        with SessionLocal() as session:
            mapping = RSSHubURLMapping(
                original_url=original_url,
                alternative_url=alternative_url,
                description=description
            )
            session.add(mapping)
            session.commit()
            session.refresh(mapping)

        self._clear_cache()
        return mapping

    def _clear_cache(self):
        """清除缓存"""
        self._mirrors_cache.clear()
        self._url_mappings_cache.clear()
        self._cache_timestamp = 0

    async def initialize_default_mirrors(self):
        """初始化默认镜像配置"""
        with SessionLocal() as session:
            existing_mirrors = session.exec(select(RSSHubConfig)).all()
            if len(existing_mirrors) == 0:
                for mirror_data in get_default_rsshub_mirrors():
                    mirror = RSSHubConfig(**mirror_data)
                    session.add(mirror)
                session.commit()
                print("已初始化默认RSSHub镜像配置")
            else:
                print("RSSHub镜像配置已存在")


# 全局实例
rsshub_manager = RSSHubManager()
