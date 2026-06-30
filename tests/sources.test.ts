import { afterEach, describe, expect, test, vi } from "vitest";
import { getConfig, type AppConfig } from "../server/config";
import { fetchInKindRestaurants } from "../server/sources/inkind";
import { fetchResyRestaurants } from "../server/sources/resy";

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...getConfig(),
    resyMaxPages: 1,
    upstreamTimeoutMs: 50,
    ...overrides
  };
}

function response(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("source fetchers", () => {
  test("times out hanging upstream requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      })
    );

    await expect(fetchInKindRestaurants(config({ upstreamTimeoutMs: 1 }))).rejects.toThrow(
      "inKind request timed out after 1ms."
    );
  });

  test("reports non-OK responses without requiring JSON bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("<html>unavailable</html>", 503)));

    await expect(fetchResyRestaurants(config())).rejects.toThrow("Resy request failed with 503");
  });

  test("reports invalid JSON from successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("<html>not json</html>")));

    await expect(fetchInKindRestaurants(config())).rejects.toThrow("inKind returned invalid JSON.");
  });

  test("reports invalid third-party array shapes before iterating them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(JSON.stringify({ tags: {}, brands: [], locations: [] })))
    );

    await expect(fetchInKindRestaurants(config())).rejects.toThrow("inKind response field tags must be an array.");
  });
});
