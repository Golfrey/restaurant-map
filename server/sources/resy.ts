import type { Restaurant } from "../../shared/types";
import type { AppConfig } from "../config";
import { distanceMiles } from "../geo";
import { normalizeResyHit, type ResyVenueHit } from "../normalizers";
import { fetchJson, requireArray } from "./http";

interface ResySearchResponse {
  meta?: {
    page?: number;
    per_page?: number;
    total_pages?: number;
    total?: number;
  };
  search?: {
    hits?: ResyVenueHit[];
  };
  status?: number;
  message?: string;
  error?: {
    message?: string;
  };
}

const resySearchUrl = "https://api.resy.com/3/venuesearch/search";

export async function fetchResyRestaurants(config: AppConfig): Promise<Restaurant[]> {
  const restaurants = new Map<number, Restaurant>();

  for (let page = 1; page <= config.resyMaxPages; page += 1) {
    const payload = await fetchJson<ResySearchResponse>(
      resySearchUrl,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": config.resyUserAgent,
          Origin: "https://resy.com",
          Referer: "https://resy.com/",
          "X-Origin": "https://resy.com",
          Authorization: `ResyAPI api_key="${config.resyApiKey}"`
        },
        body: JSON.stringify({
          geo: {
            latitude: config.city.center.latitude,
            longitude: config.city.center.longitude
          },
          query: "",
          page,
          per_page: config.resyPerPage
        })
      },
      {
        sourceName: "Resy",
        timeoutMs: config.upstreamTimeoutMs
      }
    );

    if (payload.status) {
      throw new Error(payload.message || payload.error?.message || "Resy request failed.");
    }

    const hits = requireArray<ResyVenueHit>(payload.search?.hits, "Resy", "search.hits");
    if (!hits.length) break;

    let closestOnPage = Infinity;
    for (const hit of hits) {
      const lat = hit._geoloc?.lat;
      const lng = hit._geoloc?.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        closestOnPage = Math.min(
          closestOnPage,
          distanceMiles({ latitude: lat as number, longitude: lng as number }, config.city.center)
        );
      }

      const restaurant = normalizeResyHit(hit, config.city);
      if (restaurant?.sourceIds.resy) {
        restaurants.set(restaurant.sourceIds.resy, restaurant);
      }
    }

    const totalPages = payload.meta?.total_pages ?? page;
    if (page >= totalPages) break;
    if (page > 1 && closestOnPage > config.city.radiusMiles) break;
  }

  return Array.from(restaurants.values());
}
