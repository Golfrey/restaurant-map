# Project Structure

This project is a local-first TypeScript app with a Vite/React frontend and an Express backend. The main boundary is simple: the server owns third-party fetching, normalization, dedupe, and cache policy; the client owns filtering, presentation, and map interaction.

## Top-Level Layout

```text
server/            Express API, cache policy, third-party source adapters
shared/            Types shared by server and client
src/               React app, frontend hooks, UI components, map helpers
tests/             Backend-focused Vitest tests and source fixtures
public/            Static browser assets
snapshots/         Visual/reference screenshots
docs/              Project documentation
```

## Frontend Layout

```text
src/App.tsx                 Screen composition and app-level state wiring
src/api.ts                  Browser API client for the local backend
src/appUtils.ts             Pure restaurant display/filter helpers
src/hooks/                  Stateful frontend behavior
src/components/app/         App-specific UI components
src/components/ui/          Reusable shadcn-style primitives
src/map/                    MapLibre layer, feature, style, and popup helpers
src/MapView.tsx             React lifecycle wrapper around MapLibre
src/styles.css              Tailwind theme tokens and global/map CSS
```

Use `src/components/app/` for restaurant-map UI that is not meant to be a generic primitive. Use `src/components/ui/` only for reusable low-level controls. Keep fetch lifecycle and theme side effects in `src/hooks/`; keep `App.tsx` focused on connecting data, filters, and layout.

## Backend Layout

```text
server/index.ts             Express app and HTTP routes
server/config.ts            Environment parsing and defaults
server/repository.ts        Cache/read-through orchestration and source failure policy
server/cache.ts             Cache file read/write/freshness helpers
server/sources/             Third-party HTTP clients
server/normalizers/         Third-party payload types and source-specific normalization
server/dedupe.ts            Cross-source restaurant matching and merge logic
server/geo.ts               Distance and radius helpers
```

Each upstream should have one adapter under `server/sources/` and one normalizer under `server/normalizers/`. Source adapters should fetch and validate response shape; normalizers should convert valid upstream records into `shared/types.ts` models.

## Shared Contracts

`shared/types.ts` is the contract between server and client. Keep API response changes backward-compatible unless the frontend and tests are updated in the same change. The `/api/restaurants` response is produced in `server/repository.ts` and consumed through `src/api.ts`.

## Testing

- Component and UI behavior tests live near the frontend in `src/*.test.tsx`.
- Backend unit tests live in `tests/`.
- Third-party fixture data lives in `tests/fixtures/`.
- Run `npm test` for the full Vitest suite and `npm run build` for type checking plus production bundling.
