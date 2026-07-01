import { layers, namedFlavor } from "@protomaps/basemaps";
import maplibregl, { type MapGeoJSONFeature } from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Point } from "geojson";
import type { Restaurant } from "../../shared/types";
import { sourceLabel } from "../appUtils";
import { transitStations } from "./transitStations.generated";

export type MapTone = "lite" | "dark";
export type ProtomapsFlavor = "light" | "dark" | "white" | "grayscale" | "black";

export const sourceId = "restaurants";
export const clusterLayerId = "restaurant-clusters";
export const clusterCountLayerId = "restaurant-cluster-count";
export const markerLayerId = "restaurant-markers";
export const selectedLayerId = "restaurant-selected-marker";
export const transitStationIconLayerId = "transit-station-icons";
export const transitStationLabelLayerId = "transit-station-labels";
export const transitStationDetailsSourceId = "transit-station-details";
export const transitStationDetailsIconLayerId = "transit-station-details-icons";
export const transitStationDetailsPathBadgeLayerId = "transit-station-details-path-badges";
export const transitStationDetailsPathBadgeTextLayerId = "transit-station-details-path-badge-text";
export const transitStationDetailsLabelLayerId = "transit-station-details-labels";

const protomapsSourceId = "protomaps";
const defaultFlavorByTone: Record<MapTone, ProtomapsFlavor> = {
  lite: "grayscale",
  dark: "black"
};
const defaultProtomapsUrl = "/maps/protomaps.pmtiles";
const defaultProtomapsLanguage = "en";
const protomapsGlyphsUrl = "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";
const protomapsSpriteBaseUrl = "https://protomaps.github.io/basemaps-assets/sprites/v4";
const transitStationIconImageId = "restaurant-map-transit-station";
const transitStationIconSize = 28;
const detailedTransitCoverage: MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [-74.35, 40.45],
        [-73.65, 40.45],
        [-73.65, 41.0],
        [-74.35, 41.0],
        [-74.35, 40.45]
      ]
    ],
    [
      [
        [-77.6, 38.65],
        [-76.75, 38.65],
        [-76.75, 39.2],
        [-77.6, 39.2],
        [-77.6, 38.65]
      ]
    ]
  ]
};

function pmtilesStyleUrl(url: string): string {
  if (url.startsWith("pmtiles://")) return url;
  return `pmtiles://${url}`;
}

function protomapsFlavor(tone: MapTone): ProtomapsFlavor {
  const envFlavor = import.meta.env.VITE_PROTOMAPS_FLAVOR;
  const flavor = envFlavor || defaultFlavorByTone[tone];
  if (["light", "dark", "white", "grayscale", "black"].includes(flavor)) {
    return flavor as ProtomapsFlavor;
  }
  return defaultFlavorByTone[tone];
}

function protomapsSpriteUrl(flavor: ProtomapsFlavor): string {
  return `${protomapsSpriteBaseUrl}/${flavor === "dark" || flavor === "black" ? "dark" : "light"}`;
}

