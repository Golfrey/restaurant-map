import { describe, expect, test, vi } from "vitest";
import type { RestaurantResponse } from "../shared/types";
import { refreshAllCities } from "../server/cronRefresh";
import type { AppConfig } from "../server/config";
import type { RestaurantCacheStore } from "../server/upstashCache";

function payload(config: AppConfig, overrides: Partial<RestaurantResponse> = {}): RestaurantResponse {
  return {
    city: config.city.code,
    generatedAt: "2026-07-01T10:00:00.000Z",
    cacheTtlHours: 24,
    restaurants: [
      {
        id: `resy:${config.city.code}`,
        source: "resy",
        sourceIds: { resy: 1 },
        name: `${config.city.name} Test`,
        latitude: config.city.center.latitude,
        longitude: config.city.center.longitude,
        cuisines: [],
        tags: [],
        sourceUrls: { resy: "https://resy.com/test" }
      }
    ],
    sourceCounts: { resy: 1, inkind: 0, both: 0, total: 1 },
    ...overrides
  };
}

function cache(): RestaurantCacheStore {
  return {
    getRestaurantPayloadRaw: vi.fn(async () => "{}"),
    getMetadata: vi.fn(async () => null),
    writeRestaurantPayload: vi.fn(async () => undefined)
  };
}

describe("refreshAllCities", () => {
  test("writes successful city payloads", async () => {
    const store = cache();
    const summary = await refreshAllCities({
      cache: store,
      cityCodes: ["nyc", "la"],
      now: new Date("2026-07-01T10:00:00.000Z"),
      buildPayload: async (config) => payload(config)
    });

    expect(summary).toMatchObject({ refreshed: 2, skipped: 0, failed: 0 });
    expect(store.writeRestaurantPayload).toHaveBeenCalledTimes(2);
  });

  test("keeps refreshing other cities when one fails", async () => {
    const store = cache();
    const summary = await refreshAllCities({
      cache: store,
      cityCodes: ["nyc", "la"],
      buildPayload: async (config) => {
        if (config.city.code === "la") throw new Error("Resy fetch failed");
        return payload(config);
      }
    });

    expect(summary.refreshed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results.find((result) => result.city === "la")).toMatchObject({
      status: "failed",
      message: "Resy fetch failed"
    });
    expect(store.writeRestaurantPayload).toHaveBeenCalledTimes(1);
  });

  test("does not overwrite last good cache when a payload has upstream warnings", async () => {
    const store = cache();
    const summary = await refreshAllCities({
      cache: store,
      cityCodes: ["nyc"],
      buildPayload: async (config) => payload(config, { warnings: ["inKind fetch failed"] })
    });

    expect(summary).toMatchObject({ refreshed: 0, skipped: 1, failed: 0 });
    expect(store.writeRestaurantPayload).not.toHaveBeenCalled();
  });

  test("does not write empty city payloads", async () => {
    const store = cache();
    const summary = await refreshAllCities({
      cache: store,
      cityCodes: ["nyc"],
      buildPayload: async (config) =>
        payload(config, { restaurants: [], sourceCounts: { resy: 0, inkind: 0, both: 0, total: 0 } })
    });

    expect(summary).toMatchObject({ refreshed: 0, skipped: 1, failed: 0 });
    expect(store.writeRestaurantPayload).not.toHaveBeenCalled();
  });
});
