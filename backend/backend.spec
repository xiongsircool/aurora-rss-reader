# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller配置文件 - 用于打包RSS Reader后端
"""

import sys
import os
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(os.getcwd())

# 主程序入口
main_script = 'scripts/serve.py'

# 隐藏导入 - 确保所有依赖都被包含
hidden_imports = [
    # FastAPI and web framework
    'fastapi',
    'fastapi.middleware',
    'fastapi.middleware.cors',
    'fastapi.responses',
    'fastapi.templating',
    'uvicorn',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.websockets',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'starlette',
    'starlette.middleware',
    'starlette.middleware.cors',
    'starlette.responses',

    # Database and ORM
    'sqlmodel',
    'sqlalchemy',
    'sqlalchemy.dialects',
    'sqlalchemy.dialects.sqlite',
    'alembic',
    'alembic.runtime',
    'alembic.runtime.migration',

    # Configuration and validation
    'pydantic',
    'pydantic_settings',
    'python_dotenv',
    'dotenv',

    # HTTP and network
    'httpx',

    # XML processing (Python standard library)
    'xml',
    'xml.etree',
    'xml.etree.ElementTree',
    'xml.dom',
    'xml.dom.minidom',

    # RSS and content parsing
    'feedparser',
    'beautifulsoup4',
    'bs4',
    'readability',
    'lxml',
    'lxml.html',
    'lxml.html.clean',

    # Scheduling
    'apscheduler',
    'apscheduler.schedulers.asyncio',

    # Logging
    'loguru',

    # Compatibility
    'eval_type_backport',
]

# 数据文件 - 包含应用数据文件
datas = [
    ('app', 'app'),  # 包含整个app目录
    ('scripts', 'scripts'),  # 包含scripts目录
]

# 二进制文件排除
excludes = [
    'tkinter',
    'matplotlib',
    'numpy',
    'scipy',
    'pandas',
    'PIL',
    'jupyter',
    'IPython',
]

a = Analysis(
    [main_script],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

# 移除不需要的二进制文件
for exclude in excludes:
    a.binaries = [x for x in a.binaries if not x[0].startswith(exclude)]

# 创建PYZ文件
pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# 创建可执行文件
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='aurora-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=True,
    console=True,  # 改为True，方便调试和查看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # 可以添加图标路径
)

# 收集文件
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=True,
    upx=True,
    upx_exclude=[],
    name='aurora-backend',
)
