import { expect, test } from "vitest";
import type { Restaurant } from "../shared/types";
import { restaurantLabels } from "../shared/labels";
import { filterRestaurants, topTags } from "./appUtils";

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
