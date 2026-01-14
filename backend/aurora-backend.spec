# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# 自动收集关键包的所有子模块
hiddenimports = []
hiddenimports += collect_submodules('fastapi')
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('pydantic_settings')
hiddenimports += collect_submodules('pydantic_core')
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('starlette')
hiddenimports += collect_submodules('apscheduler')
hiddenimports += collect_submodules('sqlmodel')
hiddenimports += collect_submodules('sqlalchemy')
hiddenimports += collect_submodules('alembic')
hiddenimports += collect_submodules('mako')
hiddenimports += collect_submodules('httpx')
hiddenimports += collect_submodules('anyio')
hiddenimports += collect_submodules('sniffio')
hiddenimports += collect_submodules('h11')
hiddenimports += collect_submodules('feedparser')
hiddenimports += collect_submodules('bs4')
hiddenimports += collect_submodules('lxml')
hiddenimports += collect_submodules('readability')
hiddenimports += collect_submodules('loguru')
hiddenimports += collect_submodules('xml')
hiddenimports += collect_submodules('email')
hiddenimports += collect_submodules('multipart')

# 收集数据文件
datas = [('app', 'app'), ('migrations', 'migrations'), ('alembic.ini', '.'), ('scripts', 'scripts')]
datas += collect_data_files('alembic')

a = Analysis(
    ['scripts\\serve.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='aurora-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
