import { expect, test } from "vitest";
import type { Restaurant } from "../shared/types";
import { restaurantLabels } from "../shared/labels";
import { filterRestaurants, filterRestaurantsByBounds, inKindAppUrl, topTags } from "./appUtils";

function restaurant(overrides: Partial<Restaurant>): Restaurant {
  return {
    id: "test:1",
    source: "inkind",
    sourceIds: { inkindLocationId: 1, inkindBrandId: 1 },
    name: "Test Restaurant",
    latitude: 40,
    longitude: -74,
    cuisines: [],
    tags: [],
    sourceUrls: {},
    ...overrides
  };
}

test("deduplicates restaurant labels across cuisines and tags", () => {
  expect(
    restaurantLabels(
      restaurant({
        cuisines: ["Cafe", "Bakery"],
        tags: ["Cafe", "cafe", "Outdoor Seating"]
      })
    )
  ).toEqual(["Cafe", "Bakery", "Outdoor Seating"]);
});

test("counts each label once per restaurant for top label filters", () => {
  const filters = topTags(
    [
      restaurant({ id: "test:1", cuisines: ["Cafe"], tags: ["Cafe", "Dinner"] }),
      restaurant({ id: "test:2", cuisines: ["Dinner"], tags: [] })
    ],
    2
  );

  expect(filters).toEqual(["Dinner", "Cafe"]);
});

test("filters restaurants by selected prices", () => {
  const restaurants = [
    restaurant({ id: "test:1", name: "Budget Cafe", price: "$" }),
    restaurant({ id: "test:2", name: "Mid Cafe", price: "$$" }),
    restaurant({ id: "test:3", name: "Special Dinner", price: "$$$" }),
    restaurant({ id: "test:4", name: "Unknown Price" })
  ];

  expect(filterRestaurants(restaurants, "", "all", [], ["$$", "$$$"]).map((item) => item.name)).toEqual([
    "Mid Cafe",
    "Special Dinner"
  ]);
});

test("filters restaurants by map bounds", () => {
  const restaurants = [
    restaurant({ id: "test:1", name: "Inside", latitude: 40.71, longitude: -74.01 }),
    restaurant({ id: "test:2", name: "North", latitude: 40.75, longitude: -74.01 }),
    restaurant({ id: "test:3", name: "West", latitude: 40.71, longitude: -74.08 })
  ];

  expect(
    filterRestaurantsByBounds(restaurants, {
      west: -74.03,
      south: 40.7,
      east: -74,
      north: 40.72
    }).map((item) => item.name)
  ).toEqual(["Inside"]);
});

test("keeps inKind app purchase links", () => {
  expect(
    inKindAppUrl(
      restaurant({
        sourceUrls: { inkind: "https://app.inkind.com/purchase/le-gratin" }
      })
    )
  ).toBe("https://app.inkind.com/purchase/le-gratin");
});

test("rewrites legacy inKind purchase subdomains to slugged app links", () => {
  expect(
    inKindAppUrl(
      restaurant({
        sourceIds: { inkindLocationId: 44, inkindBrandId: 12 },
        sourceUrls: { inkind: "https://le-gratin.inkind.com/" }
      })
    )
  ).toBe("https://app.inkind.com/purchase/le-gratin");
});

test("does not create inKind app links from unsafe source urls", () => {
  expect(
    inKindAppUrl(
      restaurant({
        sourceUrls: { inkind: "https://example.com/not-inkind" }
      })
    )
  ).toBeUndefined();
});
