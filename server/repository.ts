import type { Restaurant, RestaurantResponse } from "../shared/types";
import { sanitizeRestaurantLabels } from "../shared/labels";
import type { AppConfig } from "./config";
import { isCacheFresh, readCache, writeCache } from "./cache";
import { dedupeRestaurants } from "./dedupe";
import { fetchInKindRestaurants } from "./sources/inkind";
import { fetchResyRestaurants } from "./sources/resy";

export interface LoadOptions {
  refresh?: boolean;
  fetchResy?: (config: AppConfig) => Promise<Restaurant[]>;
  fetchInKind?: (config: AppConfig) => Promise<Restaurant[]>;
  now?: Date;
}

const inFlightLoads = new Map<string, Promise<RestaurantResponse>>();

export class UpstreamLoadError extends Error {
  constructor(public readonly warnings: string[]) {
    super(warnings.join("; "));
  }
}

function sourceCounts(restaurants: Restaurant[]): RestaurantResponse["sourceCounts"] {
  return {
    resy: restaurants.filter((restaurant) => restaurant.source === "resy").length,
    inkind: restaurants.filter((restaurant) => restaurant.source === "inkind").length,
    both: restaurants.filter((restaurant) => restaurant.source === "both").length,
    total: restaurants.length
  };
}

function sanitizeRestaurantPayload(payload: RestaurantResponse): RestaurantResponse {
  const restaurants = payload.restaurants.map(sanitizeRestaurantLabels);
  return {
    ...payload,
    restaurants,
    sourceCounts: sourceCounts(restaurants)
  };
}

export async function buildRestaurantPayload(config: AppConfig, options: LoadOptions = {}): Promise<RestaurantResponse> {
  const resyFetcher = options.fetchResy ?? fetchResyRestaurants;
  const inKindFetcher = options.fetchInKind ?? fetchInKindRestaurants;

  const [resyResult, inKindResult] = await Promise.allSettled([resyFetcher(config), inKindFetcher(config)]);
  const warnings: string[] = [];

  if (resyResult.status === "rejected") {
    warnings.push(`Resy fetch failed: ${resyResult.reason instanceof Error ? resyResult.reason.message : String(resyResult.reason)}`);
  }
  if (inKindResult.status === "rejected") {
    warnings.push(
      `inKind fetch failed: ${inKindResult.reason instanceof Error ? inKindResult.reason.message : String(inKindResult.reason)}`
    );
  }

  const bothFailed = resyResult.status === "rejected" && inKindResult.status === "rejected";
  if (bothFailed) {
    throw new UpstreamLoadError(warnings);
  }

  const resy = resyResult.status === "fulfilled" ? resyResult.value : [];
  const inkind = inKindResult.status === "fulfilled" ? inKindResult.value : [];
  const restaurants = dedupeRestaurants(resy, inkind).map(sanitizeRestaurantLabels);

  const payload: RestaurantResponse = {
    city: config.city.code,
    generatedAt: (options.now ?? new Date()).toISOString(),
    cacheTtlHours: config.cacheTtlHours,
    restaurants,
    sourceCounts: sourceCounts(restaurants),
    ...(warnings.length ? { warnings } : {})
  };

  return payload;
}

function warningsFromError(error: unknown): string[] {
  if (error instanceof UpstreamLoadError) return error.warnings;
  return [error instanceof Error ? error.message : String(error)];
}

async function loadRestaurantsFromSources(
  config: AppConfig,
  options: LoadOptions,
  cached: RestaurantResponse | null
): Promise<RestaurantResponse> {
  let payload: RestaurantResponse;
  try {
    payload = await buildRestaurantPayload(config, options);
  } catch (error) {
    if (cached) return { ...cached, cached: true, warnings: warningsFromError(error) };
    throw error;
  }

  const warnings = payload.warnings ?? [];
  if (warnings.length && cached) {
    return { ...cached, cached: true, warnings };
  }

  if (!warnings.length) {
    await writeCache(config.cacheDir, config.city.code, payload);
  }

  return payload;
}

export async function loadRestaurants(config: AppConfig, options: LoadOptions = {}): Promise<RestaurantResponse> {
  const rawCached = await readCache(config.cacheDir, config.city.code);
  const cached = rawCached ? sanitizeRestaurantPayload(rawCached) : null;
  if (!options.refresh && cached && isCacheFresh(cached, config.cacheTtlHours, options.now)) {
    return { ...cached, cached: true };
  }

  const hasInjectedFetchers = Boolean(options.fetchResy || options.fetchInKind);
  if (hasInjectedFetchers) {
    return loadRestaurantsFromSources(config, options, cached);
  }

  const key = config.city.code;
  const existing = inFlightLoads.get(key);
  if (existing) return existing;

  const inFlight = loadRestaurantsFromSources(config, options, cached).finally(() => {
    inFlightLoads.delete(key);
  });
  inFlightLoads.set(key, inFlight);
  return inFlight;
}
