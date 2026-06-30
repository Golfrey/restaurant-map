# Resy + inKind Restaurant Map

Local web app that combines restaurants from Resy and inKind into one cached map, with searchable city and restaurant filtering.

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
- [Deployment](docs/DEPLOYMENT.md)

## API

- `GET /api/status?city=nyc`
- `GET /api/cities`
- `GET /api/restaurants?city=nyc`
- `GET /api/cron/refresh` on Vercel only, protected by `CRON_SECRET`

Supported city codes are defined in `shared/cities.ts`: `nyc`, `la`, `chi`, `sf`, `dc`, `mia`, `bos`, `phl`, `atl`, `aus`, `dal`, `den`, `sea`, and `lv`.

## Configuration

Copy `.env.example` to `.env` or export variables directly:

- `PORT`
- `CACHE_TTL_HOURS`
- `RESY_API_KEY`
- `RESY_USER_AGENT`
- `CITY` or `DEFAULT_CITY` defaults to `nyc`
- `CITY_CENTER` overrides the selected `CITY`/`DEFAULT_CITY` center
- `CITY_RADIUS_MILES` overrides the selected `CITY`/`DEFAULT_CITY` radius
- `RESY_MAX_PAGES`
- `RESY_PER_PAGE`
- `UPSTREAM_TIMEOUT_MS`
- `UPSTASH_REDIS_REST_URL` for Vercel's durable cache
- `UPSTASH_REDIS_REST_TOKEN` for Vercel's durable cache
- `CRON_SECRET` for Vercel's daily refresh endpoint
- `VITE_STADIA_MAP_STYLE` defaults to Stamen Toner Lite/Dark. Use `{tone}` so the global light/dark theme can swap map styles.
- `VITE_STADIA_MAPS_API_KEY`

See [Deployment](docs/DEPLOYMENT.md) for the Vercel and Upstash setup.

The Resy and inKind endpoints are unofficial public web surfaces and may change.
