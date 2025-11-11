# RSS READER Backend

FastAPI + SQLite service that powers feed ingestion, storage, and AI helpers for the RSS READER app.

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env  # fill GLM_API_KEY etc.
python -m scripts.serve
```

## Structure

- `app/core` – configuration, logging, settings.
- `app/db` – SQLModel engine/session helpers.
- `app/api/routes` – FastAPI routers consumed by Electron renderer.
- `app/services` – feed fetchers, AI adapters, background jobs.
- `scripts/` – helper entry points (dev server, migrations, maintenance).

All endpoints live under `http://localhost:8787/api` by default and communicate with the Electron renderer via HTTP/WebSocket/IPC bridge.
