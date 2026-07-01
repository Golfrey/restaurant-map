import fs from "node:fs/promises";
import path from "node:path";
import type { RestaurantResponse } from "../shared/types.js";

export function cachePath(cacheDir: string, city: string): string {
  return path.join(cacheDir, `restaurants-${city}.json`);
}

export async function readCache(cacheDir: string, city: string): Promise<RestaurantResponse | null> {
  const filePath = cachePath(cacheDir, city);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as RestaurantResponse;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      console.warn(`Ignoring malformed cache file at ${filePath}.`);
      return null;
    }
    throw error;
  }
}

export async function writeCache(cacheDir: string, city: string, payload: RestaurantResponse): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cachePath(cacheDir, city), `${JSON.stringify(payload, null, 2)}\n`);
}

export function isCacheFresh(payload: RestaurantResponse, ttlHours: number, now = new Date()): boolean {
  const generatedAt = Date.parse(payload.generatedAt);
  if (!Number.isFinite(generatedAt)) return false;
  const ageMs = now.getTime() - generatedAt;
  return ageMs >= 0 && ageMs < ttlHours * 60 * 60 * 1000;
}
