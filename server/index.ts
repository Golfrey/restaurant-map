import express from "express";
import fs from "node:fs";
import path from "node:path";
import { defaultCityCode, getConfig, normalizeCityCode, supportedCities } from "./config.js";
import { cachePath, readCache } from "./cache.js";
import { loadRestaurants } from "./repository.js";

export function createApp() {
  const app = express();
  const config = getConfig();
  const distPath = path.resolve(process.cwd(), "dist");

  app.get("/api/cities", (_req, res) => {
    res.json({
      defaultCity: defaultCityCode,
      cities: supportedCities
    });
  });

  app.get("/api/status", async (req, res) => {
    const cityCode = normalizeCityCode(String(req.query.city ?? config.city.code)) ?? config.city.code;
    const cityConfig = getConfig(cityCode);
    const cached = await readCache(cityConfig.cacheDir, cityConfig.city.code);
    res.json({
      ok: true,
      city: cityConfig.city,
      cache: {
        path: cachePath(cityConfig.cacheDir, cityConfig.city.code),
        generatedAt: cached?.generatedAt ?? null,
        ttlHours: cityConfig.cacheTtlHours
      }
    });
  });

  app.get("/api/restaurants", async (req, res) => {
    const cityParam = String(req.query.city ?? defaultCityCode);
    const cityCode = normalizeCityCode(cityParam);
    if (!cityCode) {
      res.status(400).json({
        message: `Unsupported city "${cityParam}". Supported cities: ${supportedCities.map((city) => city.code).join(", ")}.`
      });
      return;
    }
    const cityConfig = getConfig(cityCode);

    try {
      const refresh = String(req.query.refresh ?? "false").toLowerCase() === "true";
      const payload = await loadRestaurants(cityConfig, { refresh });
      res.json(payload);
    } catch (error) {
      res.status(502).json({
        message: error instanceof Error ? error.message : "Failed to load restaurants."
      });
    }
  });

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const config = getConfig();
  createApp().listen(config.port, "127.0.0.1", () => {
    console.log(`API server listening on http://127.0.0.1:${config.port}`);
  });
}
