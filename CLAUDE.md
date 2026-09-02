# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aurora RSS Reader is a cross-platform RSS reader with AI-powered translation, summarization, semantic search, tagging, and an MCP server for AI agents. Two surfaces share one backend:
- **Node.js Backend** (`backend-node/`) - Fastify + TypeScript + better-sqlite3; also hosts the MCP server
- **Desktop** (`rss-desktop/`) - Electron + Vue 3, spawns and manages the backend

A mobile client is being rebuilt (framework under re-evaluation; the previous Vue 3 + Capacitor implementation is archived on branch `archive/mobile-plan-d-v1`). The backend already exposes `/api/mobile` endpoints for future LAN/self-hosted mobile clients.

## Development Commands

### Quick Start
```bash
# Recommended: Use Node.js backend
cd rss-desktop
pnpm dev              # Starts Electron + Node.js backend
```

### Node.js Backend (from backend-node/)
```bash
npm install           # Install dependencies
npm run dev           # Run Fastify server with tsx watch (http://127.0.0.1:15432)
npm run build         # Compile TypeScript to JavaScript
npm start             # Run compiled JavaScript
```

### Frontend (from rss-desktop/)
```bash
pnpm dev              # Run both frontend and backend concurrently
pnpm dev:frontend     # Vite dev server only (http://localhost:5173)
pnpm dev:electron     # Electron dev mode
pnpm build            # TypeScript check + Vite production build
pnpm pack             # Build + electron-builder packaging
pnpm typecheck        # TypeScript validation only
pnpm clean            # Remove build artifacts
```

### Backend (from backend-node/)
```bash
# Node.js backend (recommended)
npm install
npm run dev    # Run Fastify server (http://127.0.0.1:15432)
```

### Mobile API
The backend serves mobile clients over HTTP at `/api/mobile` ([routes/mobile.ts](backend-node/src/routes/mobile.ts)): cursor-paginated, presentation-shaped payloads. CORS already allows LAN origins and Capacitor schemes, so a self-hosted or LAN backend can serve phone clients.

### Testing (from backend-node/)
```bash
npm test                                         # Run all tests (node --test + tsx)
node --import tsx --test test/feedNormalizer.test.ts   # Run a single test file
```
Tests live in `backend-node/test/*.test.ts` using the built-in `node:test` runner. Frontend has no unit tests — rely on `pnpm typecheck`.

### MCP Server (from backend-node/)
```bash
npm run mcp           # Run MCP server over stdio (mcp-server.ts)
```
The MCP server is also exposed over HTTP at `/mcp` (Streamable HTTP transport) by the main backend. Tools are registered in [mcp/tools/index.ts](backend-node/src/mcp/tools/index.ts).

### Building Release
```bash
./build-release-app.sh    # Build platform-specific desktop installers
```

## Architecture

### Two-Process Architecture
- **Frontend**: Vue 3 SPA bundled with Electron (`rss-desktop/`)
- **Backend**: Standalone Node.js service (`backend-node/`) - Fastify + TypeScript + better-sqlite3

### Electron Main Process (`rss-desktop/electron/main.ts`)
- Spawns and manages the backend lifecycle (Node.js)
- **Node.js mode**: Runs `npm run dev` in `backend-node/` directory
- **Production**: Launches packaged Node.js backend entry from `resources/backend-node/`
- Health-checks backend at startup (5-minute timeout, 500ms polling)
- Handles IPC for opening external URLs

### Node.js Backend Layering (`backend-node/src/`)
The backend follows a strict **routes → services → repositories → db** layering. Routes parse/validate and shape HTTP responses; services hold business logic and orchestration; repositories own all SQL (better-sqlite3, synchronous). The MCP tool layer is a parallel entry point that reuses the same services/repositories.

- `routes/` — Fastify handlers, registered with `/api` prefix in [main.ts](backend-node/src/main.ts): `feeds`, `entries`, `ai`, `opml`, `icons`, `userSettings`, `scheduler`, `tags`, `collections`, `zotero`, `mobile`.
- `services/` — business logic. Notable: `fetcher` (RSS fetch), `feedIngestService`/`feedNormalizer`/`feedSourceResolver` (ingest + normalize a fetched feed into entries), `ai` (LLM client via OpenAI SDK), `vector` (embeddings + semantic search), `scheduler` (node-cron jobs), `articleExtractionService` (full-text via @mozilla/readability), `summaryGenerationService`/`scopeSummary`/`aggregateDigest` (AI summaries & digests), `tagging`/`autoTagging`/`aiAutomationResolver`/`ruleMatching` (auto-tagging rules), `entryPresentation` (shared entry serialization), `outboundHttp`/`http` (outbound fetch with proxy/UA handling), `zotero`.
- `db/` — `models.ts` (interfaces), `init.ts` (schema + FTS5 + vector tables + migrations), `session.ts` (connection), `repositories/` (one per model).
- `mcp/` — `server.ts` (HTTP transport), `tools/index.ts` (tool registry). `mcp-server.ts` at root is the stdio entry point.
- `scripts/` — one-off maintenance: `backfill-enclosures`, `rebuild-vectors`, `benchmark-search`.

