#!/bin/bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "${GREEN}[BUILD]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/rss-desktop"

log "🚀 开始构建 Aurora RSS Reader..."

# 检查依赖
check_dependencies() {
    log "🔍 检查构建依赖..."

    if ! command -v node &> /dev/null; then
        error "Node.js 未安装"
    fi

    if ! command -v python3 &> /dev/null; then
        error "Python 3 未安装"
    fi

    if ! command -v pnpm &> /dev/null; then
        error "pnpm 未安装，请运行: npm install -g pnpm"
    fi

    log "✅ 依赖检查通过"
}

# 清理旧构建
clean_build() {
    log "🧹 清理旧构建文件..."

    rm -rf "$BACKEND_DIR/dist"
    rm -rf "$BACKEND_DIR/build"
    rm -rf "$FRONTEND_DIR/dist"
    rm -rf "$FRONTEND_DIR/dist-electron"
    rm -rf "$FRONTEND_DIR/release"

    log "✅ 清理完成"
}

# 构建后端
build_backend() {
    log "🐍 构建后端服务..."

    cd "$BACKEND_DIR"

    # 检查虚拟环境
    if [ ! -d ".venv" ]; then
        error "未找到虚拟环境 .venv，请先运行: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    fi

    # 激活虚拟环境
    source .venv/bin/activate

    # 安装 PyInstaller
    log "📦 安装 PyInstaller..."
    pip install pyinstaller

    # 使用 PyInstaller 打包后端
    log "📦 使用 PyInstaller 打包后端..."
    pyinstaller backend.spec

    if [ ! -f "dist/aurora-backend/aurora-backend" ]; then
        error "后端构建失败"
    fi

    log "✅ 后端构建完成 ($(du -sh dist/aurora-backend | cut -f1))"
}

# 构建前端
build_frontend() {
    log "🎨 构建前端应用..."

    cd "$FRONTEND_DIR"

    # 安装依赖
    log "📦 安装前端依赖..."
    pnpm install

    # 构建前端
    log "🔨 构建前端..."
    pnpm build

    if [ ! -d "dist" ] || [ ! -d "dist-electron" ]; then
        error "前端构建失败"
    fi

    log "✅ 前端构建完成"
}

# 打包应用
package_app() {
    log "📦 打包 Electron 应用..."

    cd "$FRONTEND_DIR"

    # 使用 electron-builder 打包
    pnpm exec electron-builder --publish=never

    log "✅ 应用打包完成"
}

# 显示构建结果
show_results() {
    log "🎉 构建完成！"
    log "📂 输出目录: $FRONTEND_DIR/release"

    # 显示生成的文件
    if [ -d "$FRONTEND_DIR/release" ]; then
        find "$FRONTEND_DIR/release" -type f \( -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.deb" \) 2>/dev/null | while read file; do
            log "📱 生成: $(basename "$file") ($(du -h "$file" | cut -f1))"
        done
    fi
}

# 主构建流程
main() {
    check_dependencies
    clean_build
    build_backend
    build_frontend
    package_app
    show_results
}

# 执行主函数
main "$@"

