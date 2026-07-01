import type { Restaurant } from "../shared/types";
import { distanceMiles } from "./geo";

const weakWords = new Set(["the", "restaurant", "bar", "cafe", "nyc", "new", "york"]);

export function comparableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !weakWords.has(part))
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i += 1) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      current[j + 1] = Math.min(current[j] + 1, previous[j + 1] + 1, previous[j] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

export function nameSimilarity(a: string, b: string): number {
  const left = comparableName(a);
  const right = comparableName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length);
  return (maxLength - levenshtein(left, right)) / maxLength;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function mergeRating(a?: Restaurant["rating"], b?: Restaurant["rating"]): Restaurant["rating"] | undefined {
  if (!a?.average) return b;
  if (!b?.average) return a;
  const aCount = a.count ?? 0;
  const bCount = b.count ?? 0;
  if (aCount + bCount === 0) return a;
  return {
    average: Number(((a.average * aCount + b.average * bCount) / (aCount + bCount)).toFixed(2)),
    count: aCount + bCount
  };
}

function mergeRestaurants(resy: Restaurant, inkind: Restaurant): Restaurant {
  return {
    ...resy,
    id: `both:resy:${resy.sourceIds.resy}:inkind:${inkind.sourceIds.inkindLocationId}`,
    source: "both",
    sourceIds: {
      ...resy.sourceIds,
      ...inkind.sourceIds
    },
    address: resy.address?.street ? resy.address : (inkind.address ?? resy.address),
    cuisines: unique([...resy.cuisines, ...inkind.cuisines]),
    tags: unique([...resy.tags, ...inkind.tags]),
    rating: mergeRating(resy.rating, inkind.rating),
    price: resy.price ?? inkind.price,
    imageUrl: resy.imageUrl ?? inkind.imageUrl,
    sourceUrls: {
      ...resy.sourceUrls,
      ...inkind.sourceUrls
    },
    distanceMiles: Math.min(resy.distanceMiles ?? Infinity, inkind.distanceMiles ?? Infinity)
  };
}

export function dedupeRestaurants(resyRestaurants: Restaurant[], inKindRestaurants: Restaurant[]): Restaurant[] {
  const consumedInKindIds = new Set<string>();
  const merged: Restaurant[] = [];

  for (const resy of resyRestaurants) {
    let best: { restaurant: Restaurant; score: number } | null = null;

    for (const inkind of inKindRestaurants) {
      if (consumedInKindIds.has(inkind.id)) continue;
      const miles = distanceMiles(resy, inkind);
      if (miles > 0.08) continue;
      const similarity = nameSimilarity(resy.name, inkind.name);
      if (similarity < 0.88) continue;
      if (!best || similarity > best.score) {
        best = { restaurant: inkind, score: similarity };
      }
    }

    if (best) {
      consumedInKindIds.add(best.restaurant.id);
      merged.push(mergeRestaurants(resy, best.restaurant));
    } else {
      merged.push(resy);
    }
  }

  for (const inkind of inKindRestaurants) {
    if (!consumedInKindIds.has(inkind.id)) merged.push(inkind);
  }

  return merged.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
}
