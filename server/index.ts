import express from "express";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "./config";
import { cachePath, readCache } from "./cache";
import { loadRestaurants } from "./repository";

export function createApp() {
  const app = express();
  const config = getConfig();
  const distPath = path.resolve(process.cwd(), "dist");

  app.get("/api/status", async (_req, res) => {
    const cached = await readCache(config.cacheDir, config.city.code);
    res.json({
      ok: true,
      city: config.city,
      cache: {
        path: cachePath(config.cacheDir, config.city.code),
        generatedAt: cached?.generatedAt ?? null,
        ttlHours: config.cacheTtlHours
      }
    });
  });

  app.get("/api/restaurants", async (req, res) => {
    const city = String(req.query.city ?? "nyc").toLowerCase();
    if (city !== "nyc") {
      res.status(400).json({ message: "Only city=nyc is supported in v1." });
      return;
    }

    try {
      const refresh = String(req.query.refresh ?? "false").toLowerCase() === "true";
      const payload = await loadRestaurants(config, { refresh });
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
