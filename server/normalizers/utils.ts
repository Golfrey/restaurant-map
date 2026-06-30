export function compactStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

export function priceFromResy(priceRangeId?: number): string | undefined {
  if (!priceRangeId || priceRangeId < 1) return undefined;
  return "$".repeat(Math.min(priceRangeId, 4));
}

export function priceFromInKind(checkAverage?: string): string | undefined {
  const normalized = checkAverage?.toLowerCase();
  if (normalized === "low") return "$";
  if (normalized === "medium") return "$$";
  if (normalized === "high") return "$$$";
  if (normalized === "very_high") return "$$$$";
  return undefined;
}

export function cloudinaryUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `https://res-5.cloudinary.com/equityeats/image/upload/c_fill,w_640,h_360/${path}`;
}
