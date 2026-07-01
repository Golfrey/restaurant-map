# OpenTable Integration Research

Research date: 2026-07-01

## Summary

The practical OpenTable path for this project is the official OpenTable Partner Directory API, not a reverse-engineered public website endpoint.

OpenTable exposes a Partner Directory API for approved consumer partners. It returns restaurant metadata and reservation/profile links that map well to this app's existing restaurant model. Access requires partner approval, OAuth client credentials, and production access from OpenTable.

If we are not an OpenTable partner, OpenTable cannot be safely added as a live upstream data source from OpenTable's own site. OpenTable's current `robots.txt` blocks all bots by default and specifically disallows the consumer GraphQL/search endpoints that would be needed for a Resy-style implementation. The supported non-partner path is to link users out to OpenTable search/profile pages from restaurants already discovered through other sources, without copying OpenTable directory data into this app.

Official sources:

- OpenTable API documentation: https://docs.opentable.com/
- API partner FAQ: https://www.opentable.com/restaurant-solutions/api-partners/faqs/
- Become a partner application: https://www.opentable.com/restaurant-solutions/api-partners/become-a-partner/

## Access Model

OpenTable uses OAuth 2.0 client credentials.

- Pre-production OAuth base: `https://oauth-pp.opentable.com`
- Production OAuth base: `https://oauth.opentable.com`
- Token endpoint: `GET /api/v2/oauth/token?grant_type=client_credentials`
- API requests use `Authorization: Bearer <access_token>`

Production data access is gated by OpenTable approval and agreement. The docs also state that APIs and API data must be used according to the applicable agreement and documented API access path. Do not build this project around scraping OpenTable pages or private website calls.

OpenTable's public Terms of Use also prohibit using robots, spiders, scrapers, automated processes, or non-public APIs to access, copy, search, or monitor OpenTable services or content except when expressly authorized by OpenTable.

OpenTable's `robots.txt` is also explicit:

- `User-agent: *`
- `Disallow: /`
- Consumer data endpoints such as `/dapi/fe/gql?...RestaurantsAvailability`, `Autocomplete`, `MultiSearchResultsFacets`, `RestaurantMultiDayAvailability`, and related restaurant-search operations are disallowed even for allowed crawlers.

Source: https://www.opentable.com/robots.txt

## Real Data Source Options

For this app to treat OpenTable as a true source like Resy and inKind, use one of these inputs:

1. Official OpenTable Partner Directory API credentials.
2. A manually maintained local JSON/CSV file of OpenTable restaurants and profile URLs.
3. A third-party data provider that has redistribution rights for OpenTable-linked restaurant data.

The project can still be structured with a first-class `opentable` source adapter. The adapter should read from an authorized source, not scrape OpenTable.com or replay its consumer app APIs.

## Becoming A Partner For Free

OpenTable does not publish a self-serve free API partner tier on its public API pages.

What the public docs say:

- API access requires registering and securing approval as an integration partner.
- Approved partners get sandbox access for development and testing.
- Production API access requires a formal agreement and approval.
- API availability and cost may vary by API or selected tier.
- Pricing and availability are communicated during the approval and contracting process.

The best no-cost request path is to apply as a consumer-facing affiliate/listing partner for Directory API access, not as a full booking or restaurant-operations integration.

Recommended application positioning for this project:

- Type: `Consumer Facing`.
- Company type: closest fit is `Restaurant Listing Website`, `Travel Website`, `Destination Website/DMO`, or `Blog`, depending on how this map will be presented.
- Metadata question: answer `Yes`; request restaurant name, address, coordinates, profile URL, reservation URL, cuisine/category, price tier, rating/review count, and profile photo.
- Reservation question: answer `Yes` only if the app will send users to OpenTable reservation/profile links rather than taking bookings inside the app.
- Specific restaurant guest/reservation data: answer `No`; this app does not need restaurant-owned guest or reservation records.
- Posting data into OpenTable table-management software: answer `No`.
- Desired functionality: explain that the app maintains a restaurant discovery map, refreshes cached data daily, links users to OpenTable reservation/profile pages, and can display `Powered by OpenTable` or other required attribution.

Ask directly in the application or follow-up email:

