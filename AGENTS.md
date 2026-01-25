# Repository Guidelines

## Project Structure & Module Organization
- `rss-desktop/` is the Electron + Vue 3 UI (Vite, Pinia, UnoCSS). Key folders: `src/components/`, `src/composables/`, `src/stores/`, `src/views/`, `src/i18n/`.
- `backend-node/` is the Fastify + TypeScript backend (recommended). Key folders: `src/routes/`, `src/services/`, `src/db/`.
- `images/` holds product assets; `tools/` has helper scripts; `build-release-app.sh` and `start.sh` are entry points.

## Build, Test, and Development Commands
- Root: `./start.sh` bootstraps the Node backend + Electron dev; `./build-release-app.sh` builds installers.
- Frontend (`rss-desktop/`): `pnpm dev` starts Vite + Electron with backend-node; `pnpm build` runs `vue-tsc` and production build; `pnpm pack` builds and packages.
- Node backend (`backend-node/`): `npm run dev` (tsx watch), `npm run build`, `npm start`.

## Coding Style & Naming Conventions
- Indentation: 2 spaces for TypeScript/Vue.
- Vue components use PascalCase (e.g. `EntryCard.vue`); composables are `useXxx.ts`; Pinia stores are `*Store.ts`.
- Node backend files use lowerCamelCase (e.g. `rsshubDefaults.ts`).
- Type checks: `vue-tsc` for UI.

## Testing Guidelines
- No dedicated frontend or Node backend tests yet; rely on `pnpm typecheck` and manual UI smoke tests.

## Commit & Pull Request Guidelines
- Commit messages follow `type: short summary` (e.g. `feat: add`, `fix:`, `docs:`, `chore:`).
- PRs should describe the affected area (UI or Node backend), link issues, list tests run, and include screenshots for UI changes.

## Configuration & Security
- Copy `.env.example` files in `backend-node/` and `rss-desktop/` when available.
- `GLM_API_KEY` is required for AI features; do not commit secrets.
- Frontend API base uses `VITE_API_BASE_URL` (defaults to `http://127.0.0.1:15432/api`).
