# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aurora RSS Reader is a cross-platform desktop RSS reader with AI-powered translation and summarization. It uses an Electron + Vue 3 frontend with a FastAPI + SQLite backend.

## Development Commands

### Quick Start
```bash
# One-click startup (creates venv, installs deps, runs dev server)
./start.sh
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

### Backend (from backend/)
```bash
source .venv/bin/activate
python -m scripts.serve      # Run FastAPI server (http://127.0.0.1:15432)
python -m scripts.migrate    # Run Alembic migrations
```

### Testing
```bash
# Backend tests (from backend/ with venv activated)
pytest tests/
```

### Building Release
```bash
./build-release-app.sh    # Build platform-specific installers
```

## Architecture

### Two-Process Architecture
- **Frontend**: Vue 3 SPA bundled with Electron (`rss-desktop/`)
- **Backend**: Standalone FastAPI service (`backend/`) - bundled as PyInstaller executable in production

### Electron Main Process (`rss-desktop/electron/main.ts`)
- Spawns and manages the Python backend lifecycle
- In production: launches PyInstaller binary from `resources/backend/`
- Health-checks backend at startup (5-minute timeout, 500ms polling)
- Handles IPC for opening external URLs

### Backend Structure (`backend/app/`)
```
app/
├── api/routes/     # FastAPI endpoints (feeds, entries, ai, opml, icons, health)
├── db/             # SQLModel definitions and session management
├── services/       # Business logic (fetcher, ai proxy, rsshub)
├── schemas/        # Pydantic request/response models
└── core/config.py  # Environment-based settings
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
1. RSS feeds fetched by APScheduler background jobs → stored in SQLite
2. Frontend fetches data via REST API → displays in Vue components
3. AI features proxy through backend to GLM-4-Flash API → cached in Translation/Summary tables

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

Backend config via `backend/.env`:
```env
API_PORT=8787                           # Default 15432 in production
RSSHUB_BASE=https://rsshub.app
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash
GLM_API_KEY=<your_key>                  # Required for AI features
```

## Key Patterns

- Frontend uses Composition API with `<script setup>` syntax
- State management via Pinia stores with composables for complex logic
- Backend uses SQLModel (SQLAlchemy + Pydantic hybrid) for ORM
- HTML content sanitized with DOMPurify before rendering
- Virtual scrolling via vue-virtual-scroller for performance
- UnoCSS for atomic styling with dark mode support