function appendApiKey(url: string, apiKey: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

function hostedProtomapsStyleUrl(flavor: ProtomapsFlavor): string | undefined {
  const apiKey = import.meta.env.VITE_PROTOMAPS_API_KEY;
  if (!apiKey) return undefined;

  const customStyleUrl = import.meta.env.VITE_PROTOMAPS_STYLE_URL;
  if (customStyleUrl) return appendApiKey(customStyleUrl, apiKey);

  const language = import.meta.env.VITE_PROTOMAPS_LANGUAGE || defaultProtomapsLanguage;
  return appendApiKey(`https://api.protomaps.com/styles/v5/${flavor}/${language}.json`, apiKey);
}

function styleSourceUrl(source: maplibregl.SourceSpecification): string {
  const url = "url" in source && typeof source.url === "string" ? source.url : "";
  const tiles = "tiles" in source && Array.isArray(source.tiles) ? source.tiles.join(" ") : "";
  return `${url} ${tiles}`.toLowerCase();
}

function protomapsMapSourceId(map: maplibregl.Map): string | undefined {
  if (map.getSource(protomapsSourceId)) return protomapsSourceId;

  const sources = map.getStyle().sources ?? {};
  const vectorSources = Object.entries(sources).filter(([, source]) => source.type === "vector");
  const protomapsSource = vectorSources.find(([id, source]) => {
    const sourceUrl = styleSourceUrl(source);
    return (
      id.toLowerCase().includes("protomaps") ||
      sourceUrl.includes("protomaps") ||
      sourceUrl.includes("pmtiles://") ||
      sourceUrl.includes("/maps/")
    );
  });

  return protomapsSource?.[0] ?? vectorSources[0]?.[0];
}

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
  return [restaurant.neighborhood, restaurant.cuisines.slice(0, 2).join(", "), restaurant.price]
    .filter(Boolean)
    .join(" · ");
}

function lineBadgesHtml(lineColors: string, lineNames: string): string {
  const names = lineNames.split("|");
  return lineColors
    .split("|")
    .map((line, index) => {
      const [label, color = "#1377c8", textColor = "#ffffff"] = line.split(":");
      if (!label) return "";
      const title = names[index] ? ` title="${escapeHtml(names[index])}"` : "";
      return `<span class="transit-line-badge" style="background:${escapeHtml(color)};color:${escapeHtml(textColor)}"${title}>${escapeHtml(label)}</span>`;
    })
    .join("");
}

