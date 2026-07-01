import type { CityCode } from "../shared/cities.js";
import type { RestaurantResponse } from "../shared/types.js";

export interface RestaurantCacheMetadata {
  city: CityCode;
  generatedAt: string;
  cacheTtlHours: number;
  sourceCounts: RestaurantResponse["sourceCounts"];
  warnings?: string[];
  refreshedAt: string;
}

export interface RestaurantCacheStore {
  getRestaurantPayloadRaw(city: CityCode): Promise<string | null>;
  getMetadata(city: CityCode): Promise<RestaurantCacheMetadata | null>;
  writeRestaurantPayload(payload: RestaurantResponse, refreshedAt?: Date): Promise<void>;
}

type FetchLike = (
  url: string,
  init: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

interface UpstashCacheOptions {
  url: string;
  token: string;
  fetcher?: FetchLike;
}

interface UpstashResponse<T> {
  result?: T;
  error?: string;
}

export function restaurantPayloadKey(city: CityCode): string {
  return `restaurants:${city}`;
}

export function restaurantMetadataKey(city: CityCode): string {
  return `meta:${city}`;
}

export class UpstashRestaurantCache implements RestaurantCacheStore {
  private readonly url: string;
  private readonly token: string;
  private readonly fetcher: FetchLike;

  constructor({ url, token, fetcher = fetch }: UpstashCacheOptions) {
    this.url = url.replace(/\/+$/, "");
    this.token = token;
    this.fetcher = fetcher as FetchLike;
  }

  async getRestaurantPayloadRaw(city: CityCode): Promise<string | null> {
    return this.command<string | null>(["GET", restaurantPayloadKey(city)]);
  }

  async getMetadata(city: CityCode): Promise<RestaurantCacheMetadata | null> {
    const raw = await this.command<string | null>(["GET", restaurantMetadataKey(city)]);
    if (!raw) return null;
    return JSON.parse(raw) as RestaurantCacheMetadata;
  }

  async writeRestaurantPayload(payload: RestaurantResponse, refreshedAt = new Date()): Promise<void> {
    const cacheablePayload: RestaurantResponse = { ...payload, cached: true };
    const metadata: RestaurantCacheMetadata = {
      city: payload.city,
      generatedAt: payload.generatedAt,
      cacheTtlHours: payload.cacheTtlHours,
      sourceCounts: payload.sourceCounts,
      ...(payload.warnings?.length ? { warnings: payload.warnings } : {}),
      refreshedAt: refreshedAt.toISOString()
    };

    await this.command<string>(["SET", restaurantPayloadKey(payload.city), JSON.stringify(cacheablePayload)]);
    await this.command<string>(["SET", restaurantMetadataKey(payload.city), JSON.stringify(metadata)]);
  }

  private async command<T>(command: unknown[]): Promise<T> {
    const response = await this.fetcher(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
    const text = await response.text();
    const payload = parseUpstashResponse<T>(text);

    if (!response.ok || payload.error) {
      throw new Error(payload.error || `Upstash request failed with ${response.status}.`);
    }
    return payload.result as T;
  }
}

function parseUpstashResponse<T>(text: string): UpstashResponse<T> {
  try {
    return JSON.parse(text) as UpstashResponse<T>;
  } catch {
    throw new Error("Upstash returned invalid JSON.");
  }
}

export function createUpstashCacheFromEnv(): UpstashRestaurantCache {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.");
  }

  return new UpstashRestaurantCache({ url, token });
}