```text
We are requesting no-cost affiliate/consumer Directory API access only. We do not need Sync, CRM, POS, guest, reservation, or table-management APIs. Can OpenTable provide free Directory API access for a restaurant discovery map that links diners to OpenTable reservation pages?
```

There is no guarantee this will be free or approved, but it is the narrowest request and best aligned with the public FAQ's Directory API/reservation-link use case.

Recommended non-partner implementation if a real OpenTable layer is still required:

- Add `server/sources/opentableManual.ts`.
- Load `data/opentable-restaurants.json` or a configured `OPENTABLE_DATA_FILE`.
- Normalize that file into the same `Restaurant` shape as Resy/inKind.
- Dedupe it against Resy/inKind by name and distance.
- Show `OpenTable` as a true source only for entries from that file.

Example local file:

```json
[
  {
    "name": "Le Gratin",
    "address": "5 Beekman St",
    "city": "New York",
    "state": "NY",
    "latitude": 40.7113,
    "longitude": -74.0069,
    "url": "https://www.opentable.com/r/le-gratin-new-york",
    "cuisines": ["French"],
    "price": "$$"
  }
]
```

## Non-Partner Approach

Because this project is not an OpenTable partner, use OpenTable as a link-out helper rather than a data provider.

Recommended implementation:

1. Keep Resy and inKind as the actual map data sources.
2. Add an OpenTable search URL helper that uses our existing restaurant name plus city/state.
3. Show a secondary `Search OpenTable` or `Find on OpenTable` button in restaurant details.
4. Do not add OpenTable to source counts, source filters, or map marker colors unless a restaurant has an explicit manually curated OpenTable URL.
5. Optionally support a local/manual override file for known OpenTable profile URLs.

Example generated search URL:

```text
https://www.opentable.com/s/?term=Le%20Gratin%20New%20York%20NY&covers=2
```

This is less precise than the Directory API, but it keeps the app useful without storing or scraping OpenTable content.

Optional manual override shape:

```json
{
  "le-gratin|new-york|ny": "https://www.opentable.com/r/le-gratin-new-york"
}
```

Normalize and validate any manual URL with the same `safeExternalUrl` pattern used for Resy and inKind. The frontend should accept `opentable.com` as an allowed external domain only for user-supplied or generated link-outs.

## Directory API

Relevant endpoint:

```text
GET {{base-url}}/sync/directory
```

Useful query parameters:

- `rid`: fetch one OpenTable restaurant ID.
- `country`: restrict to a country such as `US`.
- `offset`: pagination start, default `0`.
- `limit`: page size, documented default `1000`.

The Directory API returns a country-wide directory, not a city-radius search. The correct implementation is to fetch the directory, then filter locally by this project's configured city center and radius.

The docs say the directory data is refreshed nightly and recommend calling it at least once per day for current data. That fits the existing cron refresh model.

## Data Mapping

OpenTable fields that map cleanly to `Restaurant`:

- `rid` -> `sourceIds.opentableRid`
- `name` -> `name`
- `latitude`, `longitude` -> parsed coordinates
- `address`, `address2`, `city`, `state`, `postal_code`, `country` -> `address`
- `metro_name` -> possible `neighborhood` fallback
- `category` -> `cuisines`
- `aggregate_score`, `review_count` -> `rating`
- `price_quartile` -> `price`
- `natural_profile_url` or `natural_reservation_url` -> `sourceUrls.opentable`
- `profile_photo.sizes` -> `imageUrl`, preferably `wide-large`, `large`, then smaller fallbacks

Normalize OpenTable `http://www.opentable.com/...` URLs to `https://www.opentable.com/...` before exposing them, because the frontend currently rejects non-HTTPS external URLs.

If OpenTable provides a referral ID, append it to OpenTable URLs as `ref=<id>` using URL APIs so existing query strings are preserved.

## Recommended Local Design

The current code assumes exactly two providers:

- `RestaurantSource = "resy" | "inkind" | "both"`
- `sourceCounts` has `resy`, `inkind`, `both`, `total`
- Deduping only merges Resy to inKind.
- UI filters, badges, map colors, stats, and tests all special-case `both`.

Adding a third provider is a good point to replace the two-source model with explicit source membership.

Recommended shape:

