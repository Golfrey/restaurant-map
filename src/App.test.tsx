import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import type { CityCenter } from "../shared/cities";
import type { Restaurant, RestaurantResponse } from "../shared/types";
import App from "./App";
import type { MapBounds } from "./appUtils";

interface MockMapViewProps {
  restaurants: Restaurant[];
  onSelect: (restaurant: Restaurant) => void;
  focusRequest?: {
    id: string;
  };
  cityCenter: CityCenter;
  viewportRequest?: {
    center: CityCenter;
    zoom: number;
    nonce: number;
  };
  onViewportChange?: (bounds: MapBounds) => void;
  fitBoundsKey?: string;
  mobileBottomInset?: number;
}

vi.mock("./MapView", () => ({
  MapView: ({
    restaurants,
    onSelect,
    focusRequest,
    cityCenter,
    viewportRequest,
    onViewportChange,
    fitBoundsKey
  }: MockMapViewProps) => (
    <div
      data-testid="map"
      data-focus-id={focusRequest?.id ?? ""}
      data-center={`${cityCenter.latitude},${cityCenter.longitude}`}
      data-viewport-center={
        viewportRequest ? `${viewportRequest.center.latitude},${viewportRequest.center.longitude}` : ""
      }
      data-viewport-zoom={viewportRequest?.zoom ?? ""}
      data-fit-key={fitBoundsKey ?? ""}
      data-restaurants={restaurants.map((restaurant) => restaurant.name).join("|")}
    >
      <button
        type="button"
        onClick={() =>
          onViewportChange?.({
            west: -74.02,
            south: 40.7,
            east: -74,
            north: 40.72
          })
        }
      >
        simulate lower manhattan viewport
      </button>
      {restaurants.map((restaurant) => (
        <button key={restaurant.id} type="button" onClick={() => onSelect(restaurant)}>
          marker {restaurant.name}
        </button>
      ))}
    </div>
  )
}));

const payload: RestaurantResponse = {
  city: "nyc",
  generatedAt: "2026-06-30T17:00:00.000Z",
  cacheTtlHours: 12,
  sourceCounts: { resy: 1, inkind: 0, both: 1, total: 2 },
  restaurants: [
    {
      id: "both:1",
      source: "both",
      sourceIds: { resy: 1, inkindLocationId: 2, inkindBrandId: 3 },
      name: "Le Gratin",
      latitude: 40.7116,
      longitude: -74.0068,
      neighborhood: "Lower Manhattan",
      cuisines: ["French"],
      tags: ["Dinner"],
      price: "$$$",
      sourceUrls: { resy: "https://resy.com/a", inkind: "https://le-gratin.inkind.com/" }
    },
    {
      id: "resy:4",
      source: "resy",
      sourceIds: { resy: 4 },
      name: "Sushi Ouji",
      latitude: 40.7266,
      longitude: -74.0027,
      cuisines: ["Japanese"],
      tags: [],
      price: "$$",
      sourceUrls: { resy: "https://resy.com/b" }
    }
  ]
};

function restaurantResponse(name: string, id: string): RestaurantResponse {
  return {
    city: "nyc",
    generatedAt: "2026-06-30T17:00:00.000Z",
    cacheTtlHours: 12,
    sourceCounts: { resy: 1, inkind: 0, both: 0, total: 1 },
    restaurants: [
      {
        id,
        source: "resy",
        sourceIds: { resy: Number(id.replace(/\D/g, "")) || 1 },
        name,
        latitude: 40.7116,
        longitude: -74.0068,
        cuisines: ["Test"],
        tags: [],
        price: "$$",
        sourceUrls: { resy: "https://resy.com/test" }
      }
    ]
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "geolocation");

function mockGeolocation(getCurrentPosition: Geolocation["getCurrentPosition"]) {
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition }
  });
}

function geolocationPosition(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    },
    timestamp: Date.now()
  } as GeolocationPosition;
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGeolocationDescriptor) {
    Object.defineProperty(window.navigator, "geolocation", originalGeolocationDescriptor);
  } else {
    Reflect.deleteProperty(window.navigator, "geolocation");
  }
});

test("renders map data and source links", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    })
  );

  render(<App />);

  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());
  expect(screen.getByTestId("map")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Resy" })).toHaveAttribute("href", "https://resy.com/a");
  expect(screen.getByRole("link", { name: "Open inKind" })).toHaveAttribute(
    "href",
    "https://app.inkind.com/purchase/le-gratin"
  );

  await userEvent.type(screen.getByPlaceholderText("Search restaurants, labels"), "sushi");
  expect(screen.getByRole("heading", { name: "Sushi Ouji" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Le Gratin/i })).not.toBeInTheDocument();
});

