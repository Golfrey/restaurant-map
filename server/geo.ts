const earthRadiusMiles = 3958.8;

export interface Point {
  latitude: number;
  longitude: number;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMiles(a: Point, b: Point): number {
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

export function withinRadius(point: Point, center: Point, radiusMiles: number): boolean {
  return distanceMiles(point, center) <= radiusMiles;
}