function featureProperty(feature: MapGeoJSONFeature, key: string): string {
  const value = feature.properties?.[key];
  return typeof value === "string" ? value : "";
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function createTransitStationIcon(): { image: ImageData; pixelRatio: number } | null {
  const pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = transitStationIconSize * pixelRatio;
  canvas.height = transitStationIconSize * pixelRatio;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, transitStationIconSize, transitStationIconSize);

  context.fillStyle = "rgba(7, 17, 28, 0.94)";
  context.beginPath();
  context.arc(14, 14, 12, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.lineWidth = 1.75;
  context.stroke();

  context.fillStyle = "#dff4ff";
  drawRoundedRect(context, 7.5, 5.5, 13, 14.5, 3);
  context.fill();

  context.fillStyle = "#12324c";
  drawRoundedRect(context, 9.5, 8, 9, 4.5, 1.2);
  context.fill();

  context.fillStyle = "#12324c";
  context.beginPath();
  context.arc(11, 16.3, 1.25, 0, Math.PI * 2);
  context.arc(17, 16.3, 1.25, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#dff4ff";
  context.lineWidth = 1.6;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(10.5, 22.5);
  context.lineTo(13, 19.5);
  context.moveTo(17.5, 22.5);
  context.lineTo(15, 19.5);
  context.stroke();

  return {
    image: context.getImageData(0, 0, canvas.width, canvas.height),
    pixelRatio
  };
}

function ensureTransitStationIcon(map: maplibregl.Map) {
  if (map.hasImage(transitStationIconImageId)) return;

  const icon = createTransitStationIcon();
  if (icon) {
    map.addImage(transitStationIconImageId, icon.image, { pixelRatio: icon.pixelRatio });
  }
}

export function mapStyle(tone: MapTone): string | maplibregl.StyleSpecification {
  const flavorName = protomapsFlavor(tone);
  const hostedStyleUrl = hostedProtomapsStyleUrl(flavorName);
  if (hostedStyleUrl) return hostedStyleUrl;

  const tilesUrl = import.meta.env.VITE_PROTOMAPS_PMTILES_URL || defaultProtomapsUrl;

  return {
    version: 8,
    glyphs: protomapsGlyphsUrl,
    sprite: protomapsSpriteUrl(flavorName),
    sources: {
      [protomapsSourceId]: {
        type: "vector",
        url: pmtilesStyleUrl(tilesUrl),
        attribution:
          '<a href="https://protomaps.com/" target="_blank" rel="noopener noreferrer">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
      }
    },
    layers: layers(protomapsSourceId, namedFlavor(flavorName), { lang: "en" })
  };
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

export function addTransitStationLayers(map: maplibregl.Map) {
  const mapSourceId = protomapsMapSourceId(map);

  const beforeRestaurantLayers = map.getLayer(clusterLayerId) ? clusterLayerId : undefined;
  ensureTransitStationIcon(map);
  if (!map.getSource(transitStationDetailsSourceId)) {
    map.addSource(transitStationDetailsSourceId, {
      type: "geojson",
      data: transitStations
    });
  }

  const stationIconFilter: maplibregl.FilterSpecification = [
    "all",
    ["==", ["get", "kind"], "station"],
    ["has", "name"],
    ["!", ["within", detailedTransitCoverage]],
    ["<=", ["coalesce", ["get", "min_zoom"], 14], ["+", ["zoom"], 1]]
  ];
  const stationLabelFilter: maplibregl.FilterSpecification = [
    "all",
    ["==", ["get", "kind"], "station"],
    ["has", "name"],
    ["!", ["within", detailedTransitCoverage]],
    ["<=", ["coalesce", ["get", "min_zoom"], 14], ["zoom"]]
  ];
  const pathStationFilter: maplibregl.FilterSpecification = ["==", ["get", "system"], "PATH"];
  const detailedStationIconFilter: maplibregl.FilterSpecification = [
    "all",
    ["!=", ["get", "system"], "PATH"],
    ["any", ["==", ["get", "system"], "DC Metro"], [">=", ["zoom"], 11]]
  ];
  const detailedStationLabelFilter: maplibregl.FilterSpecification = [
    "any",
    ["==", ["get", "system"], "DC Metro"],
    [">=", ["zoom"], 13]
  ];

  if (mapSourceId && !map.getLayer(transitStationIconLayerId)) {
    map.addLayer(
      {
        id: transitStationIconLayerId,
        type: "symbol",
        source: mapSourceId,
        "source-layer": "pois",
        minzoom: 11,
        filter: stationIconFilter,
        layout: {
          "icon-image": transitStationIconImageId,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 1.05, 14, 1.25, 16, 1.45],
          "icon-allow-overlap": true,
          "icon-ignore-placement": false,
          "icon-padding": 2
        },
        paint: {
          "icon-opacity": 0.82
        }
      },
      beforeRestaurantLayers
    );
  }

  if (mapSourceId && !map.getLayer(transitStationLabelLayerId)) {
    map.addLayer(
      {
        id: transitStationLabelLayerId,
        type: "symbol",
        source: mapSourceId,
        "source-layer": "pois",
        minzoom: 12,
        filter: stationLabelFilter,
        layout: {
          "symbol-sort-key": ["coalesce", ["get", "min_zoom"], 14],
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 15, 12, 17, 13.5],
          "text-anchor": "top",
          "text-offset": [0, 1.2],
          "text-max-width": 8,
          "text-optional": true
        },
        paint: {
          "text-color": "#d8f2ff",
          "text-halo-color": "rgba(6, 12, 20, 0.92)",
          "text-halo-width": 1.25
        }
      },
      beforeRestaurantLayers
    );
  }

  if (!map.getLayer(transitStationDetailsIconLayerId)) {
    map.addLayer(
      {
        id: transitStationDetailsIconLayerId,
        type: "symbol",
        source: transitStationDetailsSourceId,
        minzoom: 9.5,
        filter: detailedStationIconFilter,
        layout: {
          "icon-image": transitStationIconImageId,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9.5, 1, 11, 1.15, 14, 1.4, 16, 1.6],
          "icon-allow-overlap": true,
          "icon-ignore-placement": false,
          "icon-padding": 2
        }
      },
      beforeRestaurantLayers
    );
  }

  if (!map.getLayer(transitStationDetailsPathBadgeLayerId)) {
    map.addLayer(
      {
        id: transitStationDetailsPathBadgeLayerId,
        type: "circle",
        source: transitStationDetailsSourceId,
        minzoom: 11,
        filter: pathStationFilter,
        paint: {
          "circle-color": "#0072bc",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 8, 13, 10, 16, 12],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 1.5, 15, 2.25],
          "circle-opacity": 0.96
        }
      },
      beforeRestaurantLayers
    );
  }

  if (!map.getLayer(transitStationDetailsPathBadgeTextLayerId)) {
    map.addLayer(
      {
        id: transitStationDetailsPathBadgeTextLayerId,
        type: "symbol",
        source: transitStationDetailsSourceId,
        minzoom: 11,
        filter: pathStationFilter,
        layout: {
          "text-field": ["step", ["zoom"], "P", 13, "PATH"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 13, 8.5, 16, 10],
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0, 54, 96, 0.85)",
          "text-halo-width": 0.75
        }
      },
      beforeRestaurantLayers
    );
  }

  if (!map.getLayer(transitStationDetailsLabelLayerId)) {
    map.addLayer(
      {
        id: transitStationDetailsLabelLayerId,
        type: "symbol",
        source: transitStationDetailsSourceId,
        minzoom: 11.5,
        filter: detailedStationLabelFilter,
        layout: {
          "symbol-sort-key": ["case", ["==", ["get", "system"], "PATH"], 0, 1],
          "text-field": ["concat", ["get", "name"], "\n", ["get", "lineSummary"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 9.5, 15, 11.5, 17, 12.5],
          "text-anchor": "top",
          "text-offset": [0, 1.2],
          "text-max-width": 9,
          "text-optional": true
        },
        paint: {
          "text-color": ["match", ["get", "system"], "PATH", "#9fd7ff", "#d8f2ff"],
          "text-halo-color": "rgba(6, 12, 20, 0.94)",
          "text-halo-width": 1.25
        }
      },
      beforeRestaurantLayers
    );
  }
}

