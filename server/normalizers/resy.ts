import type { Restaurant } from "../../shared/types";
import type { CityConfig } from "../config";
import { distanceMiles, withinRadius } from "../geo";
import type { ResyVenueHit } from "./types";
import { compactStrings, priceFromResy } from "./utils";

export function normalizeResyHit(hit: ResyVenueHit, city: CityConfig): Restaurant | null {
  const resyId = hit.id?.resy;
  const latitude = hit._geoloc?.lat;
  const longitude = hit._geoloc?.lng;
  if (!resyId || !hit.name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const point = { latitude: latitude as number, longitude: longitude as number };
  if (!withinRadius(point, city.center, city.radiusMiles)) return null;

  const citySlug = hit.location?.url_slug || "new-york-ny";
  const sourceUrl = hit.url_slug ? `https://resy.com/cities/${citySlug}/venues/${hit.url_slug}` : undefined;

  return {
    id: `resy:${resyId}`,
    source: "resy",
    sourceIds: { resy: resyId },
    name: hit.name,
    latitude: point.latitude,
    longitude: point.longitude,
    address: {
      city: hit.locality || hit.location?.name,
      state: hit.region,
      country: hit.country
    },
    neighborhood: hit.neighborhood,
    cuisines: compactStrings(hit.cuisine ?? []),
    tags: [],
    rating: hit.rating,
    price: priceFromResy(hit.price_range_id),
    imageUrl: hit.images?.[0],
    sourceUrls: {
      resy: sourceUrl
    },
    distanceMiles: Number(distanceMiles(point, city.center).toFixed(2))
  };
}
