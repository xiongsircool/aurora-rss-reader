#!/bin/bash

# RSS READER - 快速启动脚本

echo "🚀 启动 RSS READER..."
echo ""

# 检查是否在项目根目录
if [ ! -d "backend" ] || [ ! -d "rss-desktop" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

ROOT_DIR="$(pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/rss-desktop"
BACKEND_DB_PATH="$BACKEND_DIR/data/rss.sqlite"

# 检查 Python 虚拟环境
if [ ! -d "backend/.venv" ]; then
    echo "📦 创建 Python 虚拟环境..."
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e .
    cd ..
    echo "✅ Python 环境已创建"
else
    echo "✅ Python 虚拟环境已存在"
fi

# 检查前端依赖
if [ ! -d "rss-desktop/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd rss-desktop
    pnpm install
    cd ..
    echo "✅ 前端依赖已安装"
fi

# 检查环境配置
if [ ! -f "backend/.env" ]; then
    echo "⚠️  警告: backend/.env 文件不存在"
    echo "   请复制 backend/.env.example 并配置 GLM_API_KEY"
    exit 1
fi

# 初始化数据库（如果需要）
mkdir -p "$(dirname "$BACKEND_DB_PATH")"
if [ ! -f "$BACKEND_DB_PATH" ]; then
    echo "🗄️  初始化数据库..."
    cd backend
    source .venv/bin/activate
    python -m scripts.migrate
    cd ..
    echo "✅ 数据库已初始化"
fi

# 启动应用
echo ""
echo "🚀 启动完整开发环境..."
echo ""
echo "📍 访问地址:"
echo "   前端: http://localhost:5173 (或 Vite 指定端口)"
echo "   后端: http://localhost:15432"
echo "   健康检查: http://localhost:15432/health"
echo ""
echo "📝 说明："
echo "   1. 前端和后端服务将在后台启动"
echo "   2. Electron 应用窗口会自动打开"
echo "   3. 按 Ctrl+C 停止所有服务"
echo ""

# 启动完整开发环境（前端 + 后端 + Electron）
cd rss-desktop
pnpm dev
