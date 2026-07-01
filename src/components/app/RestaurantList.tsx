import { memo, useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import type { Restaurant } from "../../../shared/types";
import { detailLine, sourceLabel } from "../../appUtils";
import { cn } from "../../lib/utils";
import { SourceDot, SourcePill } from "./SourcePill";

const rowHeight = 60;
const overscanRows = 6;
const defaultViewportHeight = 640;

function RestaurantListComponent({
  restaurants,
  selectedId,
  onSelect,
  emptyMessage = "No restaurants match the current filters."
}: {
  restaurants: Restaurant[];
  selectedId?: string;
  onSelect: (restaurant: Restaurant) => void;
  emptyMessage?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(defaultViewportHeight);

  const updateViewportHeight = useCallback(() => {
    const height = containerRef.current?.clientHeight;
    setViewportHeight(height && height > 0 ? height : defaultViewportHeight);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    updateViewportHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportHeight);
      return () => window.removeEventListener("resize", updateViewportHeight);
    }

    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [updateViewportHeight]);

  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [restaurants]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const visibleRange = useMemo(() => {
    if (!restaurants.length) return { start: 0, end: 0 };

    const firstVisible = Math.floor(scrollTop / rowHeight);
    const visibleRows = Math.ceil(viewportHeight / rowHeight);
    const start = Math.max(0, firstVisible - overscanRows);
    const end = Math.min(restaurants.length, firstVisible + visibleRows + overscanRows * 2);

    return { start, end };
  }, [restaurants.length, scrollTop, viewportHeight]);

  const visibleRestaurants = restaurants.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-auto border-t"
      aria-label="Restaurants"
      onScroll={handleScroll}
    >
      {restaurants.length ? (
        <div className="relative" style={{ height: restaurants.length * rowHeight }}>
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${visibleRange.start * rowHeight}px)` }}
          >
            {visibleRestaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                className={cn(
                  "flex w-full items-center gap-3 border-b px-4 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  restaurant.id === selectedId && "bg-accent"
                )}
                style={{ height: rowHeight }}
                onClick={() => onSelect(restaurant)}
                type="button"
              >
                <SourceDot source={restaurant.source} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{restaurant.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {detailLine(restaurant) || sourceLabel(restaurant.source)}
                  </span>
                </span>
                <SourcePill
                  restaurant={restaurant}
                  className="hidden max-w-24 truncate px-2 text-[11px] sm:inline-flex"
                />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-muted-foreground">{emptyMessage}</div>
      )}
    </div>
  );
}

export const RestaurantList = memo(RestaurantListComponent);
