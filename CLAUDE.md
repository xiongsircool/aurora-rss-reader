# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aurora RSS Reader is a cross-platform desktop RSS reader with AI-powered translation and summarization. It uses an Electron + Vue 3 frontend with a Node.js backend:
- **Node.js Backend** (`backend-node/`) - Fastify + TypeScript implementation

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

### Testing
No dedicated Node.js backend tests yet.

### Building Release
```bash
./build-release-app.sh    # Build platform-specific installers
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

### Node.js Backend Structure (`backend-node/src/`)
```
src/
├── config/         # Configuration service with platform-specific paths
├── db/
│   ├── models.ts   # TypeScript interfaces for all database models
│   ├── init.ts     # Database schema initialization
│   ├── session.ts  # Database connection management
│   └── repositories/  # CRUD operations for each model
├── routes/         # Fastify route handlers
│   ├── feeds.ts    # Feed management endpoints
│   ├── entries.ts  # Entry CRUD and read/star operations
│   ├── ai.ts       # Translation and summarization with caching
│   ├── opml.ts     # OPML import/export
│   ├── icons.ts    # Favicon fetching and caching
│   ├── userSettings.ts  # User preferences
│   └── scheduler.ts     # Background job control
├── services/
│   ├── fetcher.ts     # RSS feed fetching with rss-parser
│   ├── ai.ts          # GLM API client for AI features
│   ├── scheduler.ts   # node-cron background jobs
│   ├── userSettings.ts  # Settings management
│   ├── rsshubManager.ts # RSSHub mirror handling
│   └── feedConfig.ts    # Feed-specific configurations
├── utils/
│   └── text.ts     # HTML cleaning utilities
└── main.ts         # Fastify server entry point
```

### Frontend Structure (`rss-desktop/src/`)
```
src/
├── stores/         # Pinia stores (feedStore, aiStore, settingsStore, favoritesStore)
├── composables/    # Vue composables for reusable logic
├── components/     # Vue components (sidebar/, timeline/, details/, settings/)
├── api/client.ts   # Axios instance configured for backend
└── i18n/           # Multi-language support (zh, en, ja, ko)
```

### Data Flow
1. RSS feeds fetched by background scheduler (node-cron) → stored in SQLite
2. Frontend fetches data via REST API → displays in Vue components
3. AI features proxy through backend to GLM-4-Flash API → cached in Translation/Summary tables

### Background Scheduler
- node-cron runs every 5 minutes, checks feed update intervals
- Respects per-feed `update_interval_minutes` and global `auto_refresh` setting
- Creates FetchLog entries for each refresh attempt

### Database Tables (SQLite)
- `feeds` - RSS subscriptions with group support
- `entries` - Articles (with read/starred flags)
- `translations` - Cached translations per entry+language
- `summaries` - Cached AI summaries per entry+language
- `fetch_logs` - Feed fetch history

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
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash
GLM_API_KEY=<your_key>                  # Required for AI features
```

## Key Patterns

### Frontend
- Uses Composition API with `<script setup>` syntax
- State management via Pinia stores with composables for complex logic
- HTML content sanitized with DOMPurify before rendering
- Virtual scrolling via vue-virtual-scroller for performance
- UnoCSS for atomic styling with dark mode support

### Node.js Backend
- Repository pattern for database operations (better-sqlite3 synchronous API)
- Fastify for HTTP server with CORS configured for Electron origins
- Configuration service with platform-specific data directory detection
- Background scheduler with node-cron (runs every 5 minutes)
- AI response caching in database to reduce API costs
