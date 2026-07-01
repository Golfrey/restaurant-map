import { priceOptions, type PriceFilter } from "../../appUtils";
import { Button } from "../ui/button";

export function PriceFilters({ value, onToggle }: { value: PriceFilter[]; onToggle: (price: PriceFilter) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg border bg-muted p-1" aria-label="Price filter">
      {priceOptions.map((price) => (
        <Button
          key={price}
          variant={value.includes(price) ? "default" : "ghost"}
          size="sm"
          type="button"
          className="h-8 px-2 text-sm"
          onClick={() => onToggle(price)}
        >
          {price}
        </Button>
      ))}
    </div>
  );
}
