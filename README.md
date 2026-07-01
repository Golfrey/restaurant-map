# Resy + inKind Restaurant Map

Local web app that combines restaurants from Resy and inKind into one cached map, with searchable city and restaurant filtering.

The UI uses shadcn-style local components on Tailwind CSS. The map uses MapLibre GL with a Protomaps basemap. Production can use the Protomaps Hosted API/CDN; local development can fall back to a PMTiles archive.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The frontend calls the local backend at `/api/restaurants`; the backend fetches third-party data and caches normalized responses under `.cache/`.

Set `VITE_PROTOMAPS_API_KEY` to use Protomaps' hosted CDN basemap. Without an API key, the map falls back to a PMTiles archive at `public/maps/protomaps.pmtiles` by default, or at the URL configured with `VITE_PROTOMAPS_PMTILES_URL`. PMTiles files are ignored by git so large local extracts are not committed.

Browser location access requires a secure context. Use `localhost` on this machine, or expose Vite through Tailscale Serve and open the HTTPS tailnet URL instead of the raw `http://100.x.x.x:5173` address.

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
- `VITE_PROTOMAPS_API_KEY` enables the Protomaps Hosted API/CDN basemap.
- `VITE_PROTOMAPS_FLAVOR` defaults to `black` for the closest dark Toner-like local style. Supported values: `light`, `dark`, `white`, `grayscale`, and `black`.
- `VITE_PROTOMAPS_LANGUAGE` defaults to `en`.
- `VITE_PROTOMAPS_STYLE_URL` optionally overrides the hosted style URL; the API key is appended as `key=...`.
- `VITE_PROTOMAPS_PMTILES_URL` defaults to `/maps/protomaps.pmtiles` as the no-API-key fallback.

See [Deployment](docs/DEPLOYMENT.md) for the Vercel and Upstash setup.

The Resy and inKind endpoints are unofficial public web surfaces and may change.
