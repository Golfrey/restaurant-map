import type { Restaurant, RestaurantSource } from "../shared/types";
import { restaurantLabels } from "../shared/labels";

export type SourceFilter = RestaurantSource | "all";
export type ExternalSourceDomain = "resy.com" | "inkind.com";
export const priceOptions = ["$", "$$", "$$$", "$$$$"] as const;
export type PriceFilter = (typeof priceOptions)[number];
export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export const nearbyRadiusMiles = 10;

export { restaurantLabels };

export function restaurantMatchesSource(restaurant: Restaurant, source: SourceFilter): boolean {
  if (source === "all") return true;
  if (source === "resy") return restaurant.source === "resy" || restaurant.source === "both";
  if (source === "inkind") return restaurant.source === "inkind" || restaurant.source === "both";
  return restaurant.source === source;
}

export function filterRestaurants(
  restaurants: Restaurant[],
  query: string,
  source: SourceFilter,
  tags: string[],
  prices: PriceFilter[] = []
): Restaurant[] {
  const normalizedQuery = query.trim().toLowerCase();
  const selectedTags = new Set(tags);
  const selectedPrices = new Set(prices);

  return restaurants.filter((restaurant) => {
    if (!restaurantMatchesSource(restaurant, source)) return false;
    if (selectedPrices.size && (!restaurant.price || !selectedPrices.has(restaurant.price as PriceFilter)))
      return false;
    if (selectedTags.size) {
      const available = new Set(restaurantLabels(restaurant));
      for (const tag of selectedTags) {
        if (!available.has(tag)) return false;
      }
    }
    if (!normalizedQuery) return true;
    const haystack = [
      restaurant.name,
      restaurant.neighborhood,
      restaurant.address?.city,
      restaurant.address?.state,
      ...restaurantLabels(restaurant)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function filterRestaurantsByBounds(restaurants: Restaurant[], bounds: MapBounds | undefined): Restaurant[] {
  if (!bounds) return restaurants;

  return restaurants.filter((restaurant) => {
    const inLatitude = restaurant.latitude >= bounds.south && restaurant.latitude <= bounds.north;
    const inLongitude =
      bounds.east >= bounds.west
        ? restaurant.longitude >= bounds.west && restaurant.longitude <= bounds.east
        : restaurant.longitude >= bounds.west || restaurant.longitude <= bounds.east;

    return inLatitude && inLongitude;
  });
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMilesBetween(from: GeoCoordinates, to: GeoCoordinates): number {
  const earthRadiusMiles = 3958.7613;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const halfChord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord));
}

export function restaurantsWithinRadius(
  restaurants: Restaurant[],
  center: GeoCoordinates,
  radiusMiles = nearbyRadiusMiles
): Restaurant[] {
  return restaurants
    .map((restaurant) => ({
      ...restaurant,
      distanceMiles: distanceMilesBetween(center, {
        latitude: restaurant.latitude,
        longitude: restaurant.longitude
      })
    }))
    .filter((restaurant) => restaurant.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name));
}

export function topTags(restaurants: Restaurant[], limit = 18): string[] {
  const counts = new Map<string, number>();
  for (const restaurant of restaurants) {
    for (const tag of restaurantLabels(restaurant)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function sourceLabel(source: Restaurant["source"]): string {
  if (source === "both") return "Resy + inKind";
  return source === "resy" ? "Resy" : "inKind";
}

export function formatAddress(restaurant: Restaurant): string {
  const address = restaurant.address;
  if (!address) return restaurant.neighborhood ?? "Restaurant location";
  return [address.street, address.city, address.state, address.postalCode].filter(Boolean).join(", ");
}

export function detailLine(restaurant: Restaurant): string {
  return [restaurant.neighborhood, restaurant.cuisines[0], restaurant.price].filter(Boolean).join(" / ");
}

export function safeExternalUrl(value: string | undefined, allowedDomain: ExternalSourceDomain): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return undefined;
    if (hostname !== allowedDomain && !hostname.endsWith(`.${allowedDomain}`)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
