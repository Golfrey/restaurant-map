import { memo, useEffect, useMemo, useRef } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { CityCenter } from "../shared/cities";
import type { Restaurant } from "../shared/types";
import type { MapBounds } from "./appUtils";
import {
  addRestaurantLayers,
  clusterLayerId,
  featureCollection,
  featureCoordinates,
  getRestaurantByFeature,
  mapPadding,
  mapStyleUrl,
  markerLayerId,
  restaurantPopupHtml,
  selectedLayerId,
  sourceId
} from "./map/restaurantMap";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapViewProps {
  restaurants: Restaurant[];
  selectedId?: string;
  focusRequest?: {
    id: string;
    nonce: number;
  };
  cityCenter: CityCenter;
  onSelect: (restaurant: Restaurant) => void;
  onViewportChange?: (bounds: MapBounds) => void;
  fitBoundsKey?: string;
}

const restaurantFocusZoom = 16;

function currentMapBounds(map: maplibregl.Map): MapBounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth()
  };
}

function runWithRestaurantLayers(map: maplibregl.Map, callback: () => void) {
  const run = () => {
    addRestaurantLayers(map);
    callback();
  };

  if (map.getSource(sourceId)) {
    run();
    return () => undefined;
  }

  let active = true;
  const cleanup = () => {
    active = false;
    map.off("load", onMapReady);
    map.off("style.load", onMapReady);
  };
  const onMapReady = () => {
    if (!active) return;
    cleanup();
    run();
  };

  map.on("load", onMapReady);
  map.on("style.load", onMapReady);

  return cleanup;
}

function MapViewComponent({
  restaurants,
  selectedId,
  focusRequest,
  cityCenter,
  onSelect,
  onViewportChange,
  fitBoundsKey
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupRestaurantIdRef = useRef<string | null>(null);
  const fittedBoundsKeyRef = useRef<string | undefined>(undefined);
  const restaurantsRef = useRef(restaurants);
  const dataRef = useRef<FeatureCollection<Point>>(featureCollection([]));
  const onSelectRef = useRef(onSelect);
  const onViewportChangeRef = useRef(onViewportChange);
  const selectedIdRef = useRef(selectedId);
  const cityCenterRef = useRef(cityCenter);
  const data = useMemo(() => featureCollection(restaurants), [restaurants]);

  restaurantsRef.current = restaurants;
  dataRef.current = data;
  onSelectRef.current = onSelect;
  onViewportChangeRef.current = onViewportChange;
  selectedIdRef.current = selectedId;
  cityCenterRef.current = cityCenter;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl("dark"),
      center: [cityCenterRef.current.longitude, cityCenterRef.current.latitude],
      zoom: 11,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    function openRestaurantPopup(restaurant: Restaurant, coordinates: [number, number]) {
      popupRef.current?.remove();
      popupRestaurantIdRef.current = restaurant.id;
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 14 })
        .setLngLat(coordinates)
        .setHTML(restaurantPopupHtml(restaurant))
        .addTo(map);
    }

    function emitViewport() {
      onViewportChangeRef.current?.(currentMapBounds(map));
    }

    map.on("load", () => {
      addRestaurantLayers(map);
      (map.getSource(sourceId) as GeoJSONSource).setData(dataRef.current);
      map.setFilter(selectedLayerId, ["==", ["get", "id"], selectedIdRef.current ?? ""]);
      emitViewport();
    });

    map.on("moveend", emitViewport);

    map.on("click", clusterLayerId, (event) => {
      const feature = event.features?.[0];
      const coordinates = feature ? featureCoordinates(feature) : undefined;
      const clusterId = feature?.properties?.cluster_id;
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (!coordinates || !source || typeof clusterId !== "number") return;

      void source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          map.easeTo({ center: coordinates, zoom, duration: 450 });
        })
        .catch(() => undefined);
    });

    map.on("click", markerLayerId, (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const restaurant = getRestaurantByFeature(restaurantsRef.current, feature);
      const coordinates = featureCoordinates(feature);
      if (!restaurant || !coordinates) return;

      onSelectRef.current(restaurant);
      openRestaurantPopup(restaurant, coordinates);
    });

    for (const layerId of [clusterLayerId, markerLayerId]) {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      popupRestaurantIdRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncData = () => {
      (map.getSource(sourceId) as GeoJSONSource).setData(data);
      map.setFilter(selectedLayerId, ["==", ["get", "id"], selectedIdRef.current ?? ""]);

      if (popupRestaurantIdRef.current && !restaurants.some((restaurant) => restaurant.id === popupRestaurantIdRef.current)) {
        popupRef.current?.remove();
        popupRef.current = null;
        popupRestaurantIdRef.current = null;
      }
    };

    return runWithRestaurantLayers(map, syncData);
  }, [data, restaurants]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    popupRef.current?.remove();
    popupRef.current = null;
    popupRestaurantIdRef.current = null;

    map.easeTo({
      center: [cityCenter.longitude, cityCenter.latitude],
      zoom: 11,
      duration: 450
    });
  }, [cityCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitBoundsKey || fittedBoundsKeyRef.current === fitBoundsKey || !restaurants.length) return;

    const fitRestaurants = () => {
      const bounds = new maplibregl.LngLatBounds();
      for (const restaurant of restaurants) {
        bounds.extend([restaurant.longitude, restaurant.latitude]);
      }
      map.fitBounds(bounds, {
        padding: mapPadding(map),
        maxZoom: 14,
        duration: 450
      });
      fittedBoundsKeyRef.current = fitBoundsKey;
    };

    return runWithRestaurantLayers(map, fitRestaurants);
  }, [fitBoundsKey, restaurants]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(selectedLayerId)) return;
    map.setFilter(selectedLayerId, ["==", ["get", "id"], selectedId ?? ""]);
    if (popupRestaurantIdRef.current && popupRestaurantIdRef.current !== selectedId) {
      popupRef.current?.remove();
      popupRef.current = null;
      popupRestaurantIdRef.current = null;
    }
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest) return;

    const focusRestaurant = () => {
      const restaurant = restaurantsRef.current.find((item) => item.id === focusRequest.id);
      if (!restaurant) return;
      const coordinates: [number, number] = [restaurant.longitude, restaurant.latitude];

      map.easeTo({
        center: coordinates,
        zoom: Math.max(map.getZoom(), restaurantFocusZoom),
        duration: 550
      });

      popupRef.current?.remove();
      popupRestaurantIdRef.current = restaurant.id;
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 14 })
        .setLngLat(coordinates)
        .setHTML(restaurantPopupHtml(restaurant))
        .addTo(map);
    };

    focusRestaurant();
  }, [focusRequest]);

  return <div ref={containerRef} className="map-canvas" data-testid="map-canvas" />;
}

export const MapView = memo(MapViewComponent);
