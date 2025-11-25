#!/bin/bash
cd "."

# 设置生产模式环境变量
export RUST_ENV=production

# 启动后端服务
./aurora-backend
