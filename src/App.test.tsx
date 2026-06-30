import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import type { RestaurantResponse } from "../shared/types";
import App from "./App";

vi.mock("./MapView", () => ({
  MapView: ({ restaurants, onSelect }: any) => (
    <div data-testid="map">
      {restaurants.map((restaurant: any) => (
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
      sourceUrls: { resy: "https://resy.com/a", inkind: "https://inkind.com/a" }
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

afterEach(() => {
  vi.unstubAllGlobals();
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
  expect(screen.getByRole("link", { name: "Open inKind" })).toHaveAttribute("href", "https://inkind.com/a");

  await userEvent.type(screen.getByPlaceholderText("Search restaurants, cuisines, tags"), "sushi");
  expect(screen.getByRole("heading", { name: "Sushi Ouji" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Le Gratin/i })).not.toBeInTheDocument();
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

  await userEvent.type(screen.getByLabelText("Search cities"), "los");
  expect(screen.getByRole("button", { name: /Los Angeles/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Chicago/i })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /Los Angeles/i }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "LA Spot" })).toBeInTheDocument());

  expect(screen.getByRole("heading", { name: "Los Angeles Restaurant Map" })).toBeInTheDocument();
  expect(String(fetchMock.mock.calls[0][0])).toContain("city=nyc");
  expect(String(fetchMock.mock.calls[1][0])).toContain("city=la");
});

test("does not let a slower stale load overwrite a newer refresh", async () => {
  const initial = deferred<{ ok: boolean; json: () => Promise<RestaurantResponse> }>();
  const refresh = deferred<{ ok: boolean; json: () => Promise<RestaurantResponse> }>();
  vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(refresh.promise));

  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Refresh/i }));

  refresh.resolve({
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

test("renders the full filtered list consistently with the shown count", async () => {
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
  expect(within(list).getAllByRole("button")).toHaveLength(251);
});
