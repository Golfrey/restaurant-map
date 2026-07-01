import { MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { CityCode, CityConfig } from "../../../shared/cities";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface CitySelectorProps {
  cities: CityConfig[];
  value: CityCode;
  onChange: (city: CityCode) => void;
}

export function CitySelector({ cities, value, onChange }: CitySelectorProps) {
  const [query, setQuery] = useState("");
  const filteredCities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return cities;
    return cities.filter((city) =>
      [city.name, city.state, city.code].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [cities, query]);

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search cities"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cities"
          className="h-9 rounded-lg bg-muted/35 pl-8"
        />
      </div>
      <div
        className="grid max-h-36 gap-1 overflow-auto pr-1 max-md:flex max-md:max-h-none max-md:overflow-x-auto max-md:pb-1 max-md:pr-0"
        aria-label="Cities"
      >
        {filteredCities.map((city) => {
          const selected = city.code === value;
          return (
            <Button
              key={city.code}
              variant={selected ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-auto w-full justify-start rounded-md px-2.5 py-2 text-left max-md:w-40 max-md:flex-none",
                selected && "shadow-none"
              )}
              onClick={() => {
                onChange(city.code);
                setQuery("");
              }}
              aria-pressed={selected}
              type="button"
            >
              <MapPin className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{city.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {city.state} / {city.radiusMiles} mi
                </span>
              </span>
            </Button>
          );
        })}
        {!filteredCities.length ? (
          <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">No matching cities.</div>
        ) : null}
      </div>
    </div>
  );
}
