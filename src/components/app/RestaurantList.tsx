import type { Restaurant } from "../../../shared/types";
import { detailLine, sourceLabel } from "../../appUtils";
import { cn } from "../../lib/utils";
import { SourceDot, SourcePill } from "./SourcePill";

export function RestaurantList({
  restaurants,
  selectedId,
  onSelect
}: {
  restaurants: Restaurant[];
  selectedId?: string;
  onSelect: (restaurant: Restaurant) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto border-t" aria-label="Restaurants">
      {restaurants.map((restaurant) => (
        <button
          key={restaurant.id}
          className={cn(
            "flex w-full items-center gap-3 border-b px-4 py-3 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
            restaurant.id === selectedId && "bg-accent"
          )}
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
          <SourcePill restaurant={restaurant} className="hidden max-w-24 truncate px-2 text-[11px] sm:inline-flex" />
        </button>
      ))}
    </div>
  );
}
