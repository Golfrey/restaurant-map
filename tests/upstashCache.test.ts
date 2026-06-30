import { describe, expect, test, vi } from "vitest";
import type { RestaurantResponse } from "../shared/types";
import { restaurantMetadataKey, restaurantPayloadKey, UpstashRestaurantCache } from "../server/upstashCache";

const payload: RestaurantResponse = {
  city: "nyc",
  generatedAt: "2026-06-30T17:00:00.000Z",
  cacheTtlHours: 24,
  restaurants: [],
  sourceCounts: { resy: 0, inkind: 0, both: 0, total: 0 }
};

function upstashResponse(result: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify({ result })
  };
}

describe("UpstashRestaurantCache", () => {
  test("reads raw restaurant payloads without parsing the large response", async () => {
    const fetcher = vi.fn().mockResolvedValue(upstashResponse(JSON.stringify({ ...payload, cached: true })));
    const cache = new UpstashRestaurantCache({ url: "https://redis.example.com/", token: "token", fetcher });

    const raw = await cache.getRestaurantPayloadRaw("nyc");

    expect(raw).toContain('"cached":true');
    expect(fetcher).toHaveBeenCalledWith(
      "https://redis.example.com",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(["GET", restaurantPayloadKey("nyc")])
      })
    );
  });

  test("writes payload and lightweight metadata keys", async () => {
    const fetcher = vi.fn().mockResolvedValue(upstashResponse("OK"));
    const cache = new UpstashRestaurantCache({ url: "https://redis.example.com", token: "token", fetcher });

    await cache.writeRestaurantPayload(payload, new Date("2026-07-01T10:00:00.000Z"));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].body).toBe(
      JSON.stringify(["SET", restaurantPayloadKey("nyc"), JSON.stringify({ ...payload, cached: true })])
    );
    const metadataCommand = JSON.parse(String(fetcher.mock.calls[1][1].body)) as [string, string, string];
    expect(metadataCommand[0]).toBe("SET");
    expect(metadataCommand[1]).toBe(restaurantMetadataKey("nyc"));
    expect(JSON.parse(metadataCommand[2])).toMatchObject({
      city: "nyc",
      generatedAt: payload.generatedAt,
      refreshedAt: "2026-07-01T10:00:00.000Z"
    });
  });

  test("reports Upstash errors", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "unauthorized" })
    });
    const cache = new UpstashRestaurantCache({ url: "https://redis.example.com", token: "bad", fetcher });

    await expect(cache.getRestaurantPayloadRaw("nyc")).rejects.toThrow("unauthorized");
  });
});
