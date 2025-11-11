# Immediate Next Actions

1. Wire `rss-desktop` scripts: add Pinia/Vue Router setup and `pnpm dev` script that launches Electron plus the FastAPI server (via `python -m scripts.serve`).
2. Flesh out SQLModel schema + Alembic migrations for feeds, subscriptions, entries, translations, summaries, fetch_logs.
3. Implement FastAPI endpoints for feeds/timeline + background fetcher (requests + feedparser + readability) writing into SQLite.
4. Expose GLM summary/translation endpoint in FastAPI using the provided base URL/model/key and store results in `translations`/`summaries` tables.
5. Add `.env.local` (renderer) and `backend/.env` templates referencing port/URLs so Electron renderer can call the API via axios/fetch.
