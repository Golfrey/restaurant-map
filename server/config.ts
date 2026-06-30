import path from "node:path";
import "dotenv/config";

export interface CityConfig {
  code: "nyc";
  name: string;
  center: {
    latitude: number;
    longitude: number;
  };
  radiusMiles: number;
}

export interface AppConfig {
  port: number;
  cacheTtlHours: number;
  cacheDir: string;
  resyApiKey: string;
  resyUserAgent: string;
  resyMaxPages: number;
  resyPerPage: number;
  upstreamTimeoutMs: number;
  city: CityConfig;
}

const defaultResyApiKey = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5";
const defaultResyUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cityCenterFromEnv(): { latitude: number; longitude: number } {
  const raw = process.env.CITY_CENTER;
  if (!raw) return { latitude: 40.7128, longitude: -74.006 };
  const [lat, lng] = raw.split(",").map((value) => Number(value.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { latitude: 40.7128, longitude: -74.006 };
  }
  return { latitude: lat, longitude: lng };
}

export function getConfig(): AppConfig {
  return {
    port: numberFromEnv("PORT", 8787),
    cacheTtlHours: numberFromEnv("CACHE_TTL_HOURS", 12),
    cacheDir: process.env.CACHE_DIR ?? path.resolve(process.cwd(), ".cache"),
    resyApiKey: process.env.RESY_API_KEY ?? defaultResyApiKey,
    resyUserAgent: process.env.RESY_USER_AGENT ?? defaultResyUserAgent,
    resyMaxPages: numberFromEnv("RESY_MAX_PAGES", 20),
    resyPerPage: numberFromEnv("RESY_PER_PAGE", 100),
    upstreamTimeoutMs: numberFromEnv("UPSTREAM_TIMEOUT_MS", 15_000),
    city: {
      code: "nyc",
      name: "New York City",
      center: cityCenterFromEnv(),
      radiusMiles: numberFromEnv("CITY_RADIUS_MILES", 15)
    }
  };
}
