#!/bin/bash

# RSS 项目启动脚本
# 同时启动前端和 Rust 后端

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 打印带颜色的消息
print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}     RSS Reader 启动脚本${NC}"
    echo -e "${CYAN}========================================${NC}"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status() {
    echo -e "${PURPLE}[STATUS]${NC} $1"
}

# 进程管理
PIDS=()

cleanup() {
    print_info "正在停止所有服务..."

    # 停止所有子进程
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            print_info "停止进程 $pid"
            kill "$pid" 2>/dev/null || true
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
    done

    print_success "所有服务已停止"
    exit 0
}

# 捕获 Ctrl+C
trap cleanup INT TERM

# 检查 Rust 环境
check_rust() {
    print_info "检查 Rust 环境..."

    # 尝试加载 Rust 环境
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env" 2>/dev/null || true
        print_info "已加载 Rust 环境变量"
    fi

    if ! command -v rustc &> /dev/null; then
        print_error "Rust 未安装！"
        print_info "请先安装 Rust:"
        echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        return 1
    fi

    RUST_VERSION=$(rustc --version 2>/dev/null | cut -d' ' -f2)
    print_success "Rust 已安装: $RUST_VERSION"

    if ! command -v cargo &> /dev/null; then
        print_error "Cargo 未找到！"
        return 1
    fi

    CARGO_VERSION=$(cargo --version 2>/dev/null | cut -d' ' -f2)
    print_success "Cargo 已安装: $CARGO_VERSION"
}

# 检查 Node.js 环境
check_node() {
    print_info "检查 Node.js 环境..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装！"
        print_info "请先安装 Node.js: https://nodejs.org/"
        return 1
    fi

    NODE_VERSION=$(node --version 2>/dev/null)
    print_success "Node.js 已安装: $NODE_VERSION"

    if ! command -v npm &> /dev/null; then
        print_error "npm 未找到！"
        return 1
    fi

    NPM_VERSION=$(npm --version 2>/dev/null)
    print_success "npm 已安装: $NPM_VERSION"
}

# 检查前端
check_frontend() {
    print_info "检查前端项目..."

    if [ ! -d "rss-desktop" ]; then
        print_error "前端目录 'rss-desktop' 不存在！"
        return 1
    fi

    if [ ! -f "rss-desktop/package.json" ]; then
        print_error "前端 package.json 不存在！"
        return 1
    fi

    print_success "前端项目检查通过"
}

# 检查后端
check_backend() {
    print_info "检查后端项目..."

    if [ ! -d "rust-backend" ]; then
        print_error "后端目录 'rust-backend' 不存在！"
        return 1
    fi

    if [ ! -f "rust-backend/Cargo.toml" ]; then
        print_error "后端 Cargo.toml 不存在！"
        return 1
    fi

    print_success "后端项目检查通过"
}

# 构建前端（生产模式）
build_frontend() {
    print_info "构建前端应用（生产模式）..."

    cd rss-desktop

    if [ ! -d "node_modules" ]; then
        print_info "安装前端依赖..."
        npm install
    fi

    print_info "构建前端生产版本..."
    npm run build

    cd ..
    print_success "前端生产构建完成"
}

# 构建后端
build_backend() {
    print_info "构建后端应用..."

    cd rust-backend

    # 检查环境配置
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_info "已创建后端 .env 配置文件"
        else
            print_warning "后端配置文件不存在，使用默认配置"
        fi
    fi

    # 确保数据目录存在（开发模式）
    mkdir -p data

    # 检查二进制文件
    if [ ! -f "target/release/rss-backend" ] || [ "Cargo.toml" -nt "target/release/rss-backend" ]; then
        print_info "编译后端（生产模式）..."
        source ~/.cargo/env 2>/dev/null || true
        RUST_ENV=production cargo build --release
    else
        print_info "后端二进制文件已是最新版本"
    fi

    cd ..
    print_success "后端构建完成"
}

# 测试前端
test_frontend() {
    print_info "运行前端测试（TypeScript 类型检查）..."

    cd rss-desktop

    if [ ! -d "node_modules" ]; then
        print_info "安装前端依赖..."
        npm install
    fi

    if ! npm run typecheck; then
        print_error "前端测试失败（TypeScript 类型检查未通过）"
        cd ..
        return 1
    fi

    cd ..
    print_success "前端测试通过"
}

# 测试后端
test_backend() {
    print_info "运行后端测试..."

    cd rust-backend
    source ~/.cargo/env 2>/dev/null || true

    if ! cargo test; then
        print_error "后端测试失败"
        cd ..
        return 1
    fi

    cd ..
    print_success "后端测试通过"
}

