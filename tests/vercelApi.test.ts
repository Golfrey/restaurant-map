import { describe, expect, test, vi } from "vitest";
import type { RestaurantResponse } from "../shared/types";
import { handleCronRefresh, handleRestaurants, handleStatus, type ApiResponse } from "../server/apiHandlers";
import type { RestaurantCacheMetadata, RestaurantCacheStore } from "../server/upstashCache";

const payload: RestaurantResponse = {
  city: "nyc",
  generatedAt: "2026-06-30T17:00:00.000Z",
  cacheTtlHours: 24,
  restaurants: [],
  sourceCounts: { resy: 0, inkind: 0, both: 0, total: 0 },
  cached: true
};

const metadata: RestaurantCacheMetadata = {
  city: "nyc",
  generatedAt: "2026-06-30T17:00:00.000Z",
  cacheTtlHours: 24,
  sourceCounts: payload.sourceCounts,
  refreshedAt: "2026-07-01T10:00:00.000Z"
};

function mockResponse() {
  const state = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown
  };
  const res: ApiResponse = {
    status: vi.fn((code: number) => {
      state.statusCode = code;
      return res;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      state.headers[name] = value;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
    }),
    send: vi.fn((body: string) => {
      state.body = body;
    }),
    end: vi.fn((body?: string) => {
      state.body = body;
    })
  };
  return { res, state };
}

function cache(overrides: Partial<RestaurantCacheStore> = {}): RestaurantCacheStore {
  return {
    getRestaurantPayloadRaw: vi.fn(async () => JSON.stringify(payload)),
    getMetadata: vi.fn(async () => metadata),
    writeRestaurantPayload: vi.fn(async () => undefined),
    ...overrides
  };
}

describe("Vercel API handlers", () => {
  test("serves cached restaurant JSON with CDN cache headers", async () => {
    const store = cache();
    const { res, state } = mockResponse();

    await handleRestaurants({ method: "GET", query: { city: "nyc", refresh: "true" } }, res, { cache: store });

    expect(state.statusCode).toBe(200);
    expect(state.body).toBe(JSON.stringify(payload));
    expect(state.headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(state.headers["Cache-Control"]).toContain("s-maxage=86400");
    expect(store.getRestaurantPayloadRaw).toHaveBeenCalledWith("nyc");
  });

  test("rejects unsupported cities", async () => {
    const { res, state } = mockResponse();

    await handleRestaurants({ method: "GET", query: { city: "paris" } }, res, { cache: cache() });

    expect(state.statusCode).toBe(400);
    expect(state.body).toMatchObject({ message: expect.stringContaining("Unsupported city") });
  });

  test("returns 503 when cached payload is missing", async () => {
    const { res, state } = mockResponse();

    await handleRestaurants({ method: "GET", query: { city: "nyc" } }, res, {
      cache: cache({ getRestaurantPayloadRaw: vi.fn(async () => null) })
    });

    expect(state.statusCode).toBe(503);
    expect(state.body).toMatchObject({ message: expect.stringContaining("not available yet") });
  });

  test("reports stale status metadata", async () => {
    const { res, state } = mockResponse();

    await handleStatus({ method: "GET", query: { city: "nyc" } }, res, {
      cache: cache(),
      now: new Date("2026-07-03T18:00:00.000Z")
    });

    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({
      ok: true,
      cache: {
        stale: true,
        sourceCounts: payload.sourceCounts
      }
    });
  });

  test("protects cron refreshes with CRON_SECRET", async () => {
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "secret";
    const refresh = vi.fn();
    const { res, state } = mockResponse();

    await handleCronRefresh({ method: "GET", headers: {} }, res, { cache: cache(), refresh });

    expect(state.statusCode).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
    restoreCronSecret(originalSecret);
  });

  test("runs authorized cron refreshes", async () => {
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "secret";
    const refresh = vi.fn(async () => ({
      refreshedAt: "2026-07-01T10:00:00.000Z",
      refreshed: 1,
      skipped: 0,
      failed: 0,
      results: [{ city: "nyc" as const, status: "refreshed" as const }]
    }));
    const { res, state } = mockResponse();

    await handleCronRefresh({ method: "GET", headers: { authorization: "Bearer secret" } }, res, {
      cache: cache(),
      refresh
    });

    expect(state.statusCode).toBe(200);
    expect(refresh).toHaveBeenCalledOnce();
    expect(state.body).toMatchObject({ refreshed: 1, failed: 0 });
    restoreCronSecret(originalSecret);
  });
});

function restoreCronSecret(value: string | undefined) {
  if (value === undefined) {
    delete process.env.CRON_SECRET;
    return;
  }
  process.env.CRON_SECRET = value;
}
