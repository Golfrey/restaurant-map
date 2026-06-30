import { isCacheFresh } from "./cache";
import { refreshAllCities, type CronRefreshSummary } from "./cronRefresh";
import { defaultCityCode, getConfig, normalizeCityCode, supportedCities, type CityCode } from "./config";
import { createUpstashCacheFromEnv, type RestaurantCacheStore } from "./upstashCache";

export interface ApiRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(payload: unknown): void;
  send(payload: string): void;
  end(payload?: string): void;
}

interface HandlerDeps {
  cache?: RestaurantCacheStore;
  now?: Date;
}

interface CronHandlerDeps extends HandlerDeps {
  refresh?: (cache: RestaurantCacheStore) => Promise<CronRefreshSummary>;
}

const restaurantCacheHeader = "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600";

export function handleCities(_req: ApiRequest, res: ApiResponse) {
  res.status(200).json({
    defaultCity: defaultCityCode,
    cities: supportedCities
  });
}

export async function handleRestaurants(req: ApiRequest, res: ApiResponse, deps: HandlerDeps = {}) {
  if (!requireGet(req, res)) return;

  const cityCode = cityFromRequest(req);
  if (!cityCode) {
    badCityResponse(req, res);
    return;
  }

  try {
    const cache = deps.cache ?? createUpstashCacheFromEnv();
    const rawPayload = await cache.getRestaurantPayloadRaw(cityCode);
    if (!rawPayload) {
      res.status(503).json({ message: `Cached restaurant data for "${cityCode}" is not available yet.` });
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", restaurantCacheHeader);
    res.status(200).send(rawPayload);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to read cached restaurants." });
  }
}

export async function handleStatus(req: ApiRequest, res: ApiResponse, deps: HandlerDeps = {}) {
  if (!requireGet(req, res)) return;

  const cityCode = cityFromRequest(req);
  if (!cityCode) {
    badCityResponse(req, res);
    return;
  }

  const cityConfig = getConfig(cityCode);
  try {
    const cache = deps.cache ?? createUpstashCacheFromEnv();
    const metadata = await cache.getMetadata(cityCode);
    if (!metadata) {
      res.status(503).json({
        ok: false,
        city: cityConfig.city,
        cache: null,
        message: `Cached restaurant metadata for "${cityCode}" is not available yet.`
      });
      return;
    }

    res.status(200).json({
      ok: true,
      city: cityConfig.city,
      cache: {
        generatedAt: metadata.generatedAt,
        refreshedAt: metadata.refreshedAt,
        ttlHours: metadata.cacheTtlHours,
        stale: !isCacheFresh(
          {
            city: cityCode,
            generatedAt: metadata.generatedAt,
            cacheTtlHours: metadata.cacheTtlHours,
            restaurants: [],
            sourceCounts: metadata.sourceCounts
          },
          metadata.cacheTtlHours,
          deps.now
        ),
        sourceCounts: metadata.sourceCounts,
        warnings: metadata.warnings ?? []
      }
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to read cache status." });
  }
}

export async function handleCronRefresh(req: ApiRequest, res: ApiResponse, deps: CronHandlerDeps = {}) {
  if (!requireGet(req, res)) return;
  if (!isAuthorizedCronRequest(req)) {
    res.status(401).json({ message: "Unauthorized cron request." });
    return;
  }

  try {
    const cache = deps.cache ?? createUpstashCacheFromEnv();
    const summary = deps.refresh ? await deps.refresh(cache) : await refreshAllCities({ cache });
    const statusCode = summary.refreshed > 0 ? (summary.failed || summary.skipped ? 207 : 200) : 502;
    res.status(statusCode).json(summary);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Cron refresh failed." });
  }
}

function requireGet(req: ApiRequest, res: ApiResponse): boolean {
  const method = req.method ?? "GET";
  if (method === "GET") return true;

  res.setHeader("Allow", "GET");
  res.status(405).json({ message: "Method not allowed." });
  return false;
}

function cityFromRequest(req: ApiRequest): CityCode | null {
  const raw = firstQueryValue(req.query?.city) ?? defaultCityCode;
  return normalizeCityCode(raw);
}

function badCityResponse(req: ApiRequest, res: ApiResponse) {
  const raw = firstQueryValue(req.query?.city) ?? "";
  res.status(400).json({
    message: `Unsupported city "${raw}". Supported cities: ${supportedCities.map((city) => city.code).join(", ")}.`
  });
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAuthorizedCronRequest(req: ApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = firstHeaderValue(req.headers?.authorization ?? req.headers?.Authorization);
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
