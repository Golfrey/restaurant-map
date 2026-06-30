# Resy + inKind NYC Map

Local web app that combines NYC restaurants from Resy and inKind into one cached map.

The UI uses shadcn-style local components on Tailwind CSS. The map uses MapLibre GL with Stadia-hosted Stamen Toner vector styles. `localhost` works without Stadia auth; set a Stadia API key or domain auth for deployed use.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The frontend calls the local backend at `/api/restaurants`; the backend fetches third-party data and caches normalized responses under `.cache/`.

## Docs

- [Project structure](docs/PROJECT_STRUCTURE.md)

## API

- `GET /api/status`
- `GET /api/restaurants?city=nyc&refresh=false`

## Configuration

Copy `.env.example` to `.env` or export variables directly:

- `PORT`
- `CACHE_TTL_HOURS`
- `RESY_API_KEY`
- `RESY_USER_AGENT`
- `CITY_CENTER`
- `CITY_RADIUS_MILES`
- `RESY_MAX_PAGES`
- `RESY_PER_PAGE`
- `UPSTREAM_TIMEOUT_MS`
- `VITE_STADIA_MAP_STYLE` defaults to Stamen Toner Lite/Dark. Use `{tone}` so the global light/dark theme can swap map styles.
- `VITE_STADIA_MAPS_API_KEY`

The Resy and inKind endpoints are unofficial public web surfaces and may change.