```ts
export type RestaurantSource = "resy" | "inkind" | "opentable";

export interface Restaurant {
  sources: RestaurantSource[];
  sourceIds: {
    resy?: number;
    inkindLocationId?: number;
    inkindBrandId?: number;
    opentableRid?: number;
  };
  sourceUrls: {
    resy?: string;
    inkind?: string;
    opentable?: string;
  };
}
```

Then compute labels and counts from `sources`:

- Source filter `resy`: `restaurant.sources.includes("resy")`
- Source filter `opentable`: `restaurant.sources.includes("opentable")`
- "Multiple" or "Matched" count: `restaurant.sources.length > 1`
- Badge label: join source labels for small counts, or use `Multiple` when space is tight

This avoids inventing combinations like `resy-opentable`, `inkind-opentable`, and `all`.

## Fetcher Plan

Add `server/sources/opentable.ts` with:

1. `fetchOpenTableAccessToken(config)`
2. `fetchOpenTableDirectory(config)`
3. `normalizeOpenTableRestaurants(payload, config)`
4. `fetchOpenTableRestaurants(config)`

Suggested env vars:

```text
OPENTABLE_ENABLED=false
OPENTABLE_BASE_URL=
OPENTABLE_OAUTH_URL=https://oauth.opentable.com
OPENTABLE_CLIENT_ID=
OPENTABLE_CLIENT_SECRET=
OPENTABLE_REF_ID=
OPENTABLE_COUNTRY=US
OPENTABLE_PAGE_LIMIT=1000
OPENTABLE_MAX_PAGES=100
```

Use `OPENTABLE_ENABLED` so local development and existing deployments continue to work without credentials.

Token caching can be process-local, keyed by OAuth URL and client ID, expiring before `expires_in`. For serverless cron this is enough; each invocation can also fetch a fresh token safely.

## Cron And Caching

Do not fetch the full OpenTable directory once per city.

`server/cronRefresh.ts` already fetches the inKind map once and normalizes it per city. Mirror that design:

- Fetch OpenTable directory once at the start of `refreshAllCities`.
- Reuse the shared payload for each city's `normalizeOpenTableRestaurants`.
- If OpenTable fails and the other providers succeed, keep the existing warning behavior and skip cache overwrite when warnings are present.

For local non-cron `loadRestaurants`, fetching per city is acceptable for manual use, but an optional raw directory cache under `.cache/` would avoid repeated calls during development.

## Dedupe Plan

Refactor `dedupeRestaurants` from a two-array merge to a provider-agnostic merge:

1. Concatenate all provider-normalized restaurants.
2. For each restaurant, find an existing cluster within about `0.08` miles.
3. Require name similarity around the current `0.88` threshold.
4. Merge source IDs, URLs, cuisines, tags, ratings, image, price, address, and `sources`.
5. Sort by `distanceMiles`.

Keep provider precedence explicit. A reasonable initial precedence is:

1. Resy for canonical name and Resy URL when present.
2. OpenTable for rating/review count and reservation URL when present.
3. inKind for inKind purchase URL and tags.

## UI Work

Update these areas:

- `shared/types.ts`: add OpenTable source IDs and URLs; replace `source`/`both` if doing the recommended refactor.
- `server/repository.ts`: add OpenTable fetcher, warnings, counts, and dedupe input.
- `server/cronRefresh.ts`: shared OpenTable directory fetch.
- `server/normalizers/`: add OpenTable normalizer and fixture tests.
- `src/appUtils.ts`: source filtering, labels, allowed external domain.
- `src/components/app/SourceFilters.tsx`: add OpenTable and replace `Both` with `Multiple` if refactored.
- `src/components/app/SourcePill.tsx`, `src/components/ui/badge.tsx`, `src/styles.css`, `src/map/restaurantMap.ts`: OpenTable colors and labels.
- `src/components/app/RestaurantDetails.tsx`: add an `Open OpenTable` or `Online Reservations` button.
- `src/components/app/StatsStrip.tsx`: show OpenTable and multiple-source counts.
- Tests: fixtures, normalizer tests, source fetcher tests, repository partial-failure tests, UI source-filter tests.

## Main Risk

The blocker is not technical. It is access: OpenTable production Directory API requires partner approval and credentials. Without that approval, the app can only be prepared behind `OPENTABLE_ENABLED=false`; a real data fetch cannot be verified against production.
