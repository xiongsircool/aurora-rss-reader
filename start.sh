#!/bin/bash

# RSS READER - 快速启动脚本

echo "🚀 启动 RSS READER..."
echo ""

# 检查是否在项目根目录
if [ ! -d "backend-node" ] || [ ! -d "rss-desktop" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

ROOT_DIR="$(pwd)"
BACKEND_NODE_DIR="$ROOT_DIR/backend-node"
FRONTEND_DIR="$ROOT_DIR/rss-desktop"

# 检查后端依赖
if [ ! -d "$BACKEND_NODE_DIR/node_modules" ]; then
    echo "📦 安装 Node.js 后端依赖..."
    cd "$BACKEND_NODE_DIR"
    npm install
    cd "$ROOT_DIR"
    echo "✅ 后端依赖已安装"
else
    echo "✅ Node.js 后端依赖已存在"
fi

# 检查前端依赖
if [ ! -d "rss-desktop/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd rss-desktop
    pnpm install
    cd ..
    echo "✅ 前端依赖已安装"
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
