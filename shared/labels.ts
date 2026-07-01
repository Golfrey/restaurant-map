import type { Restaurant } from "./types.js";

export function labelKey(value: string): string {
  return value.trim().toLowerCase();
}

export function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const value of values) {
    const label = value.trim();
    const key = labelKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }

  return labels;
}

export function restaurantLabels(restaurant: Pick<Restaurant, "cuisines" | "tags">): string[] {
  return uniqueLabels([...restaurant.cuisines, ...restaurant.tags]);
}

export function sanitizeRestaurantLabels(restaurant: Restaurant): Restaurant {
  const cuisines = uniqueLabels(restaurant.cuisines);
  const cuisineKeys = new Set(cuisines.map(labelKey));
  const tags = uniqueLabels(restaurant.tags).filter((tag) => !cuisineKeys.has(labelKey(tag)));

  return {
    ...restaurant,
    cuisines,
    tags
  };
}
