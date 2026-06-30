import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { CityCenter } from "../shared/cities";
import type { Restaurant } from "../shared/types";
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
  sourceId,
  type MapTone
} from "./map/restaurantMap";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapViewProps {
  restaurants: Restaurant[];
  selectedId?: string;
  mapTone: MapTone;
  cityCenter: CityCenter;
  onSelect: (restaurant: Restaurant) => void;
}

export function MapView({ restaurants, selectedId, mapTone, cityCenter, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupRestaurantIdRef = useRef<string | null>(null);
  const restaurantsRef = useRef(restaurants);
  const dataRef = useRef<FeatureCollection<Point>>(featureCollection([]));
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const cityCenterRef = useRef(cityCenter);
  const styleToneRef = useRef<MapTone | null>(null);
  const data = useMemo(() => featureCollection(restaurants), [restaurants]);

  restaurantsRef.current = restaurants;
  dataRef.current = data;
  onSelectRef.current = onSelect;
  selectedIdRef.current = selectedId;
  cityCenterRef.current = cityCenter;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl(mapTone),
      center: [cityCenterRef.current.longitude, cityCenterRef.current.latitude],
      zoom: 11,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;
    styleToneRef.current = mapTone;

    map.on("load", () => {
      addRestaurantLayers(map);
      (map.getSource(sourceId) as GeoJSONSource).setData(dataRef.current);
    });

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
      popupRef.current?.remove();
      popupRestaurantIdRef.current = restaurant.id;
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 14 })
        .setLngLat(coordinates)
        .setHTML(restaurantPopupHtml(restaurant))
        .addTo(map);
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
    if (styleToneRef.current === mapTone) return;
    styleToneRef.current = mapTone;

    const restoreLayers = () => {
      addRestaurantLayers(map);
      (map.getSource(sourceId) as GeoJSONSource).setData(dataRef.current);
      map.setFilter(selectedLayerId, ["==", ["get", "id"], selectedIdRef.current ?? ""]);
    };

    map.once("style.load", restoreLayers);
    map.setStyle(mapStyleUrl(mapTone));

    return () => {
      map.off("style.load", restoreLayers);
    };
  }, [mapTone]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncData = () => {
      addRestaurantLayers(map);
      (map.getSource(sourceId) as GeoJSONSource).setData(data);

      if (popupRestaurantIdRef.current && !restaurants.some((restaurant) => restaurant.id === popupRestaurantIdRef.current)) {
        popupRef.current?.remove();
        popupRef.current = null;
        popupRestaurantIdRef.current = null;
      }

      if (!restaurants.length) {
        map.easeTo({
          center: [cityCenter.longitude, cityCenter.latitude],
          zoom: 11,
          duration: 450
        });
        return;
      }

      const bounds = new maplibregl.LngLatBounds();
      for (const restaurant of restaurants) {
        bounds.extend([restaurant.longitude, restaurant.latitude]);
      }
      map.fitBounds(bounds, {
        padding: mapPadding(map),
        maxZoom: 14,
        duration: 450
      });
    };

    if (map.loaded()) {
      syncData();
    } else {
      map.once("load", syncData);
    }
  }, [cityCenter, data, restaurants]);

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

  return <div ref={containerRef} className="map-canvas" data-testid="map-canvas" />;
}
