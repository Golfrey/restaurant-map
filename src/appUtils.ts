import type { Restaurant, RestaurantSource } from "../shared/types";

export type SourceFilter = RestaurantSource | "all";
export type ExternalSourceDomain = "resy.com" | "inkind.com";

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
  tags: string[]
): Restaurant[] {
  const normalizedQuery = query.trim().toLowerCase();
  const selectedTags = new Set(tags);

  return restaurants.filter((restaurant) => {
    if (!restaurantMatchesSource(restaurant, source)) return false;
    if (selectedTags.size) {
      const available = new Set([...restaurant.cuisines, ...restaurant.tags]);
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
      ...restaurant.cuisines,
      ...restaurant.tags
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function topTags(restaurants: Restaurant[], limit = 18): string[] {
  const counts = new Map<string, number>();
  for (const restaurant of restaurants) {
    for (const tag of [...restaurant.cuisines, ...restaurant.tags]) {
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
  if (!address) return restaurant.neighborhood ?? "New York City";
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
