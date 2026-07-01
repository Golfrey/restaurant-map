import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, RefreshCw, Search, Utensils } from "lucide-react";
import { defaultCityCode, getCity, supportedCities, type CityCode } from "../shared/cities";
import type { Restaurant } from "../shared/types";
import { CitySelector } from "./components/app/CitySelector";
import { PriceFilters } from "./components/app/PriceFilters";
import { RestaurantDetails } from "./components/app/RestaurantDetails";
import { RestaurantList } from "./components/app/RestaurantList";
import { SidebarSection } from "./components/app/SidebarSection";
import { SourceFilters } from "./components/app/SourceFilters";
import { StatsStrip } from "./components/app/StatsStrip";
import { ThemeToggle } from "./components/app/ThemeToggle";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { useRestaurantData } from "./hooks/useRestaurantData";
import { useTheme } from "./hooks/useTheme";
import { cn } from "./lib/utils";
import { filterRestaurants, topTags, type PriceFilter, type SourceFilter } from "./appUtils";

const MapView = lazy(() => import("./MapView").then((module) => ({ default: module.MapView })));

export default function App() {
  const [cityCode, setCityCode] = useState<CityCode>(defaultCityCode);
  const selectedCity = useMemo(() => getCity(cityCode), [cityCode]);
  const { data, error, loading, load } = useRestaurantData(cityCode);
  const cityData = data?.city === cityCode ? data : null;
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [theme, setTheme] = useTheme();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<PriceFilter[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const mapFocusNonceRef = useRef(0);
  const [mapFocusRequest, setMapFocusRequest] = useState<{ id: string; nonce: number }>();

  useEffect(() => {
    if (!cityData) return;
    setSelectedId(cityData.restaurants[0]?.id);
  }, [cityData]);

  useEffect(() => {
    setSelectedTags([]);
    setSelectedPrices([]);
    setSelectedId(undefined);
    setMapFocusRequest(undefined);
  }, [cityCode]);

  const tagOptions = useMemo(() => topTags(cityData?.restaurants ?? []), [cityData]);
  const restaurants = useMemo(
    () => filterRestaurants(cityData?.restaurants ?? [], query, source, selectedTags, selectedPrices),
    [cityData, query, source, selectedTags, selectedPrices]
  );
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedId) ?? restaurants[0];
  const generatedLabel = cityData?.generatedAt ? new Date(cityData.generatedAt).toLocaleString() : "Waiting for data";

  const selectRestaurant = useCallback((restaurant: Restaurant) => {
    setSelectedId(restaurant.id);
    mapFocusNonceRef.current += 1;
    setMapFocusRequest({ id: restaurant.id, nonce: mapFocusNonceRef.current });
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function togglePrice(price: PriceFilter) {
    setSelectedPrices((current) =>
      current.includes(price) ? current.filter((item) => item !== price) : [...current, price]
    );
  }

  return (
    <main className="flex h-screen min-h-[680px] flex-col bg-background text-foreground max-md:h-auto max-md:min-h-screen">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card">
            <MapPin className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-none">{selectedCity.name} Restaurant Map</h1>
            <p className="mt-1 truncate text-xs text-muted-foreground">Resy + inKind</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-md border px-2.5 py-1 text-xs text-muted-foreground sm:flex">
            <Utensils className="size-3.5" />
            <span>{restaurants.length.toLocaleString()} shown</span>
          </div>
          <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
          <Button variant="outline" size="sm" onClick={() => void load()} type="button" title="Reload cached data">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            <span className="max-sm:hidden">Reload</span>
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,400px)_1fr] max-md:grid-cols-1">
        <aside className="flex min-h-0 flex-col border-r bg-background max-md:max-h-[58vh] max-md:border-b max-md:border-r-0">
          <div className="grid shrink-0 gap-4 p-4">
            <SidebarSection title="City">
              <CitySelector cities={supportedCities} value={cityCode} onChange={setCityCode} />
            </SidebarSection>

            <StatsStrip data={cityData} />

            <SidebarSection title="Search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search restaurants, labels"
                  className="h-10 rounded-lg bg-muted/35 pl-9"
                />
              </div>
            </SidebarSection>

            <SidebarSection title="Source">
              <SourceFilters value={source} onChange={setSource} />
            </SidebarSection>

            <SidebarSection title="Price">
              <PriceFilters value={selectedPrices} onToggle={togglePrice} />
            </SidebarSection>

            <SidebarSection title="Labels">
              <div className="flex max-h-28 flex-wrap gap-2 overflow-auto pr-1" aria-label="Label filters">
                {tagOptions.map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    size="sm"
                    className="h-8 rounded-full px-3"
                    onClick={() => toggleTag(tag)}
                    type="button"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </SidebarSection>
          </div>

          {cityData?.warnings?.length ? (
            <Card className="mx-4 mb-3 border-yellow-300 bg-yellow-50 text-yellow-950 shadow-none dark:border-yellow-500/40 dark:bg-yellow-500/10 dark:text-yellow-100">
              <CardContent className="grid gap-1 p-3 text-sm">
                {cityData.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <Card className="mx-4 mb-3 border-destructive/40 bg-destructive/10 text-destructive shadow-none">
              <CardContent className="p-3 text-sm">{error}</CardContent>
            </Card>
          ) : null}
          {loading ? (
            <Card className="mx-4 mb-3 border-inkind/20 bg-inkind/10 shadow-none">
              <CardContent className="p-3 text-sm">Loading restaurants...</CardContent>
            </Card>
          ) : null}

          <RestaurantList restaurants={restaurants} selectedId={selectedRestaurant?.id} onSelect={selectRestaurant} />

          <footer className="shrink-0 border-t px-4 py-3 text-xs text-muted-foreground">
            {cityData?.cached ? "Cached data" : "Fresh data"} / {generatedLabel}
          </footer>
        </aside>

        <section className="relative min-h-0 min-w-0 bg-muted max-md:h-[60vh]">
          <Suspense fallback={<div className="map-canvas" />}>
            <MapView
              restaurants={restaurants}
              selectedId={selectedRestaurant?.id}
              focusRequest={mapFocusRequest}
              cityCenter={selectedCity.center}
              onSelect={selectRestaurant}
            />
          </Suspense>
          <RestaurantDetails restaurant={selectedRestaurant} />
        </section>
      </div>
    </main>
  );
}
