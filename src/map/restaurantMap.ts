import maplibregl, { type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { Restaurant } from "../../shared/types";
import { sourceLabel } from "../appUtils";

export type MapTone = "lite" | "dark";

export const sourceId = "restaurants";
export const clusterLayerId = "restaurant-clusters";
export const clusterCountLayerId = "restaurant-cluster-count";
export const markerLayerId = "restaurant-markers";
export const selectedLayerId = "restaurant-selected-marker";

const stadiaStyles: Record<MapTone, string> = {
  lite: "https://tiles.stadiamaps.com/styles/stamen_toner_lite.json",
  dark: "https://tiles.stadiamaps.com/styles/stamen_toner_dark.json"
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return replacements[char];
  });
}

function sourceColor(source: Restaurant["source"]): string {
  if (source === "both") return "#2d4d8f";
  return source === "resy" ? "#cf3f2f" : "#1f4d46";
}

function restaurantDetail(restaurant: Restaurant): string {
  return [restaurant.neighborhood, restaurant.cuisines.slice(0, 2).join(", "), restaurant.price].filter(Boolean).join(" · ");
}

export function mapStyleUrl(tone: MapTone): string {
  const envStyle = import.meta.env.VITE_STADIA_MAP_STYLE;
  const baseUrl = envStyle && !envStyle.includes("{tone}") ? envStyle : envStyle?.replace("{tone}", tone) || stadiaStyles[tone];
  const apiKey = import.meta.env.VITE_STADIA_MAPS_API_KEY;
  if (!apiKey) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}api_key=${encodeURIComponent(apiKey)}`;
}

export function featureCollection(restaurants: Restaurant[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: restaurants.map((restaurant) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [restaurant.longitude, restaurant.latitude]
      },
      properties: {
        id: restaurant.id,
        name: restaurant.name,
        source: restaurant.source,
        color: sourceColor(restaurant.source),
        label: sourceLabel(restaurant.source),
        detail: restaurantDetail(restaurant)
      }
    }))
  };
}

function featureId(feature: MapGeoJSONFeature): string | undefined {
  const value = feature.properties?.id;
  return typeof value === "string" ? value : undefined;
}

export function featureCoordinates(feature: MapGeoJSONFeature): [number, number] | undefined {
  if (feature.geometry.type !== "Point") return undefined;
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return undefined;
  return [Number(coordinates[0]), Number(coordinates[1])];
}

export function addRestaurantLayers(map: maplibregl.Map) {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "geojson",
      data: featureCollection([]),
      cluster: true,
      clusterRadius: 54,
      clusterMaxZoom: 14
    });
  }

  if (!map.getLayer(clusterLayerId)) {
    map.addLayer({
      id: clusterLayerId,
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#d9ecd2", 20, "#f0d873", 100, "#ed9b55", 500, "#d55b47"],
        "circle-radius": ["step", ["get", "point_count"], 18, 20, 24, 100, 32, 500, 42],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.96
      }
    });
  }

  if (!map.getLayer(clusterCountLayerId)) {
    map.addLayer({
      id: clusterCountLayerId,
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 13,
        "text-allow-overlap": true
      },
      paint: {
        "text-color": "#141414",
        "text-halo-color": "rgba(255, 255, 255, 0.7)",
        "text-halo-width": 1
      }
    });
  }

  if (!map.getLayer(markerLayerId)) {
    map.addLayer({
      id: markerLayerId,
      type: "circle",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["case", ["==", ["get", "source"], "both"], 8, 7],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.94
      }
    });
  }

  if (!map.getLayer(selectedLayerId)) {
    map.addLayer({
      id: selectedLayerId,
      type: "circle",
      source: sourceId,
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-color": "rgba(255, 255, 255, 0)",
        "circle-radius": 14,
        "circle-stroke-color": "#f2c14e",
        "circle-stroke-width": 4
      }
    });
  }
}

export function getRestaurantByFeature(restaurants: Restaurant[], feature: MapGeoJSONFeature): Restaurant | undefined {
  const id = featureId(feature);
  return id ? restaurants.find((restaurant) => restaurant.id === id) : undefined;
}

export function mapPadding(map: maplibregl.Map): maplibregl.PaddingOptions {
  const width = map.getContainer().clientWidth;
  const height = map.getContainer().clientHeight;
  const base = width < 640 || height < 520 ? 28 : 42;
  const right = width >= 820 ? Math.min(420, Math.floor(width * 0.38)) : base;
  const bottom = height >= 620 ? 120 : base;
  return { top: base, right, bottom, left: base };
}

export function restaurantPopupHtml(restaurant: Restaurant): string {
  const detail = restaurantDetail(restaurant);
  return `<div class="map-popup"><strong>${escapeHtml(restaurant.name)}</strong><span>${escapeHtml(sourceLabel(restaurant.source))}${
    detail ? ` · ${escapeHtml(detail)}` : ""
  }</span></div>`;
}
