import type { CityCode } from "./cities";

export type RestaurantSource = "resy" | "inkind" | "both";

export interface RestaurantAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface RestaurantRating {
  average?: number;
  count?: number;
}

export interface Restaurant {
  id: string;
  source: RestaurantSource;
  sourceIds: {
    resy?: number;
    inkindLocationId?: number;
    inkindBrandId?: number;
  };
  name: string;
  latitude: number;
  longitude: number;
  address?: RestaurantAddress;
  neighborhood?: string;
  cuisines: string[];
  tags: string[];
  rating?: RestaurantRating;
  price?: string;
  imageUrl?: string;
  sourceUrls: {
    resy?: string;
    inkind?: string;
  };
  distanceMiles?: number;
}

export interface RestaurantResponse {
  city: CityCode;
  generatedAt: string;
  cacheTtlHours: number;
  restaurants: Restaurant[];
  sourceCounts: {
    resy: number;
    inkind: number;
    both: number;
    total: number;
  };
  warnings?: string[];
  cached?: boolean;
}
