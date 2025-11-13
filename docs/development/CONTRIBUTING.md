# 🤝 为 Aurora RSS Reader 贡献

欢迎来到 Aurora RSS Reader 社区！🌟 感谢你对本项目的兴趣。无论你是想修复 bug、添加新功能、改进文档，还是只是想提出建议，我们都非常欢迎你的贡献。

## 🌈 贡献前必读

### 🦄 成为"极光守护者"
- 你不需要成为开发者就能贡献！
- 提 Issue、写文档、测试功能都是宝贵贡献
- 我们相信每个贡献都像极光一样独特而美丽

### 🎯 我们欢迎什么
- 🐛 Bug 报告和修复
- ✨ 新功能建议和实现
- 📚 文档改进和翻译
- 🧪 测试和反馈
- 🎨 UI/UX 改进
- 🔧 性能优化
- 🌍 国际化支持

## 🚀 快速开始

### 1. 🍴 Fork 项目
```bash
# 1. 在 GitHub 上 Fork 这个仓库
# 2. 克隆你的 Fork
git clone https://github.com/xiongsircool/aurora-rss-reader.git
cd aurora-rss-reader

# 3. 添加上游仓库
git remote add upstream https://github.com/xiongsircool/aurora-rss-reader.git
```

### 2. 🔧 开发环境设置
```bash
# 使用我们的一键启动脚本（推荐）
chmod +x start.sh
./start.sh

# 或者手动设置（见 README.md 详细说明）
```

### 3. 🌿 创建功能分支
```bash
# 创建并切换到新分支
git checkout -b feature/你的功能名称
# 或者
git checkout -b fix/修复的问题描述
```

## 📝 贡献类型

### 🐛 报告 Bug

创建 Issue 时请包含：
- **详细描述**：什么情况下发生的问题
- **复现步骤**：如何重现这个问题
- **期望行为**：你期望发生什么
- **截图/日志**：如果有错误信息或截图，请附上
- **环境信息**：操作系统、版本号等

### ✨ 建议新功能

- 使用 **功能请求** 模板
- 清楚描述功能需求和使用场景
- 说明为什么这个功能对项目有价值

### 💻 代码贡献

#### 前端开发 (Vue 3)
```bash
cd rss-desktop
pnpm install
pnpm dev  # 开发模式
pnpm build  # 构建检查
pnpm typecheck  # 类型检查
```

#### 后端开发 (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m scripts.serve  # 启动后端
```

#### 代码风格
- **前端**：遵循 Vue 3 + TypeScript 最佳实践
- **后端**：遵循 FastAPI + Python 代码规范
- **注释**：关键逻辑请用中文注释
- **提交信息**：使用[约定式提交](https://www.conventionalcommits.org/zh-hans/)

```bash
# 提交信息格式
feat: 添加新的 RSS 源管理功能
fix: 修复暗色模式下的显示问题
docs: 更新安装说明
style: 代码格式化调整
refactor: 重构 RSS 解析逻辑
test: 添加单元测试
chore: 依赖更新
```

### 🌍 翻译贡献

我们支持多语言，欢迎翻译到新语言或改进现有翻译：

1. **语言文件位置**：`rss-desktop/src/i18n/locales/`
2. **已支持语言**：中文、英文、日语、韩语
3. **添加新语言**：
   - 复制 `zh-CN.json` 为新语言文件
   - 翻译所有文本
   - 在 `src/i18n/index.ts` 中注册新语言

### 📚 文档贡献

- 改进 README.md
- 添加使用教程
- 创建 API 文档
- 写技术博客
- 制作视频教程

## 🧪 测试指南

### 开发测试
```bash
# 前端测试
cd rss-desktop
pnpm typecheck  # 类型检查

# 后端测试
cd backend
python -m scripts.migrate  # 数据库迁移测试
curl http://127.0.0.1:15432/health  # 健康检查
```

### 手动测试清单
- [ ] 应用正常启动
- [ ] RSS 源添加和刷新
- [ ] 文章阅读和操作
- [ ] AI 功能（摘要/翻译）
- [ ] 设置页面功能
- [ ] 暗色/亮色主题切换
- [ ] 多语言切换

## 📤 提交 Pull Request

### PR 检查清单
提交 PR 前请确认：

- [ ] **代码测试**：代码能正常运行
- [ ] **类型检查**：无 TypeScript 错误
- [ ] **格式化**：代码格式统一
- [ ] **文档更新**：如需要，更新相关文档
- [ ] **提交信息**：使用约定式提交格式
- [ ] **无敏感信息**：检查无 API 密钥等泄露

### PR 模板
```markdown
## 🎯 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 代码重构
- [ ] 其他

## 📝 变更描述
简要描述这个 PR 的内容和目的

## 🔗 相关 Issue
Fixes #(issue 号码)

## 🧪 测试环境
- 操作系统：
- 浏览器/版本：
- Node.js 版本：

## 📸 截图（如适用）
添加相关截图说明变更
```

## 🎖️ 贡献者认可

### 贡献者名单
所有贡献者都会被添加到：
- README.md 中的贡献者列表
- 发布说明中的致谢部分
- 项目网站的贡献者页面

### "极光守护者"勋章
特别贡献者将获得：
- GitHub 社区的极光主题勋章 🌟
- 项目文档中的特殊致谢
- 未来新功能的内测资格

## 💬 交流社区

- **GitHub Issues**：Bug 报告和功能请求
- **GitHub Discussions**：技术讨论和问答
- **社区群组**：用户交流和分享

## 🚫 行为准则

请遵守我们的 [行为准则](CODE_OF_CONDUCT.md)：
- 尊重他人
- 保持友善
- 接受不同意见
- 共同维护良好氛围

## ❓ 常见问题

### Q: 我需要签署贡献许可协议吗？
A: 不需要，我们使用的是宽松的 Aurora 许可证。

### Q: 如何选择要解决的问题？
A: 查看 Issues 标签：`good first issue` 适合新手，`help wanted` 需要帮助。

### Q: 我的 PR 没有被马上合并怎么办？
A: 维护者会及时审查，请耐心等待。如有疑问可以在 PR 中评论。

### Q: 如何报告安全问题？
A: 请查看 [安全政策](SECURITY.md)，不要在公开 Issue 中报告安全漏洞。

## 🌟 特别感谢

感谢所有为 Aurora RSS Reader 做出贡献的开发者！

你们就像极光一样，照亮了这个项目的道路。🌈✨

---

💙 **记住：每个贡献，无论大小，都让 Aurora RSS Reader 变得更好！** 💙