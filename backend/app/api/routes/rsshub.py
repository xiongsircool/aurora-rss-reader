"""
RSSHub配置管理API
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.deps import get_session
from app.models.rsshub_config import RSSHubConfig, RSSHubURLMapping
from app.services.rsshub_manager import rsshub_manager
from pydantic import BaseModel

router = APIRouter(prefix="/rsshub", tags=["RSSHub配置"])


class RSSHubConfigCreate(BaseModel):
    """创建RSSHub配置的请求模型"""
    name: str
    base_url: str
    priority: Optional[int] = None
    is_default: bool = False
    description: Optional[str] = None


class RSSHubConfigUpdate(BaseModel):
    """更新RSSHub配置的请求模型"""
    name: Optional[str] = None
    base_url: Optional[str] = None
    priority: Optional[int] = None
    is_default: Optional[bool] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None


class URLMappingCreate(BaseModel):
    """创建URL映射的请求模型"""
    original_url: str
    alternative_url: str
    description: Optional[str] = None


class MirrorTestResult(BaseModel):
    """镜像测试结果模型"""
    success: bool
    status_code: Optional[int] = None
    response_time: Optional[float] = None
    test_time: str
    message: str


@router.get("/mirrors", response_model=List[RSSHubConfig])
async def list_mirrors():
    """获取所有RSSHub镜像列表"""
    mirrors = await rsshub_manager.get_available_mirrors()
    return mirrors


@router.post("/mirrors", response_model=RSSHubConfig)
async def add_mirror(mirror_data: RSSHubConfigCreate):
    """添加新的RSSHub镜像"""
    try:
        mirror = await rsshub_manager.add_mirror(
            name=mirror_data.name,
            base_url=mirror_data.base_url,
            priority=mirror_data.priority,
            is_default=mirror_data.is_default,
            description=mirror_data.description
        )
        return mirror
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mirrors/{mirror_id}/set-default")
async def set_default_mirror(mirror_id: int):
    """设置默认镜像"""
    success = await rsshub_manager.set_default_mirror(mirror_id)
    if not success:
        raise HTTPException(status_code=404, detail="镜像不存在")
    return {"message": "已设置为默认镜像"}


@router.post("/mirrors/{mirror_id}/disable")
async def disable_mirror(mirror_id: int):
    """禁用镜像"""
    success = await rsshub_manager.disable_mirror(mirror_id)
    if not success:
        raise HTTPException(status_code=404, detail="镜像不存在")
    return {"message": "已禁用镜像"}


@router.post("/mirrors/test")
async def test_mirror(base_url: str):
    """测试镜像连通性"""
    result = await rsshub_manager.test_mirror_connectivity(base_url)
    return MirrorTestResult(**result)


@router.get("/url-mappings", response_model=List[RSSHubURLMapping])
async def list_url_mappings():
    """获取URL映射表"""
    mappings = await rsshub_manager.get_url_mappings()
    return mappings


@router.post("/url-mappings", response_model=RSSHubURLMapping)
async def add_url_mapping(mapping_data: URLMappingCreate):
    """添加URL映射"""
    try:
        mapping = await rsshub_manager.add_url_mapping(
            original_url=mapping_data.original_url,
            alternative_url=mapping_data.alternative_url,
            description=mapping_data.description
        )
        return mapping
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/initialize")
async def initialize_rsshub_config():
    """初始化RSSHub配置"""
    await rsshub_manager.initialize_default_mirrors()
    return {"message": "RSSHub配置已初始化"}