test("filters restaurants by price", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());

  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  await userEvent.click(within(screen.getByLabelText("Price filter")).getByRole("button", { name: "$$" }));

  expect(screen.getByRole("heading", { name: "Sushi Ouji" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Le Gratin/i })).not.toBeInTheDocument();
  expect(screen.getByText("1 shown")).toBeInTheDocument();
});

test("requests map focus when a restaurant is selected from the list", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());
  expect(screen.getByTestId("map")).toHaveAttribute("data-focus-id", "");

  await userEvent.click(within(screen.getByLabelText("Restaurants")).getByRole("button", { name: /Sushi Ouji/i }));

  expect(screen.getByRole("heading", { name: "Sushi Ouji" })).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-focus-id", "resy:4");
});

test("updates the restaurant list from the current map viewport", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());

  const list = screen.getByLabelText("Restaurants");
  expect(within(list).getByRole("button", { name: /Le Gratin/i })).toBeInTheDocument();
  expect(within(list).getByRole("button", { name: /Sushi Ouji/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "simulate lower manhattan viewport" }));

  expect(within(list).getByRole("button", { name: /Le Gratin/i })).toBeInTheDocument();
  expect(within(list).queryByRole("button", { name: /Sushi Ouji/i })).not.toBeInTheDocument();
  expect(screen.getByText("1 shown")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-restaurants", "Le Gratin|Sushi Ouji");
});

test("preserves the current map viewport when filters change", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());

  const list = screen.getByLabelText("Restaurants");
  await userEvent.click(screen.getByRole("button", { name: "simulate lower manhattan viewport" }));
  expect(within(list).queryByRole("button", { name: /Sushi Ouji/i })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  await userEvent.click(within(screen.getByLabelText("Price filter")).getByRole("button", { name: "$$" }));

  expect(within(list).queryByRole("button", { name: /Sushi Ouji/i })).not.toBeInTheDocument();
  expect(screen.getByText("No restaurants in the current map view.")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-restaurants", "Sushi Ouji");
});

test("uses browser location to move the map without filtering city restaurants", async () => {
  const cityPayload: RestaurantResponse = {
    city: "nyc",
    generatedAt: "2026-06-30T17:00:00.000Z",
    cacheTtlHours: 12,
    sourceCounts: { resy: 3, inkind: 0, both: 0, total: 3 },
    restaurants: [
      {
        id: "resy:midtown",
        source: "resy",
        sourceIds: { resy: 10 },
        name: "Midtown Meal",
        latitude: 40.726,
        longitude: -74.006,
        cuisines: ["American"],
        tags: [],
        price: "$$",
        sourceUrls: { resy: "https://resy.com/midtown" }
      },
      {
        id: "resy:far",
        source: "resy",
        sourceIds: { resy: 11 },
        name: "Far Uptown",
        latitude: 40.9,
        longitude: -74.006,
        cuisines: ["American"],
        tags: [],
        price: "$$",
        sourceUrls: { resy: "https://resy.com/far" }
      },
      {
        id: "resy:close",
        source: "resy",
        sourceIds: { resy: 12 },
        name: "Closer Cafe",
        latitude: 40.713,
        longitude: -74.006,
        cuisines: ["Cafe"],
        tags: [],
        price: "$",
        sourceUrls: { resy: "https://resy.com/close" }
      }
    ]
  };
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success(geolocationPosition(40.7128, -74.006));
  });
  mockGeolocation(getCurrentPosition as Geolocation["getCurrentPosition"]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => cityPayload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Midtown Meal" })).toBeInTheDocument());

  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));

  expect(screen.getByRole("heading", { name: "New York City Restaurant Map" })).toBeInTheDocument();
  expect(screen.getByText("3 shown")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-center", "40.7128,-74.006");
  expect(screen.getByTestId("map")).toHaveAttribute("data-viewport-center", "40.7128,-74.006");
  expect(screen.getByTestId("map")).toHaveAttribute("data-viewport-zoom", "14");
  expect(screen.getByTestId("map")).toHaveAttribute("data-fit-key", "");
  expect(screen.getByTestId("map")).toHaveAttribute("data-restaurants", "Midtown Meal|Far Uptown|Closer Cafe");

  await userEvent.click(screen.getByRole("button", { name: "simulate lower manhattan viewport" }));

  const list = screen.getByLabelText("Restaurants");
  expect(within(list).getByRole("button", { name: /Closer Cafe/i })).toBeInTheDocument();
  expect(within(list).queryByRole("button", { name: /Midtown Meal/i })).not.toBeInTheDocument();
  expect(within(list).queryByRole("button", { name: /Far Uptown/i })).not.toBeInTheDocument();
  expect(screen.getByText("1 shown")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-restaurants", "Midtown Meal|Far Uptown|Closer Cafe");
});

