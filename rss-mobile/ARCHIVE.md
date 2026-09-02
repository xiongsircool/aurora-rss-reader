# rss-mobile 方案 D v1 归档

> 归档时间:2026-05-31 · 归档自 feature/ui-and-enhancements 工作区(此前从未进入 git)

## 为什么归档

维护者认为该版本的框架设计存在问题,决定推倒重建。移动端技术路线重新评估中,
核心待决策问题:**端上自洽(手机自己抓取/解析/存储) vs 自托管后端(轻客户端) vs 混合**。

## 当时的技术栈与结构

- Vue 3 + Capacitor 8 + @capacitor-community/sqlite (+ jeep-sqlite web 降级)
- `src/platform/` http/db 平台封装
- `src/data/` schema/migrations + repositories(feed/entry/settings/ai)
- `src/domain/` 从 backend-node 移植的领域逻辑(feedParser/feedNormalizer/entryPresentation/aiClient/contentType),带 vitest 单测
- `src/stores/` + `src/views/` inbox/reader/saved/sources/settings 五视图
- `design/` UI 设计稿(概念图、模板设计)

## 重建时值得回收的资产

1. `design/` 全部设计资产 —— 与框架无关
2. `src/domain/*` 领域逻辑与测试 —— 纯逻辑,框架无关,可直接移植到新方案
3. `src/data/schema.ts` 的表结构裁剪思路
4. 本仓库 `docs/plans/mobile-standalone-rewrite-plan.md` 中的踩坑记录
   (CapacitorHttp 编码/CORS、jsdom→DOMParser、fast-xml-parser 选型等)
