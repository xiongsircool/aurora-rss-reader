#!/bin/bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/rust-backend"
FRONTEND_DIR="$PROJECT_ROOT/rss-desktop"

# 显示构建信息
show_build_info() {
    log "🦀 Aurora RSS Reader - Rust 版本构建"
    echo ""
    info "📂 项目目录: $PROJECT_ROOT"
    info "🎯 目标: 本地测试构建"
    info "🔧 后端: Rust + Axum"
    info "🖥️  前端: Vue 3 + Electron"
    info "📱 数据库: SQLite (生产模式)"
    echo ""
}

# 检查依赖
check_dependencies() {
    log "🔍 检查构建环境..."

    local missing_deps=()

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    else
        info "✅ Node.js: $(node --version)"
    fi

    # 检查 Rust
    if ! command -v rustc &> /dev/null; then
        missing_deps+=("Rust")
    else
        info "✅ Rust: $(rustc --version)"
    fi

    # 检查 Cargo
    if ! command -v cargo &> /dev/null; then
        missing_deps+=("Cargo")
    else
        info "✅ Cargo: $(cargo --version)"
    fi

    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        missing_deps+=("pnpm")
    else
        info "✅ pnpm: $(pnpm --version)"
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "缺少依赖: ${missing_deps[*]}"
    fi

    log "✅ 依赖检查通过"
}

# 清理旧构建
clean_build() {
    log "🧹 清理旧构建文件..."

    # 清理前端构建产物
    rm -rf "$FRONTEND_DIR/dist"
    rm -rf "$FRONTEND_DIR/dist-electron"
    rm -rf "$FRONTEND_DIR/release"

    # 清理 Rust 后端构建产物（保留 release 二进制文件以节省时间）
    if [ -f "$BACKEND_DIR/target/release/rss-backend" ]; then
        warn "保留现有 Rust 二进制文件以节省构建时间"
        warn "如需完全重新构建，请删除 $BACKEND_DIR/target/release/"
    fi

    log "✅ 清理完成"
}

# 构建后端
build_backend() {
    log "🦀 构建 Rust 后端服务..."

    cd "$BACKEND_DIR"

    # 检查是否已存在二进制文件
    if [ -f "target/release/rss-backend" ]; then
        warn "发现现有的 Rust 后端二进制文件"
        read -p "是否重新构建？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log "📦 重新编译 Rust 后端（生产模式）..."
            RUST_ENV=production cargo build --release
        else
            log "⚡ 使用现有二进制文件"
        fi
    else
        log "📦 编译 Rust 后端（生产模式）..."
        RUST_ENV=production cargo build --release
    fi

    if [ ! -f "target/release/rss-backend" ]; then
        error "Rust 后端构建失败"
    fi

    local backend_size=$(du -sh target/release/rss-backend | cut -f1)
    log "✅ Rust 后端构建完成 (大小: $backend_size)"
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
    log "🔨 构建前端静态文件..."
    pnpm build

    if [ ! -d "dist" ]; then
        error "前端构建失败"
    fi

    # 检查构建产物
    local file_count=$(find dist -type f | wc -l)
    info "✅ 前端构建完成 (文件数: $file_count)"
}

# 复制后端二进制文件到前端资源目录
copy_backend_to_frontend() {
    log "📦 复制后端二进制文件到前端资源目录..."

    mkdir -p "$FRONTEND_DIR/resources"

    # 确定二进制文件名
    local binary_name="rss-backend"
    if [ "$(uname)" = "Windows" ]; then
        binary_name="rss-backend.exe"
    fi

    local src_path="$BACKEND_DIR/target/release/$binary_name"
    local dst_path="$FRONTEND_DIR/resources/$binary_name"

    if [ ! -f "$src_path" ]; then
        error "后端二进制文件未找到: $src_path"
    fi

    cp "$src_path" "$dst_path"
    chmod +x "$dst_path" 2>/dev/null || true

    info "✅ 后端二进制文件已复制: $dst_path"
}

# 创建后端启动脚本（用于 Electron 应用）
create_backend_launcher() {
    log "⚙️  创建后端启动脚本..."

    mkdir -p "$FRONTEND_DIR/resources"

    if [ "$(uname)" = "Windows" ]; then
        # Windows 启动脚本
        cat > "$FRONTEND_DIR/resources/start-backend.bat" << 'EOF'
@echo off
cd /d "%~dp0"

REM 设置生产模式环境变量
set RUST_ENV=production

REM 启动后端服务
start /B rss-backend.exe
EOF
    else
        # Unix 启动脚本
        cat > "$FRONTEND_DIR/resources/start-backend.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

# 设置生产模式环境变量
export RUST_ENV=production

# 启动后端服务
./rss-backend
EOF
        chmod +x "$FRONTEND_DIR/resources/start-backend.sh"
    fi

    log "✅ 后端启动脚本已创建"
}

