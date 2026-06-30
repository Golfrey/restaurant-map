import { describe, expect, test } from "vitest";
import type { Restaurant } from "../shared/types";
import type { CityConfig } from "../server/config";
import { dedupeRestaurants, nameSimilarity } from "../server/dedupe";
import { normalizeInKindLocation, normalizeResyHit } from "../server/normalizers";
import inKindFixture from "./fixtures/inkind-map.json";
import resyFixture from "./fixtures/resy-search.json";

const city: CityConfig = {
  code: "nyc",
  name: "New York City",
  state: "NY",
  center: { latitude: 40.7128, longitude: -74.006 },
  radiusMiles: 15
};

test("normalizes a Resy search hit", () => {
  const restaurant = normalizeResyHit(resyFixture.search.hits[0], city);
  expect(restaurant).toMatchObject({
    source: "resy",
    sourceIds: { resy: 60029 },
    name: "Le Gratin",
    cuisines: ["French"],
    price: "$$"
  });
  expect(restaurant?.sourceUrls.resy).toContain("/cities/new-york-ny/venues/le-gratin");
});

test("normalizes and filters inKind map locations", () => {
  const tagsById = new Map(inKindFixture.tags.map((tag) => [tag.id, tag]));
  const brand = inKindFixture.brands[0];
  const restaurant = normalizeInKindLocation(inKindFixture.locations[0], brand, tagsById, city);
  expect(restaurant).toMatchObject({
    source: "inkind",
    sourceIds: { inkindLocationId: 44, inkindBrandId: 12 },
    name: "Le Gratin",
    cuisines: ["French"],
    tags: ["French", "Newly Added"],
    price: "$$"
  });
});

describe("dedupeRestaurants", () => {
  test("merges same-name restaurants close together", () => {
    const resy = normalizeResyHit(resyFixture.search.hits[0], city) as Restaurant;
    const tagsById = new Map(inKindFixture.tags.map((tag) => [tag.id, tag]));
    const inkind = normalizeInKindLocation(inKindFixture.locations[0], inKindFixture.brands[0], tagsById, city) as Restaurant;

    const merged = dedupeRestaurants([resy], [inkind]);

    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("both");
    expect(merged[0].sourceUrls).toMatchObject({
      resy: expect.stringContaining("resy.com"),
      inkind: expect.stringContaining("inkind.com")
    });
  });

  test("uses fuzzy name similarity", () => {
    expect(nameSimilarity("Sushi Ouji", "Sushi Ouji NYC")).toBeGreaterThan(0.88);
  });
});
