import { useCallback, useEffect, useRef, useState } from "react";
import type { CityCode } from "../../shared/cities";
import type { RestaurantResponse } from "../../shared/types";
import { fetchRestaurants } from "../api";

export function useRestaurantData(city: CityCode) {
  const [data, setData] = useState<RestaurantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchRestaurants({ city, signal: controller.signal });
      if (requestId !== requestIdRef.current) return;
      setData(payload);
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load restaurants.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [city]);

  useEffect(() => {
    setData(null);
    void load();
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [load]);

  return { data, error, loading, load };
}
