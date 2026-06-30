import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import type { Restaurant } from "../shared/types";
import { cachePath } from "../server/cache";
import { getConfig, type AppConfig } from "../server/config";
import { loadRestaurants } from "../server/repository";

const baseRestaurant: Restaurant = {
  id: "resy:1",
  source: "resy",
  sourceIds: { resy: 1 },
  name: "Test Restaurant",
  latitude: 40.7,
  longitude: -74,
  cuisines: ["Test"],
  tags: [],
  sourceUrls: { resy: "https://resy.com/test" }
};

const inKindRestaurant: Restaurant = {
  id: "inkind:2",
  source: "inkind",
  sourceIds: { inkindLocationId: 2, inkindBrandId: 3 },
  name: "New inKind Restaurant",
  latitude: 40.71,
  longitude: -74.01,
  cuisines: ["Test"],
  tags: [],
  sourceUrls: { inkind: "https://inkind.com/test" }
};

async function tempConfig(): Promise<AppConfig> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "resy-inkind-test-"));
  return { ...getConfig(), cacheDir: dir, cacheTtlHours: 12 };
}

describe("loadRestaurants cache behavior", () => {
  test("writes cache on fetch and reads fresh cache later", async () => {
    const config = await tempConfig();
    let fetchCount = 0;
    const payload = await loadRestaurants(config, {
      now: new Date("2026-06-30T17:00:00Z"),
      fetchResy: async () => {
        fetchCount += 1;
        return [baseRestaurant];
      },
      fetchInKind: async () => []
    });

    expect(payload.sourceCounts.total).toBe(1);
    expect(fetchCount).toBe(1);

    const cached = await loadRestaurants(config, {
      now: new Date("2026-06-30T18:00:00Z"),
      fetchResy: async () => {
        throw new Error("should not fetch");
      },
      fetchInKind: async () => {
        throw new Error("should not fetch");
      }
    });

    expect(cached.cached).toBe(true);
    expect(cached.restaurants[0].name).toBe("Test Restaurant");
  });

  test("serves stale cache if both upstreams fail", async () => {
    const config = await tempConfig();
    await loadRestaurants(config, {
      now: new Date("2026-06-30T17:00:00Z"),
      fetchResy: async () => [baseRestaurant],
      fetchInKind: async () => []
    });

    const stale = await loadRestaurants(config, {
      refresh: true,
      fetchResy: async () => {
        throw new Error("resy down");
      },
      fetchInKind: async () => {
        throw new Error("inkind down");
      }
    });

    expect(stale.cached).toBe(true);
    expect(stale.warnings).toEqual(expect.arrayContaining([expect.stringContaining("resy down")]));
  });

  test("serves existing cache and does not overwrite it when one upstream fails", async () => {
    const config = await tempConfig();
    await loadRestaurants(config, {
      now: new Date("2026-06-30T17:00:00Z"),
      fetchResy: async () => [baseRestaurant],
      fetchInKind: async () => []
    });

    const partial = await loadRestaurants(config, {
      refresh: true,
      now: new Date("2026-07-01T17:00:00Z"),
      fetchResy: async () => {
        throw new Error("resy down");
      },
      fetchInKind: async () => [inKindRestaurant]
    });

    expect(partial.cached).toBe(true);
    expect(partial.restaurants).toHaveLength(1);
    expect(partial.restaurants[0].name).toBe("Test Restaurant");
    expect(partial.warnings).toEqual(expect.arrayContaining([expect.stringContaining("resy down")]));

    const cachedRaw = await fs.readFile(cachePath(config.cacheDir, config.city.code), "utf8");
    expect(cachedRaw).toContain("2026-06-30T17:00:00.000Z");
    expect(cachedRaw).not.toContain("New inKind Restaurant");
  });

  test("returns partial data with warnings but does not write cache when one upstream fails and no cache exists", async () => {
    const config = await tempConfig();
    const partial = await loadRestaurants(config, {
      now: new Date("2026-06-30T17:00:00Z"),
      fetchResy: async () => [baseRestaurant],
      fetchInKind: async () => {
        throw new Error("inkind down");
      }
    });

    expect(partial.cached).toBeUndefined();
    expect(partial.sourceCounts.total).toBe(1);
    expect(partial.warnings).toEqual(expect.arrayContaining([expect.stringContaining("inkind down")]));
    await expect(fs.access(cachePath(config.cacheDir, config.city.code))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("ignores malformed cache and replaces it after a successful fresh fetch", async () => {
    const config = await tempConfig();
    await fs.mkdir(config.cacheDir, { recursive: true });
    await fs.writeFile(cachePath(config.cacheDir, config.city.code), "{not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const payload = await loadRestaurants(config, {
      now: new Date("2026-06-30T17:00:00Z"),
      fetchResy: async () => [baseRestaurant],
      fetchInKind: async () => []
    });

    expect(payload.sourceCounts.total).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Ignoring malformed cache file"));
    warn.mockRestore();
    const repaired = await fs.readFile(cachePath(config.cacheDir, config.city.code), "utf8");
    expect(JSON.parse(repaired).restaurants[0].name).toBe("Test Restaurant");
  });
});