test("filters city restaurants after using browser location without moving the map again", async () => {
  const cityPayload: RestaurantResponse = {
    city: "nyc",
    generatedAt: "2026-06-30T17:00:00.000Z",
    cacheTtlHours: 12,
    sourceCounts: { resy: 2, inkind: 0, both: 0, total: 2 },
    restaurants: [
      {
        id: "resy:midtown",
        source: "resy",
        sourceIds: { resy: 10 },
        name: "Midtown Meal",
        latitude: 40.72,
        longitude: -74.006,
        cuisines: ["American"],
        tags: [],
        price: "$$",
        sourceUrls: { resy: "https://resy.com/midtown" }
      },
      {
        id: "resy:close",
        source: "resy",
        sourceIds: { resy: 12 },
        name: "Closer Cafe",
        latitude: 40.713,
        longitude: -74.006,
        cuisines: ["Cafe"],
        tags: [],
        price: "$",
        sourceUrls: { resy: "https://resy.com/close" }
      }
    ]
  };
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success(geolocationPosition(40.7128, -74.006));
  });
  mockGeolocation(getCurrentPosition as Geolocation["getCurrentPosition"]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => cityPayload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Midtown Meal" })).toBeInTheDocument());

  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(screen.getByRole("heading", { name: "New York City Restaurant Map" })).toBeInTheDocument();
  const fitKeyBeforeFilter = screen.getByTestId("map").getAttribute("data-fit-key");
  const viewportCenterBeforeFilter = screen.getByTestId("map").getAttribute("data-viewport-center");

  await userEvent.click(screen.getByRole("button", { name: "Filters" }));
  await userEvent.click(within(screen.getByLabelText("Price filter")).getByRole("button", { name: "$$" }));

  expect(screen.getByRole("heading", { name: "Midtown Meal" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Closer Cafe/i })).not.toBeInTheDocument();
  expect(screen.getByText("1 shown")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-restaurants", "Midtown Meal");
  expect(screen.getByTestId("map")).toHaveAttribute("data-fit-key", fitKeyBeforeFilter);
  expect(screen.getByTestId("map")).toHaveAttribute("data-viewport-center", viewportCenterBeforeFilter);
});

test("shows a message when browser geolocation fails", async () => {
  const getCurrentPosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
    error?.({ code: 1 } as GeolocationPositionError);
  });
  mockGeolocation(getCurrentPosition as Geolocation["getCurrentPosition"]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());

  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));

  expect(screen.getByText("Location permission was denied. Enable location access and try again.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "New York City Restaurant Map" })).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-center", "40.7128,-74.006");
});

test("switching cities clears a location viewport request", async () => {
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success(geolocationPosition(40.7128, -74.006));
  });
  mockGeolocation(getCurrentPosition as Geolocation["getCurrentPosition"]);
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => payload
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...restaurantResponse("LA Spot", "resy:20"),
        city: "la" as const
      })
    });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(screen.getByTestId("map")).toHaveAttribute("data-viewport-center", "40.7128,-74.006");

  await userEvent.click(screen.getByRole("button", { name: /Change city/i }));
  await userEvent.click(screen.getByRole("button", { name: /Los Angeles/i }));

  await waitFor(() => expect(screen.getByRole("heading", { name: "LA Spot" })).toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "Los Angeles Restaurant Map" })).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-center", "34.0522,-118.2437");
  expect(screen.getByTestId("map")).toHaveAttribute("data-viewport-center", "");
});

