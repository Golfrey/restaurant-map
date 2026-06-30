import type { Restaurant } from "../../../shared/types";
import { sourceLabel } from "../../appUtils";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

export function SourcePill({ restaurant, className }: { restaurant: Restaurant; className?: string }) {
  const variant = restaurant.source === "both" ? "both" : restaurant.source === "resy" ? "resy" : "inkind";
  return (
    <Badge variant={variant} className={cn("shrink-0", className)}>
      {sourceLabel(restaurant.source)}
    </Badge>
  );
}

export function SourceDot({ source }: { source: Restaurant["source"] }) {
  return (
    <span
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        source === "both" && "bg-both",
        source === "resy" && "bg-resy",
        source === "inkind" && "bg-inkind"
      )}
      aria-hidden="true"
    />
  );
}
