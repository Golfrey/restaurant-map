import type { CityCode } from "../shared/cities";
import type { RestaurantResponse } from "../shared/types";

interface FetchRestaurantsOptions {
  city: CityCode;
  refresh?: boolean;
  signal?: AbortSignal;
}

export async function fetchRestaurants({ city, refresh = false, signal }: FetchRestaurantsOptions): Promise<RestaurantResponse> {
  const params = new URLSearchParams({ city });
  if (refresh) params.set("refresh", "true");

  const response = await fetch(`/api/restaurants?${params.toString()}`, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<RestaurantResponse>;
}