### Frontend Structure (`rss-desktop/src/`)
```
src/
├── stores/         # Pinia stores (feedStore, aiStore, settingsStore, favoritesStore, ...)
├── composables/    # Vue composables for reusable logic (e.g. useVideoExtractor)
├── components/     # Vue components (sidebar/, timeline/, details/, settings/)
├── api/client.ts   # Axios instance configured for backend
└── i18n/           # Multi-language support (zh-CN, en-US, ja-JP, ko-KR)
```

### Data Flow
1. Scheduler (node-cron, every 5 min) fetches due feeds → `feedIngestService` normalizes → SQLite (`entries`)
2. Background jobs enrich entries: article extraction, embeddings (`rss_vectors`), AI summaries, auto-tagging
3. Clients (desktop REST, mobile `/api/mobile`, MCP agents) read/mutate via the backend → AI results cached in DB

### Background Scheduler
- node-cron runs every 5 minutes ([services/scheduler.ts](backend-node/src/services/scheduler.ts)); skips a run if the previous one is still in progress
- Refreshes feeds concurrently (`runWithConcurrency`), respecting per-feed `update_interval_minutes` and the global `auto_refresh`/`fetch_interval_minutes` settings
- Also drives queued background jobs (article extraction, summary generation, embeddings); writes `fetch_logs` per attempt

### Search (FTS + vector)
- **Keyword**: SQLite FTS5 virtual table `entries_fts`, kept in sync by triggers (created in [db/init.ts](backend-node/src/db/init.ts))
- **Semantic**: `sqlite-vss` extension + `rss_vectors` table; embeddings generated by `vector.ts` using a configurable OpenAI-compatible embeddings API
- **Hybrid**: combines both. Exposed via REST and the MCP `search_entries` tool (modes: `keyword` / `semantic` / `hybrid`)

### Database Tables (SQLite)
Core: `feeds`, `entries`, `translations`, `summaries`, `fetch_logs`. Plus: `collections`/`collection_entries`, `user_tags`/`entry_tags`, `entry_analysis_status`, `ai_automation_rules`, `aggregate_digests`, `digest_tag_summaries`, `scope_summary_runs`/`scope_summary_chunks`, `article_extraction_jobs`, `summary_generation_jobs`, `search_index_meta`, `rss_vectors` (vector index), `entries_fts` (FTS5). Schema and migrations are all in [db/init.ts](backend-node/src/db/init.ts).

### Platform-Specific Data Directories
- macOS: `~/Library/Application Support/Aurora RSS Reader/`
- Windows: `%APPDATA%/Aurora RSS Reader/`
- Linux: `~/.config/aurora-rss-reader/`

## Configuration

### Node.js Backend Config (environment variables)
```env
API_PORT=15432
API_HOST=127.0.0.1
NODE_ENV=development

# Database (auto-detected platform-specific path if not set)
# DATABASE_PATH=/path/to/custom/database.db

RSSHUB_BASE_URL=https://rsshub.app

# AI Configuration
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/   # default; any OpenAI-compatible endpoint works
GLM_MODEL=glm-4-flash
GLM_API_KEY=<your_key>                  # Required for AI features
```

The AI client ([services/ai.ts](backend-node/src/services/ai.ts)) uses the **OpenAI SDK** against any OpenAI-compatible endpoint — GLM is only the default. The base URL / model / API key (and a separate embeddings base URL / key for vector search) are configurable at runtime through user settings, not only via env vars. `<think>` tags from reasoning models are stripped from responses.

## Key Patterns

### Frontend
- Uses Composition API with `<script setup>` syntax
- State management via Pinia stores with composables for complex logic
- HTML content sanitized with DOMPurify before rendering
- Virtual scrolling via vue-virtual-scroller for performance
- UnoCSS for atomic styling with dark mode support

### Node.js Backend
- Repository pattern for all SQL (better-sqlite3 synchronous API) — never write SQL outside `repositories/`
- ESM throughout: backend is `"type": "module"`, so **relative imports must use `.js` extensions** even in `.ts` source
- Requires Node `>=22 <23`; the runner is `tsx` (dev/test), `tsc` for builds
- Fastify HTTP server with CORS for Electron/mobile origins; routes always under `/api`, MCP under `/mcp`
- Long-running AI work goes through job tables + the scheduler, not inline request handlers; AI/translation results are cached in DB to cut API cost
- Same services/repositories are reused by REST routes, the `/api/mobile` client surface, and MCP tools — put logic in services, not handlers
