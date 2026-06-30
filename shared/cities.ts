export const cityCodes = ["nyc", "la", "chi", "sf", "dc", "mia", "bos", "phl", "atl", "aus", "dal", "den", "sea", "lv"] as const;

export type CityCode = (typeof cityCodes)[number];

export interface CityCenter {
  latitude: number;
  longitude: number;
}

export interface CityConfig {
  code: CityCode;
  name: string;
  state: string;
  center: CityCenter;
  radiusMiles: number;
}

export const defaultCityCode: CityCode = "nyc";

export const supportedCities: CityConfig[] = [
  {
    code: "nyc",
    name: "New York City",
    state: "NY",
    center: { latitude: 40.7128, longitude: -74.006 },
    radiusMiles: 15
  },
  {
    code: "la",
    name: "Los Angeles",
    state: "CA",
    center: { latitude: 34.0522, longitude: -118.2437 },
    radiusMiles: 28
  },
  {
    code: "chi",
    name: "Chicago",
    state: "IL",
    center: { latitude: 41.8781, longitude: -87.6298 },
    radiusMiles: 16
  },
  {
    code: "sf",
    name: "San Francisco",
    state: "CA",
    center: { latitude: 37.7749, longitude: -122.4194 },
    radiusMiles: 14
  },
  {
    code: "dc",
    name: "Washington",
    state: "DC",
    center: { latitude: 38.9072, longitude: -77.0369 },
    radiusMiles: 15
  },
  {
    code: "mia",
    name: "Miami",
    state: "FL",
    center: { latitude: 25.7617, longitude: -80.1918 },
    radiusMiles: 18
  },
  {
    code: "bos",
    name: "Boston",
    state: "MA",
    center: { latitude: 42.3601, longitude: -71.0589 },
    radiusMiles: 14
  },
  {
    code: "phl",
    name: "Philadelphia",
    state: "PA",
    center: { latitude: 39.9526, longitude: -75.1652 },
    radiusMiles: 14
  },
  {
    code: "atl",
    name: "Atlanta",
    state: "GA",
    center: { latitude: 33.749, longitude: -84.388 },
    radiusMiles: 18
  },
  {
    code: "aus",
    name: "Austin",
    state: "TX",
    center: { latitude: 30.2672, longitude: -97.7431 },
    radiusMiles: 16
  },
  {
    code: "dal",
    name: "Dallas",
    state: "TX",
    center: { latitude: 32.7767, longitude: -96.797 },
    radiusMiles: 22
  },
  {
    code: "den",
    name: "Denver",
    state: "CO",
    center: { latitude: 39.7392, longitude: -104.9903 },
    radiusMiles: 18
  },
  {
    code: "sea",
    name: "Seattle",
    state: "WA",
    center: { latitude: 47.6062, longitude: -122.3321 },
    radiusMiles: 15
  },
  {
    code: "lv",
    name: "Las Vegas",
    state: "NV",
    center: { latitude: 36.1716, longitude: -115.1391 },
    radiusMiles: 16
  }
];

const cityCodeSet = new Set<string>(cityCodes);
const cityAliases: Record<string, CityCode> = {
  "new-york": "nyc",
  "new-york-city": "nyc",
  "los-angeles": "la",
  "chicago": "chi",
  "san-francisco": "sf",
  "washington": "dc",
  "washington-dc": "dc",
  "miami": "mia",
  "boston": "bos",
  "philadelphia": "phl",
  "atlanta": "atl",
  "austin": "aus",
  "dallas": "dal",
  "denver": "den",
  "seattle": "sea",
  "las-vegas": "lv",
  "vegas": "lv"
};

function cityKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeCityCode(value: string | null | undefined): CityCode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (cityCodeSet.has(normalized)) return normalized as CityCode;
  return cityAliases[cityKey(value)] ?? null;
}

export function getCity(code: CityCode): CityConfig {
  return supportedCities.find((city) => city.code === code) ?? supportedCities[0];
}
