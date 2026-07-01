import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  ChevronUp,
  List,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Utensils,
  X
} from "lucide-react";
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
  detailLine,
  filterRestaurants,
  filterRestaurantsByBounds,
  sourceLabel,
  topTags,
  type MapBounds,
  type PriceFilter,
  type SourceFilter
} from "./appUtils";

const locationViewportZoom = 14;
const mobileLayoutQuery = "(max-width: 767px)";
const collapsedMobileSheetHeight = 92;
const defaultMobileViewportHeight = 844;

type MobileSheetState = "collapsed" | "half" | "expanded";
type MobileSheetView = "results" | "details";

const MapView = lazy(() => import("./MapView").then((module) => ({ default: module.MapView })));

function currentMobileViewportHeight(): number {
  if (typeof window === "undefined") return defaultMobileViewportHeight;
  return Math.round(window.visualViewport?.height ?? window.innerHeight ?? defaultMobileViewportHeight);
}

function mobileLayoutMatches(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") return window.matchMedia(mobileLayoutQuery).matches;
  return window.innerWidth < 768;
}

function mobileSheetHeightPx(state: MobileSheetState, viewportHeight: number): number {
  const usableHeight = Math.max(320, viewportHeight);
  if (state === "collapsed") return collapsedMobileSheetHeight;
  if (state === "half") return Math.round(Math.min(usableHeight - 24, Math.max(280, usableHeight * 0.44)));
  return Math.round(Math.min(usableHeight - 16, Math.max(420, usableHeight * 0.88)));
}

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

