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
BACKEND_NODE_DIR="$PROJECT_ROOT/backend-node"
FRONTEND_DIR="$PROJECT_ROOT/rss-desktop"
BACKEND_RESOURCES_DIR="$FRONTEND_DIR/resources/backend-node"
APP_VERSION="$(node -p "require('$FRONTEND_DIR/package.json').version")"

log "🚀 开始构建 Aurora RSS Reader..."
log "📂 项目目录: $PROJECT_ROOT"

# 检查依赖
check_dependencies() {
    log "🔍 检查构建依赖..."

    if ! command -v node &> /dev/null; then
        error "Node.js 未安装"
    fi

    if ! command -v pnpm &> /dev/null; then
        error "pnpm 未安装，请运行: npm install -g pnpm"
    fi

    log "✅ 依赖检查通过"
}

# 清理旧构建
clean_build() {
    log "🧹 清理旧构建文件..."

    rm -rf "$BACKEND_NODE_DIR/dist"
    rm -rf "$FRONTEND_DIR/dist"
    rm -rf "$FRONTEND_DIR/dist-electron"
    rm -rf "$FRONTEND_DIR/release"
    rm -rf "$BACKEND_RESOURCES_DIR"

    log "✅ 清理完成"
}

# 构建后端
build_backend() {
    log "🟩 构建 Node.js 后端服务..."

    cd "$BACKEND_NODE_DIR"

    # 安装后端依赖
    log "📦 安装后端依赖..."
    npm install

    # 构建后端
    log "🔨 编译后端..."
    npm run build

    if [ ! -f "dist/main.js" ]; then
        error "后端构建失败"
    fi

    # 准备打包资源
    log "📦 准备后端资源目录..."
    rm -rf "$BACKEND_RESOURCES_DIR"
    mkdir -p "$BACKEND_RESOURCES_DIR"
    cp -R "$BACKEND_NODE_DIR/dist" "$BACKEND_RESOURCES_DIR/"
    cp "$BACKEND_NODE_DIR/package.json" "$BACKEND_RESOURCES_DIR/"

    # 复制 .npmrc 配置文件（如果存在）
    if [ -f "$BACKEND_NODE_DIR/.npmrc" ]; then
        cp "$BACKEND_NODE_DIR/.npmrc" "$BACKEND_RESOURCES_DIR/"
    fi

    # 使用 Electron 的 Node.js 安装生产依赖
    log "📦 使用 Electron 的 Node.js 安装生产依赖..."
    cd "$FRONTEND_DIR"

    # 使用 electron 的 node 来安装依赖，确保原生模块与 Electron 版本匹配
    npx --yes electron-rebuild --version > /dev/null 2>&1 || pnpm add -D @electron/rebuild

    cd "$BACKEND_RESOURCES_DIR"

    # 设置环境变量，让 npm 使用 Electron 的 headers 和 C++20 标准
    export npm_config_target=$(cd "$FRONTEND_DIR" && node -p "require('./package.json').devDependencies.electron")
    export npm_config_arch=$(node -p "process.arch")
    export npm_config_target_arch=$(node -p "process.arch")
    export npm_config_disturl=https://electronjs.org/headers
    export npm_config_runtime=electron
    export npm_config_build_from_source=true
    export CXXFLAGS="-std=c++20"

    log "   Electron 版本: $npm_config_target"
    log "   架构: $npm_config_arch"

    npm install --omit=dev --production

    log "✅ 后端构建完成 ($(du -sh "$BACKEND_RESOURCES_DIR" | cut -f1))"
}

# 构建前端
build_frontend() {
    log "🎨 构建前端应用..."

    cd "$FRONTEND_DIR"

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        log "📦 安装前端依赖..."
        pnpm install
    fi

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
        find "$FRONTEND_DIR/release" -type f \( -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.deb" -o -name "*.zip" \) 2>/dev/null | while read file; do
            log "📱 生成: $(basename "$file") ($(du -h "$file" | cut -f1))"
        done
    fi

    # 提供安装提示
    if [ -d "$FRONTEND_DIR/release" ]; then
        echo ""
        log "💡 使用说明:"
        if [ "$(uname)" == "Darwin" ]; then
            log "   macOS: 双击 .dmg 文件安装应用"
            if [ -d "$FRONTEND_DIR/release/$APP_VERSION/mac" ]; then
                log "   或直接运行: $FRONTEND_DIR/release/$APP_VERSION/mac/Aurora RSS Reader.app"
            fi
            if [ -d "$FRONTEND_DIR/release/$APP_VERSION/mac-arm64" ]; then
                log "   Apple Silicon: $FRONTEND_DIR/release/$APP_VERSION/mac-arm64/Aurora RSS Reader.app"
            fi
        elif [ "$(uname)" == "Linux" ]; then
            log "   Linux: 运行 .AppImage 或安装 .deb 包"
        else
            log "   Windows: 运行 .exe 安装程序"
        fi
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

# 处理错误和中断
trap 'error "构建过程中断"' INT TERM

# 执行主函数
main "$@"