# 打包应用
package_app() {
    log "📦 打包 Electron 应用..."

    cd "$FRONTEND_DIR"

    # 检查 electron-builder 配置
    if ! grep -q '"build"' package.json; then
        warn "未找到 electron-builder 配置，使用默认配置"
    fi

    # 使用 electron-builder 打包
    pnpm exec electron-builder --publish=never

    log "✅ 应用打包完成"
}

# 运行基本测试
run_basic_tests() {
    log "🧪 运行基本测试..."

    # 测试后端二进制文件
    local binary_path="$FRONTEND_DIR/resources/rss-backend"
    if [ "$(uname)" = "Windows" ]; then
        binary_path="$FRONTEND_DIR/resources/rss-backend.exe"
    fi

    if [ -f "$binary_path" ]; then
        log "✅ 后端二进制文件存在: $binary_path"

        # 尝试显示版本信息（如果支持）
        timeout 2s "$binary_path" --version 2>/dev/null || log "✅ 后端二进制文件可执行"
    else
        error "后端二进制文件未找到"
    fi

    # 测试前端构建
    if [ -d "$FRONTEND_DIR/dist" ]; then
        local file_count=$(find "$FRONTEND_DIR/dist" -type f | wc -l)
        log "✅ 前端构建文件: $file_count 个文件"
    fi
}

# 显示构建结果
show_results() {
    log "🎉 本地构建完成！"
    echo ""

    # 显示后端信息
    local binary_path="$FRONTEND_DIR/resources/rss-backend"
    if [ "$(uname)" = "Windows" ]; then
        binary_path="$FRONTEND_DIR/resources/rss-backend.exe"
    fi

    if [ -f "$binary_path" ]; then
        local backend_size=$(du -h "$binary_path" | cut -f1)
        log "🦀 Rust 后端: $binary_path (大小: $backend_size)"
    fi

    # 显示前端信息
    if [ -d "$FRONTEND_DIR/dist" ]; then
        local front_size=$(du -sh "$FRONTEND_DIR/dist" | cut -f1)
        log "🎨 前端构建: $FRONTEND_DIR/dist (大小: $front_size)"
    fi

    # 显示打包结果
    if [ -d "$FRONTEND_DIR/release" ]; then
        echo ""
        log "📱 Electron 应用包:"
        find "$FRONTEND_DIR/release" -type f \( -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.deb" \) 2>/dev/null | while read file; do
            local size=$(du -h "$file" | cut -f1)
            log "   📦 $(basename "$file") (大小: $size)"
        done

        echo ""
        log "💡 测试说明:"
        if [ "$(uname)" == "Darwin" ]; then
            log "   1. 双击 .dmg 文件安装应用"
            log "   2. 启动后检查应用功能"
            log "   3. 数据库位置: ~/Library/Application Support/aurora-rss-reader/data/rss.db"
        elif [ "$(uname)" == "Linux" ]; then
            log "   1. 运行 .AppImage 文件或安装 .deb 包"
            log "   2. 启动后检查应用功能"
            log "   3. 数据库位置: ~/.local/share/aurora-rss-reader/data/rss.db"
        else
            log "   1. 运行 .exe 安装程序"
            log "   2. 启动后检查应用功能"
            log "   3. 数据库位置: %APPDATA%\\aurora-rss-reader\\data\\rss.db"
        fi

        echo ""
        log "🔍 测试要点:"
        log "   • 应用启动是否正常"
        log "   • 后端 API 是否响应 (端口 27495)"
        log "   • 数据库是否正确初始化"
        log "   • 前端界面是否正常显示"
        log "   • RSS 源添加功能是否工作"
    fi
}

# 主构建流程
main() {
    show_build_info
    check_dependencies
    clean_build
    build_backend
    build_frontend
    copy_backend_to_frontend
    create_backend_launcher
    package_app
    run_basic_tests
    show_results
}

# 处理错误和中断
trap 'error "构建过程中断"' INT TERM

# 执行主函数
main "$@"