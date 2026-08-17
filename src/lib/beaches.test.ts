import { expect, test } from "vitest";
import {
  allBeaches,
  beachBySlug,
  inventoryCaveats,
  tideStationFor,
} from "./beaches";

test("the inventory holds the seeded beach", () => {
  const beaches = allBeaches();
  expect(beaches).toHaveLength(1);
  expect(beaches[0].slug).toBe("la-jolla-shores");
  expect(beaches[0].name).toBe("La Jolla Shores Beach");
});

test("a beach is a segment, so both endpoints are present and distinct", () => {
  const beach = beachBySlug("la-jolla-shores")!;
  expect(beach.segment.upper).not.toEqual(beach.segment.lower);
  for (const end of [beach.segment.upper, beach.segment.lower]) {
    expect(typeof end.lat).toBe("number");
    expect(typeof end.lon).toBe("number");
    expect(end.lon).toBeLessThan(0);
  }
});

test("upstream values are reproduced, including the unknown one", () => {
  const beach = beachBySlug("la-jolla-shores")!;
  expect(beach.upstream.usepa_id).toBe("CA876094");
  expect(beach.upstream.water_body_type).toBe("Open Coast");
  expect(beach.upstream.beach_access).toBe("PUBLIC");
  // Upstream publishes UNKNOWN here. It is kept as published so that nothing can
  // quietly turn a gap in the resource into a claim about the shore.
  expect(beach.upstream.beach_type).toBe("UNKNOWN");
});

test("an unknown slug is null rather than a throw", () => {
  expect(beachBySlug("no-such-beach")).toBeNull();
});

test("the tide station resolves with its role", () => {
  const station = tideStationFor(beachBySlug("la-jolla-shores")!);
  expect(station.id).toBe("9410230");
  expect(station.name).toContain("La Jolla");
  // An open-coast beach must not be reading the bay-side station.
  expect(station.role).toBe("open coast");
});

test("a beach naming an undescribed station is a broken data file, and says so", () => {
  const beach = { ...beachBySlug("la-jolla-shores")!, tide_station: "9999999" };
  expect(() => tideStationFor(beach)).toThrow(/no entry under tide_stations/);
});

test("the inventory's caveats are readable, so they can be rendered", () => {
  const caveats = inventoryCaveats();
  expect(caveats.length).toBeGreaterThan(0);
  for (const caveat of caveats) {
    expect(typeof caveat).toBe("string");
    expect(caveat.length).toBeGreaterThan(0);
  }
});