test("searches and switches supported cities", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => payload
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...restaurantResponse("LA Spot", "resy:20"),
        city: "la" as const
      })
    });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());

  await userEvent.click(screen.getByRole("button", { name: /Change city/i }));
  await userEvent.type(screen.getByLabelText("Search cities"), "los");
  expect(screen.getByRole("button", { name: /Los Angeles/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Chicago/i })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /Los Angeles/i }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "LA Spot" })).toBeInTheDocument());

  expect(screen.getByRole("heading", { name: "Los Angeles Restaurant Map" })).toBeInTheDocument();
  expect(String(fetchMock.mock.calls[0][0])).toContain("city=nyc");
  expect(String(fetchMock.mock.calls[1][0])).toContain("city=la");
});

test("moves the map to the clicked city before new restaurant data resolves", async () => {
  const laLoad = deferred<{ ok: boolean; json: () => Promise<RestaurantResponse> }>();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => payload
    })
    .mockReturnValueOnce(laLoad.promise);
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());

  await userEvent.click(screen.getByRole("button", { name: /Change city/i }));
  await userEvent.click(screen.getByRole("button", { name: /Los Angeles/i }));

  expect(screen.getByRole("heading", { name: "Los Angeles Restaurant Map" })).toBeInTheDocument();
  expect(screen.getByTestId("map")).toHaveAttribute("data-center", "34.0522,-118.2437");
  expect(screen.getByTestId("map")).toHaveAttribute("data-restaurants", "");

  laLoad.resolve({
    ok: true,
    json: async () => ({
      ...restaurantResponse("LA Spot", "resy:20"),
      city: "la" as const
    })
  });
  await waitFor(() => expect(screen.getByRole("heading", { name: "LA Spot" })).toBeInTheDocument());
});

test("does not let a slower stale load overwrite a newer reload", async () => {
  const initial = deferred<{ ok: boolean; json: () => Promise<RestaurantResponse> }>();
  const reload = deferred<{ ok: boolean; json: () => Promise<RestaurantResponse> }>();
  const fetchMock = vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(reload.promise);
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Reload/i }));

  reload.resolve({
    ok: true,
    json: async () => restaurantResponse("Refreshed Result", "resy:20")
  });
  await waitFor(() => expect(screen.getByRole("heading", { name: "Refreshed Result" })).toBeInTheDocument());

  initial.resolve({
    ok: true,
    json: async () => restaurantResponse("Stale Result", "resy:10")
  });
  await Promise.resolve();

  expect(screen.getByRole("heading", { name: "Refreshed Result" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Stale Result" })).not.toBeInTheDocument();
  expect(String(fetchMock.mock.calls[1][0])).not.toContain("refresh=true");
});

test("does not render unsafe external source urls", async () => {
  const unsafePayload: RestaurantResponse = {
    ...payload,
    sourceCounts: { resy: 0, inkind: 0, both: 1, total: 1 },
    restaurants: [
      {
        ...payload.restaurants[0],
        sourceUrls: {
          resy: "javascript:alert(1)",
          inkind: "https://example.com/not-inkind"
        }
      }
    ]
  };

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => unsafePayload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Le Gratin" })).toBeInTheDocument());

  expect(screen.queryByRole("link", { name: "Open Resy" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Open inKind" })).not.toBeInTheDocument();
});

test("virtualizes the restaurant list while preserving the shown count", async () => {
  const restaurants = Array.from({ length: 251 }, (_, index) => ({
    id: `resy:${index + 1}`,
    source: "resy" as const,
    sourceIds: { resy: index + 1 },
    name: `Place ${String(index + 1).padStart(3, "0")}`,
    latitude: 40.7 + index * 0.0001,
    longitude: -74,
    cuisines: ["Test"],
    tags: [],
    sourceUrls: { resy: `https://resy.com/place-${index + 1}` }
  }));
  const largePayload: RestaurantResponse = {
    city: "nyc",
    generatedAt: "2026-06-30T17:00:00.000Z",
    cacheTtlHours: 12,
    sourceCounts: { resy: 251, inkind: 0, both: 0, total: 251 },
    restaurants
  };

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => largePayload
    })
  );

  render(<App />);
  await waitFor(() => expect(screen.getByText("251 shown")).toBeInTheDocument());

  const list = screen.getByLabelText("Restaurants");
  const mountedRows = within(list).getAllByRole("button");
  expect(mountedRows.length).toBeGreaterThan(0);
  expect(mountedRows.length).toBeLessThan(251);
  expect(within(list).getByRole("button", { name: /Place 001/i })).toBeInTheDocument();

  list.scrollTop = 240 * 60;
  fireEvent.scroll(list);

  await waitFor(() => expect(within(list).getByRole("button", { name: /Place 241/i })).toBeInTheDocument());
});
