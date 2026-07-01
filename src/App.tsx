import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LocateFixed, MapPin, RefreshCw, Search, SlidersHorizontal, Utensils, X } from "lucide-react";
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
import {
  filterRestaurants,
  filterRestaurantsByBounds,
  topTags,
  type MapBounds,
  type PriceFilter,
  type SourceFilter
} from "./appUtils";

const locationViewportZoom = 14;

const MapView = lazy(() => import("./MapView").then((module) => ({ default: module.MapView })));

function roundBounds(bounds: MapBounds): MapBounds {
  return {
    west: Number(bounds.west.toFixed(5)),
    south: Number(bounds.south.toFixed(5)),
    east: Number(bounds.east.toFixed(5)),
    north: Number(bounds.north.toFixed(5))
  };
}

function sameBounds(a: MapBounds | undefined, b: MapBounds): boolean {
  return Boolean(a && a.west === b.west && a.south === b.south && a.east === b.east && a.north === b.north);
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === 1) return "Location permission was denied. Enable location access and try again.";
  if (error.code === 2) return "Your location is unavailable. Try again from a browser with location access.";
  if (error.code === 3) return "Location lookup timed out. Try again.";
  return "Unable to get your location. Try again.";
}

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
  const [openPanel, setOpenPanel] = useState<"city" | "filters" | null>(null);
  const [viewportBounds, setViewportBounds] = useState<MapBounds>();
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const mapFocusNonceRef = useRef(0);
  const locationRequestNonceRef = useRef(0);
  const [mapFocusRequest, setMapFocusRequest] = useState<{ id: string; nonce: number }>();
  const [locationViewportRequest, setLocationViewportRequest] = useState<{
    center: { latitude: number; longitude: number };
    zoom: number;
    nonce: number;
  }>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>();

  useEffect(() => {
    if (!openPanel) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && controlsRef.current?.contains(target)) return;
      setOpenPanel(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPanel]);

  const tagOptions = useMemo(() => topTags(cityData?.restaurants ?? []), [cityData]);
  const filteredRestaurants = useMemo(
    () => filterRestaurants(cityData?.restaurants ?? [], query, source, selectedTags, selectedPrices),
    [cityData, query, source, selectedPrices, selectedTags]
  );
  const visibleRestaurants = useMemo(
    () => filterRestaurantsByBounds(filteredRestaurants, viewportBounds),
    [filteredRestaurants, viewportBounds]
  );

  useEffect(() => {
    if (!cityData) return;
    setSelectedId(cityData.restaurants[0]?.id);
  }, [cityData]);

  useEffect(() => {
    locationRequestNonceRef.current += 1;
    setLocating(false);
    setLocationError(undefined);
    setLocationViewportRequest(undefined);
    setSelectedTags([]);
    setSelectedPrices([]);
    setSelectedId(undefined);
    setMapFocusRequest(undefined);
    setViewportBounds(undefined);
    setOpenPanel(null);
  }, [cityCode]);

  const selectedRestaurant =
    visibleRestaurants.find((restaurant) => restaurant.id === selectedId) ?? visibleRestaurants[0];
  const generatedLabel = cityData?.generatedAt ? new Date(cityData.generatedAt).toLocaleString() : "Waiting for data";
  const activeFilterCount = (source === "all" ? 0 : 1) + selectedPrices.length + selectedTags.length;
  const restaurantListEmptyMessage =
    viewportBounds && filteredRestaurants.length
      ? "No restaurants in the current map view."
      : "No restaurants match the current filters.";

  const selectRestaurant = useCallback((restaurant: Restaurant) => {
    setSelectedId(restaurant.id);
    mapFocusNonceRef.current += 1;
    setMapFocusRequest({ id: restaurant.id, nonce: mapFocusNonceRef.current });
  }, []);

  const handleViewportChange = useCallback((bounds: MapBounds) => {
    const nextBounds = roundBounds(bounds);
    setViewportBounds((current) => (sameBounds(current, nextBounds) ? current : nextBounds));
  }, []);

  const clearFilters = useCallback(() => {
    setSource("all");
    setSelectedTags([]);
    setSelectedPrices([]);
  }, []);

  const handleUseLocation = useCallback(() => {
    setLocationError(undefined);
    setOpenPanel(null);

    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }

    const requestNonce = locationRequestNonceRef.current + 1;
    locationRequestNonceRef.current = requestNonce;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (locationRequestNonceRef.current !== requestNonce) return;

        setLocationError(undefined);
        setLocating(false);
        setLocationViewportRequest({
          center: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          },
          zoom: locationViewportZoom,
          nonce: requestNonce
        });
        setSelectedId(undefined);
        setMapFocusRequest(undefined);
        setViewportBounds(undefined);
      },
      (geoError) => {
        if (locationRequestNonceRef.current !== requestNonce) return;
        setLocationError(geolocationErrorMessage(geoError));
        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 10000
      }
    );
  }, []);

  const handleCityChange = useCallback((nextCityCode: CityCode) => {
    locationRequestNonceRef.current += 1;
    setLocating(false);
    setLocationError(undefined);
    setLocationViewportRequest(undefined);
    setSelectedId(undefined);
    setMapFocusRequest(undefined);
    setViewportBounds(undefined);
    setCityCode(nextCityCode);
    setOpenPanel(null);
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
            <span>{visibleRestaurants.length.toLocaleString()} shown</span>
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
          <div ref={controlsRef} className="relative shrink-0 border-b p-3">
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-0 flex-1 justify-between px-2.5"
                  onClick={() => setOpenPanel((current) => (current === "city" ? null : "city"))}
                  aria-expanded={openPanel === "city"}
                  aria-controls="city-popover"
                  aria-label={`Change city, currently ${selectedCity.name}`}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{selectedCity.name}</span>
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
                <Button
                  variant={activeFilterCount ? "default" : "outline"}
                  size="sm"
                  className="h-9 px-2.5"
                  onClick={() => setOpenPanel((current) => (current === "filters" ? null : "filters"))}
                  aria-expanded={openPanel === "filters"}
                  aria-controls="filters-popover"
                  type="button"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>{activeFilterCount ? `Filters ${activeFilterCount}` : "Filters"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5"
                  onClick={handleUseLocation}
                  disabled={locating}
                  aria-label="Use my location"
                  type="button"
                  title="Use my location"
                >
                  <LocateFixed className={cn("size-3.5", locating && "animate-pulse")} />
                  <span className="max-sm:hidden">{locating ? "Locating" : "Use my location"}</span>
                </Button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search restaurants, labels"
                  className="h-9 rounded-lg bg-muted/35 pl-9"
                />
              </div>

              <StatsStrip data={cityData} />
            </div>

            {openPanel === "city" ? (
              <div
                id="city-popover"
                role="dialog"
                aria-label="City selector"
                className="absolute left-3 right-3 top-[calc(100%-0.25rem)] z-30 grid max-h-[min(62vh,520px)] gap-3 overflow-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-muted-foreground">City</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setOpenPanel(null)}
                    type="button"
                    aria-label="Close city selector"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <CitySelector cities={supportedCities} value={cityCode} onChange={handleCityChange} />
              </div>
            ) : null}

            {openPanel === "filters" ? (
              <div
                id="filters-popover"
                role="dialog"
                aria-label="Restaurant filters"
                className="absolute left-3 right-3 top-[calc(100%-0.25rem)] z-30 grid max-h-[min(62vh,520px)] gap-4 overflow-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-muted-foreground">Filters</div>
                  <div className="flex items-center gap-1">
                    {activeFilterCount ? (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearFilters} type="button">
                        Clear
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setOpenPanel(null)}
                      type="button"
                      aria-label="Close filters"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>

                <SidebarSection title="Source">
                  <SourceFilters value={source} onChange={setSource} />
                </SidebarSection>

                <SidebarSection title="Price">
                  <PriceFilters value={selectedPrices} onToggle={togglePrice} />
                </SidebarSection>

                <SidebarSection title="Labels">
                  <div className="flex max-h-44 flex-wrap gap-2 overflow-auto pr-1" aria-label="Label filters">
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
            ) : null}
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
          {locationError ? (
            <Card className="mx-4 mb-3 border-destructive/40 bg-destructive/10 text-destructive shadow-none">
              <CardContent className="p-3 text-sm">{locationError}</CardContent>
            </Card>
          ) : null}
          {loading ? (
            <Card className="mx-4 mb-3 border-inkind/20 bg-inkind/10 shadow-none">
              <CardContent className="p-3 text-sm">Loading restaurants...</CardContent>
            </Card>
          ) : null}

          <RestaurantList
            restaurants={visibleRestaurants}
            selectedId={selectedRestaurant?.id}
            onSelect={selectRestaurant}
            emptyMessage={restaurantListEmptyMessage}
          />

          <footer className="shrink-0 border-t px-4 py-3 text-xs text-muted-foreground">
            {cityData?.cached ? "Cached data" : "Fresh data"} / {generatedLabel}
          </footer>
        </aside>

        <section className="relative min-h-0 min-w-0 bg-muted max-md:h-[60vh]">
          <Suspense fallback={<div className="map-canvas" />}>
            <MapView
              restaurants={filteredRestaurants}
              selectedId={selectedRestaurant?.id}
              focusRequest={mapFocusRequest}
              cityCenter={selectedCity.center}
              viewportRequest={locationViewportRequest}
              onSelect={selectRestaurant}
              onViewportChange={handleViewportChange}
              fitBoundsKey={locationViewportRequest ? undefined : cityData?.city}
            />
          </Suspense>
          <RestaurantDetails restaurant={selectedRestaurant} />
        </section>
      </div>
    </main>
  );
}
