import type { Restaurant } from "../../shared/types";
import type { AppConfig } from "../config";
import {
  normalizeInKindLocation,
  type InKindBrand,
  type InKindLocation,
  type InKindTag
} from "../normalizers";
import { fetchJson, requireArray } from "./http";

interface InKindMapResponse {
  tags?: InKindTag[];
  locations?: InKindLocation[];
  brands?: InKindBrand[];
}

const inKindMapUrl = "https://app.inkind.com/api/v5/map";

export async function fetchInKindRestaurants(config: AppConfig): Promise<Restaurant[]> {
  const payload = await fetchJson<InKindMapResponse>(
    inKindMapUrl,
    {
      headers: {
        Accept: "application/json"
      }
    },
    {
      sourceName: "inKind",
      timeoutMs: config.upstreamTimeoutMs
    }
  );

  const tags = requireArray<InKindTag>(payload.tags, "inKind", "tags");
  const brands = requireArray<InKindBrand>(payload.brands, "inKind", "brands");
  const locations = requireArray<InKindLocation>(payload.locations, "inKind", "locations");
  const tagsById = new Map<number, InKindTag>();
  const brandsById = new Map<number, InKindBrand>();

  for (const tag of tags) {
    if (Number.isFinite(tag.id)) tagsById.set(tag.id as number, tag);
  }

  for (const brand of brands) {
    if (Number.isFinite(brand.brand_id)) brandsById.set(brand.brand_id as number, brand);
  }

  return locations
    .map((location) => normalizeInKindLocation(location, brandsById.get(location.brand_id ?? -1), tagsById, config.city))
    .filter((restaurant): restaurant is Restaurant => Boolean(restaurant));
}
