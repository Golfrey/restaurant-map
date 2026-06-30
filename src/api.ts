import type { RestaurantResponse } from "../shared/types";

export async function fetchRestaurants(refresh = false, signal?: AbortSignal): Promise<RestaurantResponse> {
  const params = new URLSearchParams({ city: "nyc" });
  if (refresh) params.set("refresh", "true");

  const response = await fetch(`/api/restaurants?${params.toString()}`, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<RestaurantResponse>;
}