export function getRestaurantByFeature(restaurants: Restaurant[], feature: MapGeoJSONFeature): Restaurant | undefined {
  const id = featureId(feature);
  return id ? restaurants.find((restaurant) => restaurant.id === id) : undefined;
}

export function mapPadding(map: maplibregl.Map, mobileBottomInset = 0): maplibregl.PaddingOptions {
  const width = map.getContainer().clientWidth;
  const height = map.getContainer().clientHeight;
  const base = width < 640 || height < 520 ? 28 : 42;
  const right = width >= 820 ? Math.min(420, Math.floor(width * 0.38)) : base;
  const bottom =
    width < 768 && mobileBottomInset
      ? Math.min(Math.floor(height * 0.62), Math.max(base, mobileBottomInset))
      : height >= 620
        ? 120
        : base;
  return { top: base, right, bottom, left: base };
}

export function restaurantPopupHtml(restaurant: Restaurant): string {
  const detail = restaurantDetail(restaurant);
  return `<div class="map-popup"><strong>${escapeHtml(restaurant.name)}</strong><span>${escapeHtml(sourceLabel(restaurant.source))}${
    detail ? ` · ${escapeHtml(detail)}` : ""
  }</span></div>`;
}

export function transitStationPopupHtml(feature: MapGeoJSONFeature): string {
  const name = featureProperty(feature, "name") || featureProperty(feature, "name:en") || "Transit station";
  const system = featureProperty(feature, "system") || "Transit station";
  const lineColors = featureProperty(feature, "lineColors");
  const lineNames = featureProperty(feature, "lineNames");
  const linesHtml = lineColors ? `<div class="transit-line-list">${lineBadgesHtml(lineColors, lineNames)}</div>` : "";
  return `<div class="map-popup transit-popup"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(system)}</span>${linesHtml}</div>`;
}
