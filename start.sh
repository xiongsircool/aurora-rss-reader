#!/bin/bash

# Aurora RSS Reader 启动脚本
# 依次启动后端（Rust）和前端（Vue 3）

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Aurora RSS Reader 启动${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在停止服务...${NC}"
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# 1. 启动后端
echo -e "${GREEN}[1/2] 启动 Rust 后端...${NC}"
cd rust-backend

# 检查配置文件
if [ ! -f "config.toml" ]; then
    echo -e "${YELLOW}提示: config.toml 不存在，正在从示例复制...${NC}"
    if [ -f "config.toml.example" ]; then
        cp config.toml.example config.toml
        echo -e "${YELLOW}请编辑 config.toml 填写您的配置（如 API Key）${NC}"
        echo ""
    fi
fi

# 加载 Rust 环境
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

# 启动后端
cargo run &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}✓ 后端已启动 (PID: $BACKEND_PID)${NC}"
echo -e "  API: http://127.0.0.1:27495"
echo ""

# 等待后端启动
sleep 3

# 2. 启动前端
echo -e "${GREEN}[2/2] 启动 Vue 3 前端...${NC}"
cd rss-desktop

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    pnpm install
fi

# 启动前端
pnpm run dev:frontend &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✓ 前端已启动 (PID: $FRONTEND_PID)${NC}"
echo -e "  Web: http://127.0.0.1:5173"
echo ""

# 显示运行状态
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🚀 服务运行中${NC}"
echo ""
echo "📱 前端: http://127.0.0.1:5173"
echo "🔧 后端: http://127.0.0.1:27495"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo -e "${BLUE}========================================${NC}"

# 等待进程
wait
