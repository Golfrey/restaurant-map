import type { CityCode } from "../shared/cities.js";
import type { RestaurantResponse } from "../shared/types.js";
import { defaultCityCode, getConfig, supportedCities, type AppConfig } from "./config.js";
import { buildRestaurantPayload } from "./repository.js";
import { fetchInKindMap, normalizeInKindRestaurants, type InKindMapResponse } from "./sources/inkind.js";
import type { RestaurantCacheStore } from "./upstashCache.js";

export interface CityRefreshResult {
  city: CityCode;
  status: "refreshed" | "skipped" | "failed";
  message?: string;
  restaurants?: number;
  bytes?: number;
}

export interface CronRefreshSummary {
  refreshedAt: string;
  refreshed: number;
  skipped: number;
  failed: number;
  results: CityRefreshResult[];
}

interface RefreshAllCitiesOptions {
  cache: RestaurantCacheStore;
  cityCodes?: CityCode[];
  concurrency?: number;
  now?: Date;
  buildPayload?: (config: AppConfig) => Promise<RestaurantResponse>;
  fetchSharedInKindMap?: (config: AppConfig) => Promise<InKindMapResponse>;
}

export async function refreshAllCities({
  cache,
  cityCodes = supportedCities.map((city) => city.code),
  concurrency = 2,
  now = new Date(),
  buildPayload,
  fetchSharedInKindMap = fetchInKindMap
}: RefreshAllCitiesOptions): Promise<CronRefreshSummary> {
  const builder = buildPayload ?? (await createDefaultPayloadBuilder(now, fetchSharedInKindMap));
  const refreshedAt = now.toISOString();
  const results = await mapWithConcurrency(cityCodes, Math.max(1, concurrency), async (cityCode) => {
    const config = getConfig(cityCode);

    try {
      const payload = await builder(config);
      if (payload.warnings?.length) {
        return {
          city: cityCode,
          status: "skipped" as const,
          message: payload.warnings.join("; ")
        };
      }
      if (!payload.restaurants.length) {
        return {
          city: cityCode,
          status: "skipped" as const,
          message: "No restaurants returned."
        };
      }

      await cache.writeRestaurantPayload(payload, now);
      return {
        city: cityCode,
        status: "refreshed" as const,
        restaurants: payload.restaurants.length,
        bytes: Buffer.byteLength(JSON.stringify({ ...payload, cached: true }))
      };
    } catch (error) {
      return {
        city: cityCode,
        status: "failed" as const,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  return {
    refreshedAt,
    refreshed: results.filter((result) => result.status === "refreshed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results
  };
}

async function createDefaultPayloadBuilder(
  now: Date,
  fetchSharedInKindMap: (config: AppConfig) => Promise<InKindMapResponse>
): Promise<(config: AppConfig) => Promise<RestaurantResponse>> {
  let inKindMap: InKindMapResponse | null = null;
  let inKindError: unknown = null;

  try {
    inKindMap = await fetchSharedInKindMap(getConfig(defaultCityCode));
  } catch (error) {
    inKindError = error;
  }

  return (config) =>
    buildRestaurantPayload(config, {
      now,
      fetchInKind: async (cityConfig) => {
        if (!inKindMap) {
          throw inKindError instanceof Error ? inKindError : new Error("inKind map fetch failed.");
        }
        return normalizeInKindRestaurants(inKindMap, cityConfig);
      }
    });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
