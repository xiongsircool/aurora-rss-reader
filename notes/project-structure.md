# Project Structure Snapshot (Dec 2024)

```
RSSpage/
├── rss-desktop/          # Electron + Vite + Vue renderer (Pinia/Router to be added)
│   ├── package.json
│   ├── electron/         # Main/Preload processes scaffolded by create-electron-vite
│   ├── src/              # Vue components entry point
│   └── ...
├── backend/              # FastAPI service (feeds, storage, AI adapters)
│   ├── app/
│   │   ├── api/routes/   # FastAPI routers, e.g. health
│   │   ├── core/         # Settings, logging, constants
│   │   ├── db/           # SQLModel engine/session helpers
│   │   └── services/     # Feed fetcher, GLM adapter, background jobs
│   ├── scripts/          # `serve.py`, `migrate.py`
│   ├── pyproject.toml
│   └── .env.example
├── notes/                # Planning + documentation
│   ├── next-actions.md
│   └── project-structure.md (this file)
├── todolist.md           # High-level roadmap (Vue + Electron + Python)
├── UI.md                 # Visual spec
└── 项目细节与设计.md       # Technical design reference
```

Keep desktop + backend loosely coupled so either side can evolve independently. Electron renderer should call the FastAPI server via HTTP/WebSocket over `http://127.0.0.1:8787`.
