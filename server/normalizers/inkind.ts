import type { Restaurant } from "../../shared/types";
import type { CityConfig } from "../config";
import { distanceMiles, withinRadius } from "../geo";
import type { InKindBrand, InKindLocation, InKindTag } from "./types";
import { cloudinaryUrl, compactStrings, priceFromInKind } from "./utils";

function isCuisineTag(tag: InKindTag): boolean {
  return tag.category?.toLowerCase() === "cuisine type";
}

export function normalizeInKindLocation(
  location: InKindLocation,
  brand: InKindBrand | undefined,
  tagsById: Map<number, InKindTag>,
  city: CityConfig
): Restaurant | null {
  const latitude = location.location?.latitude;
  const longitude = location.location?.longitude;
  const locationId = location.location_id;
  const brandId = location.brand_id ?? brand?.brand_id;
  const name = location.name || brand?.name;

  if (!locationId || !brandId || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (brand?.branding?.discoverable === false) return null;
  if (location.status && location.status.toLowerCase() === "closed") return null;

  const point = { latitude: latitude as number, longitude: longitude as number };
  if (!withinRadius(point, city.center, city.radiusMiles)) return null;

  const rawTagIds = [...(brand?.tags ?? []), ...(location.tags ?? [])]
    .map((tag) => tag.id)
    .filter((id): id is number => Number.isFinite(id));
  const rawTags = rawTagIds.map((id) => tagsById.get(id)).filter((tag): tag is InKindTag => Boolean(tag));
  const cuisineTags = compactStrings(rawTags.filter((tag) => isCuisineTag(tag)).map((tag) => tag.name));
  const tagNames = compactStrings(rawTags.filter((tag) => !isCuisineTag(tag)).map((tag) => tag.name));

  return {
    id: `inkind:${locationId}`,
    source: "inkind",
    sourceIds: {
      inkindLocationId: locationId,
      inkindBrandId: brandId
    },
    name,
    latitude: point.latitude,
    longitude: point.longitude,
    address: {
      street: location.location?.address,
      city: location.location?.city,
      state: location.location?.state,
      postalCode: location.location?.zip_code,
      country: location.location?.country
    },
    cuisines: cuisineTags,
    tags: tagNames,
    rating: {
      average: location.rating,
      count: location.review_count
    },
    price: priceFromInKind(brand?.check_average),
    imageUrl: cloudinaryUrl(brand?.branding?.hero_image?.value),
    sourceUrls: {
      inkind: location.purchase_page_link
    },
    distanceMiles: Number(distanceMiles(point, city.center).toFixed(2))
  };
}
