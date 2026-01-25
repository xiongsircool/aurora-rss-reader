#!/usr/bin/env node

/**
 * 后端打包优化脚本
 * 功能：只复制必需的文件，减少打包体积
 */

import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_ROOT = join(__dirname, '..')
const BACKEND_DIR = join(PROJECT_ROOT, 'backend-node')
const RESOURCES_DIR = join(PROJECT_ROOT, 'rss-desktop', 'resources', 'backend-node')

console.log('🚀 开始优化后端打包...')

// 清理旧资源
if (existsSync(RESOURCES_DIR)) {
  console.log('🧹 清理旧资源...')
  rmSync(RESOURCES_DIR, { recursive: true, force: true })
}
mkdirSync(RESOURCES_DIR, { recursive: true })

// 1. 复制编译后的代码
console.log('📦 复制编译后的代码...')
const distDir = join(BACKEND_DIR, 'dist')
if (!existsSync(distDir)) {
  console.error('❌ 错误: 后端未编译，请先运行 npm run build')
  process.exit(1)
}
cpSync(distDir, join(RESOURCES_DIR, 'dist'), { recursive: true })

// 2. 复制 package.json
console.log('📦 复制 package.json...')
copyFileSync(join(BACKEND_DIR, 'package.json'), join(RESOURCES_DIR, 'package.json'))

// 3. 复制 node_modules
console.log('📦 复制 node_modules...')
cpSync(join(BACKEND_DIR, 'node_modules'), join(RESOURCES_DIR, 'node_modules'), {
  recursive: true,
  filter: (src) => {
    // 过滤掉不必要的文件
    if (src.includes('/.cache')) return false
    if (src.includes('/test/')) return false
    if (src.includes('/tests/')) return false
    if (src.includes('/__tests__/')) return false
    if (src.includes('.md') && !src.endsWith('node_modules')) return false
    return true
  }
})

console.log('✅ 后端打包优化完成！')
console.log(`📂 输出目录: ${RESOURCES_DIR}`)
