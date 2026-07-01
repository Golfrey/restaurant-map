# Deployment

This app deploys to Vercel as a Vite static site plus serverless API functions. Public API requests read cached restaurant payloads from Upstash Redis. A daily Vercel Cron job refreshes all supported cities.

## Architecture

- Vercel builds the frontend with `npm run build` and serves `dist/`.
- API routes live in `api/` and call shared handlers in `server/apiHandlers.ts`.
- `GET /api/restaurants?city=nyc` reads `restaurants:<city>` from Upstash and returns the cached JSON.
- `GET /api/status?city=nyc` reads `meta:<city>` from Upstash.
- `GET /api/cron/refresh` fetches upstream Resy/inKind data, rebuilds every city payload, and writes successful full refreshes to Upstash.
- Public users cannot trigger live upstream refreshes. The UI reload button only reloads cached API data.

## Vercel Setup

Create a Vercel project from the repo. The required deployment settings are already in `vercel.json`:

- Framework: `vite`
- Build command: `npm run build`
- Output directory: `dist`
- SPA rewrite: non-API paths serve `/index.html`
- Cron schedule: `0 10 * * *`
- Cron max duration: `300` seconds

On Vercel Hobby, cron jobs run once daily with per-hour timing precision, so `0 10 * * *` can run any time from 10:00 to 10:59 UTC.

## Upstash Setup

Create an Upstash Redis database and copy the REST credentials into Vercel environment variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The app stores:

- `restaurants:<city>`: full `RestaurantResponse` JSON with `cached: true`
- `meta:<city>`: lightweight status metadata for `/api/status`

The public restaurant endpoint sets CDN cache headers for 24 hours so normal traffic is absorbed by Vercel CDN instead of hitting Upstash on every request.

## Environment Variables

Set these in Vercel before the first deploy:

```text
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
CACHE_TTL_HOURS=24
RESY_API_KEY=
RESY_USER_AGENT=
RESY_MAX_PAGES=100
RESY_PER_PAGE=100
UPSTREAM_TIMEOUT_MS=15000
VITE_STADIA_MAP_STYLE=https://tiles.stadiamaps.com/styles/stamen_toner_{tone}.json
VITE_STADIA_MAPS_API_KEY=
```

`VITE_STADIA_MAPS_API_KEY` is only needed if Stadia domain authentication is not configured for the deployed domain.

Use a random `CRON_SECRET` of at least 16 characters. Vercel sends it to cron endpoints as:

```text
Authorization: Bearer $CRON_SECRET
```

## First Deploy

1. Set all Vercel environment variables.
2. Deploy the Vercel project.
3. Seed Upstash once by calling the cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DEPLOYMENT_DOMAIN/api/cron/refresh"
```

4. Verify status for a city:

```bash
curl "https://YOUR_DEPLOYMENT_DOMAIN/api/status?city=nyc"
```

5. Open the deployed app and confirm restaurants load on the map.

## Verification

Run these checks before deploying deployment-sensitive changes:

```bash
npm test
npm run build
npm run check:payload-size -- --refresh
```

`check:payload-size` refreshes local `.cache/` data and verifies each city response stays below Vercel's 4.5 MB function response limit. Re-run it after changing Resy crawl depth because larger page caps increase response size.

## Failure Behavior

- If an upstream source fails during cron and the city refresh is partial, the cron job skips writing that city so the last good Upstash payload remains in place.
- If both upstream sources fail for a city, that city is reported as failed and the existing cache is preserved.
- If no Upstash payload exists yet, `/api/restaurants` returns `503` until the first successful cron seed.
- `/api/cron/refresh` returns `401` when the bearer token does not match `CRON_SECRET`.

## Local Development

Local development still uses the Express server and filesystem cache:

```bash
npm run dev
```

The local server supports `refresh=true` for development, but the production browser UI does not send that flag.