function locationRequiresSecureContext(): boolean {
  if (window.isSecureContext) return false;
  const hostname = window.location.hostname;
  return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
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
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>("collapsed");
  const [mobileSheetView, setMobileSheetView] = useState<MobileSheetView>("results");
  const [mobileViewportHeight, setMobileViewportHeight] = useState(() => currentMobileViewportHeight());
  const [isMobileLayout, setIsMobileLayout] = useState(() => mobileLayoutMatches());
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
    const handleResize = () => {
      setMobileViewportHeight(currentMobileViewportHeight());
      setIsMobileLayout(mobileLayoutMatches());
    };
    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia(mobileLayoutQuery) : undefined;
    const visualViewport = window.visualViewport;

    handleResize();
    window.addEventListener("resize", handleResize);
    visualViewport?.addEventListener("resize", handleResize);
    mediaQuery?.addEventListener("change", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      visualViewport?.removeEventListener("resize", handleResize);
      mediaQuery?.removeEventListener("change", handleResize);
    };
  }, []);

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
    setMobileSheetState("collapsed");
    setMobileSheetView("results");
  }, [cityCode]);

  const selectedRestaurant =
    visibleRestaurants.find((restaurant) => restaurant.id === selectedId) ?? visibleRestaurants[0];
  const generatedLabel = cityData?.generatedAt ? new Date(cityData.generatedAt).toLocaleString() : "Waiting for data";
  const activeFilterCount = (source === "all" ? 0 : 1) + selectedPrices.length + selectedTags.length;
  const mobileSheetHeight = mobileSheetHeightPx(mobileSheetState, mobileViewportHeight);
  const mobileLayoutStyle = { "--mobile-sheet-height": `${mobileSheetHeight}px` } as CSSProperties;
  const mobileSheetSummary =
    mobileSheetView === "details" && selectedRestaurant
      ? selectedRestaurant.name
      : `${visibleRestaurants.length.toLocaleString()} restaurants`;
  const mobileSheetSubcopy =
    mobileSheetView === "details" && selectedRestaurant
      ? detailLine(selectedRestaurant) || sourceLabel(selectedRestaurant.source)
      : `${visibleRestaurants.length.toLocaleString()} shown`;
  const restaurantListEmptyMessage =
    viewportBounds && filteredRestaurants.length
      ? "No restaurants in the current map view."
      : "No restaurants match the current filters.";

  const selectRestaurant = useCallback((restaurant: Restaurant) => {
    setSelectedId(restaurant.id);
    setMobileSheetView("details");
    setMobileSheetState("half");
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
    setMobileSheetView("results");
  }, []);

  const handleUseLocation = useCallback(() => {
    setLocationError(undefined);
    setOpenPanel(null);
    setMobileSheetView("results");
    setMobileSheetState("collapsed");

    if (locationRequiresSecureContext()) {
      setLocationError("Location requires HTTPS or localhost. Open this app over localhost or Tailscale HTTPS.");
      return;
    }

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
    setMobileSheetState("collapsed");
    setMobileSheetView("results");
  }, []);

  function toggleTag(tag: string) {
    setMobileSheetView("results");
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function togglePrice(price: PriceFilter) {
    setMobileSheetView("results");
    setSelectedPrices((current) =>
      current.includes(price) ? current.filter((item) => item !== price) : [...current, price]
    );
  }

  return (
    <main className="flex h-screen min-h-[680px] flex-col bg-background text-foreground max-md:h-[100dvh] max-md:min-h-0 max-md:overflow-hidden">
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

      <div
        className="grid min-h-0 flex-1 grid-cols-[minmax(360px,400px)_1fr] max-md:relative max-md:block max-md:overflow-hidden"
        style={mobileLayoutStyle}
      >
        <aside className="flex min-h-0 flex-col border-r bg-background max-md:absolute max-md:bottom-[calc(0.5rem+env(safe-area-inset-bottom))] max-md:left-2 max-md:right-2 max-md:z-20 max-md:h-[var(--mobile-sheet-height)] max-md:overflow-hidden max-md:rounded-xl max-md:border max-md:bg-background/95 max-md:shadow-2xl max-md:backdrop-blur max-md:transition-[height] max-md:duration-200 max-md:ease-out">
          {isMobileLayout ? (
            <div className="hidden shrink-0 flex-col border-b px-3 pb-2 pt-2 max-md:flex">
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <button
                  className="min-w-0 flex-1 rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setMobileSheetState((current) => (current === "collapsed" ? "half" : "collapsed"))}
                  type="button"
                  aria-expanded={mobileSheetState !== "collapsed"}
                >
                  <span className="block truncate text-sm font-semibold">{mobileSheetSummary}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{mobileSheetSubcopy}</span>
                </button>
                {mobileSheetView === "details" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    onClick={() => {
                      setMobileSheetView("results");
                      setMobileSheetState("half");
                    }}
                    type="button"
                    aria-label="Show restaurant list"
                  >
                    <List className="size-4" />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  onClick={() => setMobileSheetState((current) => (current === "expanded" ? "half" : "expanded"))}
                  type="button"
                  aria-label={mobileSheetState === "expanded" ? "Reduce sheet" : "Expand sheet"}
                >
                  {mobileSheetState === "expanded" ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  onClick={() => setMobileSheetState((current) => (current === "collapsed" ? "half" : "collapsed"))}
                  type="button"
                  aria-label={mobileSheetState === "collapsed" ? "Open sheet" : "Collapse sheet"}
                >
                  {mobileSheetState === "collapsed" ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              mobileSheetState === "collapsed" && "max-md:hidden",
              isMobileLayout && mobileSheetView === "details" && "max-md:hidden"
            )}
          >
            <div ref={controlsRef} className="relative shrink-0 border-b p-3">
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 min-w-0 flex-1 justify-between px-2.5"
                    onClick={() => {
                      setMobileSheetView("results");
                      setMobileSheetState("expanded");
                      setOpenPanel((current) => (current === "city" ? null : "city"));
                    }}
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
                    onClick={() => {
                      setMobileSheetView("results");
                      setMobileSheetState("expanded");
                      setOpenPanel((current) => (current === "filters" ? null : "filters"));
                    }}
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
                    onChange={(event) => {
                      setMobileSheetView("results");
                      setQuery(event.target.value);
                    }}
                    onFocus={() => setMobileSheetState((current) => (current === "collapsed" ? "half" : current))}
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
              <Card className="mx-4 mb-3 border-yellow-300 bg-yellow-50 text-yellow-950 shadow-none max-md:mx-3 max-md:mb-2 dark:border-yellow-500/40 dark:bg-yellow-500/10 dark:text-yellow-100">
                <CardContent className="grid gap-1 p-3 text-sm">
                  {cityData.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {error ? (
              <Card className="mx-4 mb-3 border-destructive/40 bg-destructive/10 text-destructive shadow-none max-md:mx-3 max-md:mb-2">
                <CardContent className="p-3 text-sm">{error}</CardContent>
              </Card>
            ) : null}
            {locationError ? (
              <Card className="mx-4 mb-3 border-destructive/40 bg-destructive/10 text-destructive shadow-none max-md:mx-3 max-md:mb-2">
                <CardContent className="p-3 text-sm">{locationError}</CardContent>
              </Card>
            ) : null}
            {loading ? (
              <Card className="mx-4 mb-3 border-inkind/20 bg-inkind/10 shadow-none max-md:mx-3 max-md:mb-2">
                <CardContent className="p-3 text-sm">Loading restaurants...</CardContent>
              </Card>
            ) : null}

            <RestaurantList
              restaurants={visibleRestaurants}
              selectedId={selectedRestaurant?.id}
              onSelect={selectRestaurant}
              emptyMessage={restaurantListEmptyMessage}
            />

            <footer className="shrink-0 space-y-1 border-t bg-background px-4 py-3 text-sm leading-5 text-muted-foreground max-md:hidden">
              <p>
                {cityData?.cached ? "Cached data" : "Fresh data"} / {generatedLabel}
              </p>
              <p>
                Data from Resy and inKind. Verify details on the source before booking or purchasing. Independent
                project.
              </p>
            </footer>
          </div>

          {isMobileLayout ? (
            <div
              className={cn(
                "hidden min-h-0 flex-1 overflow-auto",
                mobileSheetState !== "collapsed" && mobileSheetView === "details" && "max-md:block"
              )}
            >
              <RestaurantDetails restaurant={selectedRestaurant} variant="sheet" />
            </div>
          ) : null}
        </aside>

        <section className="relative min-h-0 min-w-0 bg-muted max-md:absolute max-md:inset-0 max-md:h-full">
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
              mobileBottomInset={mobileSheetHeight + 16}
            />
          </Suspense>
          <RestaurantDetails restaurant={selectedRestaurant} className="max-md:hidden" />
        </section>
      </div>
    </main>
  );
}