# 启动后端
start_backend() {
    print_info "启动后端服务（开发模式）..."

    cd rust-backend

    # 检查端口占用
    if lsof -i :27495 &> /dev/null 2>&1; then
        print_warning "端口 27495 被占用，正在释放..."
        lsof -ti :27495 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    # 启动后端服务（debug 模式，开发环境）
    source ~/.cargo/env 2>/dev/null || true
    RUST_ENV=development cargo run &
    BACKEND_PID=$!
    PIDS+=($BACKEND_PID)

    cd ..
    print_success "后端服务已启动 (PID: $BACKEND_PID)"
    print_status "后端服务地址: http://127.0.0.1:27495"
}

# 启动前端
start_frontend() {
    print_info "启动前端应用..."

    cd rss-desktop

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        print_info "安装前端依赖..."
        npm install
    fi

    # 启动前端开发服务器
    npm run dev &
    FRONTEND_PID=$!
    PIDS+=($FRONTEND_PID)

    cd ..
    print_success "前端开发服务器已启动 (PID: $FRONTEND_PID)"
    print_status "前端开发地址: http://127.0.0.1:5173"
}

# 显示服务状态
show_status() {
    echo ""
    print_header
    print_status "开发服务器运行状态:"

    echo "🌐 前端开发服务器: http://127.0.0.1:5173 (Vite Dev Server)"
    echo "🚀 Rust 后端API: http://127.0.0.1:27495"
    echo ""
    print_info "API 健康检查: curl http://127.0.0.1:27495/"
    print_info "测试 RSS 源: curl -X POST http://127.0.0.1:27495/api/feeds -H 'Content-Type: application/json' -d '{\"title\":\"测试RSS\",\"url\":\"https://feeds.bbci.co.uk/news/rss.xml\"}'"
    echo ""

    print_info "开发模式特性:"
    print_warning "• 前端支持热重载 (Hot Module Replacement)"
    print_warning "• 后端使用 Rust debug 模式"
    print_warning "• 详细错误信息和调试输出"
    echo ""

    print_info "停止服务: Ctrl+C"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --frontend    仅启动前端开发服务器 (npm run dev)"
    echo "  --backend     仅启动 Rust 后端 (debug 模式)"
    echo "  --build       构建生产版本 (前端 + 后端 release)"
    echo "  --test        运行前后端测试（前端 TypeScript 类型检查 + 后端 cargo test）"
    echo "  --check       检查环境和依赖"
    echo "  --help        显示此帮助"
    echo ""
    echo "示例:"
    echo "  $0              启动完整开发环境 (前端 dev + 后端 debug)"
    echo "  $0 --frontend    仅启动前端开发服务器"
    echo "  $0 --backend     仅启动 Rust 后端服务"
    echo "  $0 --build       构建生产版本"
    echo ""
    echo "说明:"
    echo "  • 默认模式为开发模式，支持热重载和调试"
    echo "  • --build 模式构建生产版本用于部署"
    echo "  • Rust 后端端口: 27495, 前端开发端口: 5173"
    echo ""
}

# 主函数
main() {
    local MODE="both"

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --frontend)
                MODE="frontend"
                shift
                ;;
            --backend)
                MODE="backend"
                shift
                ;;
            --build)
                MODE="build"
                shift
                ;;
            --test)
                MODE="test"
                shift
                ;;
            --check)
                MODE="check"
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    print_header

    case $MODE in
        "check")
            print_info "环境检查模式"
            check_rust && check_node && check_frontend && check_backend
            print_success "环境检查完成！"
            ;;
        "build")
            print_info "构建生产版本模式"
            check_rust && check_node && check_frontend && check_backend
            build_frontend
            build_backend
            print_success "项目构建完成！"
            ;;
        "test")
            print_info "测试模式（前后端）"
            check_rust && check_node && check_frontend && check_backend
            test_frontend
            test_backend
            print_success "前后端测试全部通过！"
            ;;
        "frontend")
            print_info "仅启动前端开发服务器"
            check_node && check_frontend
            start_frontend
            show_status
            wait
            ;;
        "backend")
            print_info "仅启动后端开发服务器"
            check_rust && check_backend
            start_backend
            show_status
            wait
            ;;
        "both")
            print_info "启动前后端开发服务"
            check_rust && check_node && check_frontend && check_backend
            start_backend
            start_frontend
            show_status
            wait
            ;;
    esac
}

# 执行主函数
main "$@"
