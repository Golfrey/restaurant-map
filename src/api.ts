import type { CityCode } from "../shared/cities";
import type { RestaurantResponse } from "../shared/types";

interface FetchRestaurantsOptions {
  city: CityCode;
  signal?: AbortSignal;
}

export async function fetchRestaurants({ city, signal }: FetchRestaurantsOptions): Promise<RestaurantResponse> {
  const params = new URLSearchParams({ city });

  const response = await fetch(`/api/restaurants?${params.toString()}`, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<RestaurantResponse>;
}
