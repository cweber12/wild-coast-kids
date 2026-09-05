import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readLatestWaves = vi.fn();
const readLatestAir = vi.fn();
vi.mock("@/lib/conditions", () => ({ readLatestWaves, readLatestAir }));

const { MeasuredPanel } = await import("./MeasuredPanel");

const WAVES = {
  beachName: "La Jolla Shores Beach",
  buoy: { name: "Scripps Nearshore", distanceM: 1400 },
  state: {
    kind: "reading",
    heightFt: 2.62,
    periodS: 5,
    directionDegT: 278,
    waterTempF: 69.98,
    observedAtMs: Date.UTC(2026, 7, 17, 18, 13),
  },
};

const AIR = {
  beachName: "La Jolla Shores Beach",
  airStation: { name: "Scripps Pier", distanceM: 1_381 },
  air: {
    kind: "reading",
    airTempF: 71.42,
    windMph: 8.05,
    gustMph: null,
    windDirDegT: 320,
    observedAtMs: Date.UTC(2026, 7, 17, 17, 48),
  },
};

beforeEach(() => {
  readLatestWaves.mockReset();
  readLatestAir.mockReset();
  readLatestWaves.mockResolvedValue(WAVES);
  readLatestAir.mockResolvedValue(AIR);
});

test("asks both instruments for the slug it was given", async () => {
  render(await MeasuredPanel({ slug: "la-jolla-shores-beach" }));

  expect(readLatestWaves).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(readLatestAir).toHaveBeenCalledWith("la-jolla-shores-beach");
});

test("renders both readings, not one", async () => {
  // Reachable by a reader rather than merely fetched: a panel that dropped one
  // read would still render and still resolve.
  render(await MeasuredPanel({ slug: "la-jolla-shores-beach" }));

  // Both segments, from two networks. The air figures now set in one run with
  // the wind, so this matches the segment rather than a lone figure.
  expect(screen.getByText(/2\.6 ft/)).toBeDefined();
  expect(screen.getByText(/71°F/)).toBeDefined();
});

test("it is today's block, so the absence sentence never appears here", async () => {
  // This band is only ever mounted on today, outside SelectedDayProvider, so
  // there is no day in scope to apologise for.
  render(await MeasuredPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.queryByText(/Nothing has been measured/)).toBeNull();
});

test("a quiet buoy costs its own card and not the air beside it", async () => {
  // Two networks, two failure modes. Neither read throws -- each returns its
  // own state -- so one going quiet can delay the block but never empty it.
  readLatestWaves.mockResolvedValue({
    ...WAVES,
    state: {
      kind: "unavailable",
      detail: "NDBC 46254 returns 404.",
      drift: false,
    },
  });

  render(await MeasuredPanel({ slug: "la-jolla-shores-beach" }));

  // The wave segment goes rather than turning into a sentence -- the band
  // reports what was measured, and the explanation for a missing wave figure
  // now hangs off the modelled height standing in for it (ADR-0055).
  expect(screen.queryByText(/2\.6 ft/)).toBeNull();
  // The air is untouched, which is the property this test is really about.
  expect(screen.getByText(/71°F/)).toBeDefined();
});

test("a quiet air station costs its own card and not the buoy beside it", async () => {
  readLatestAir.mockResolvedValue({
    ...AIR,
    air: {
      kind: "unavailable",
      detail: "NDBC LJAC1 returns 404 for realtime2.",
      drift: false,
    },
  });

  render(await MeasuredPanel({ slug: "la-jolla-shores-beach" }));

  // Air is the one source that speaks without a figure: all 51 beaches bind a
  // station, so an absence is an outage rather than a fact about the place, and
  // CLAUDE.md refuses to let it fail silently. It names the station.
  expect(
    screen.getByText(/Scripps Pier is not answering just now/),
  ).toBeDefined();
  expect(screen.getByText(/2\.6 ft/)).toBeDefined();
});

test("a failure to resolve the beach is not swallowed into a rendered nothing", async () => {
  // Both reads throw only when the slug is not in the inventory, which is a
  // coding error rather than a quiet feed, and must not be caught here.
  readLatestWaves.mockRejectedValue(
    new Error("readLatestWaves: no beach in the inventory"),
  );

  await expect(MeasuredPanel({ slug: "not-a-beach" })).rejects.toThrow(
    /no beach in the inventory/,
  );
});

/**
 * A withheld product is not read, which is the half of ADR-0048 this seam owns.
 *
 * What it no longer does is render a sentence about it. The band reports what
 * was measured, so a withheld wave product contributes no segment (ADR-0056) --
 * and the sentence `withheldWords` builds is asserted against real
 * `areaSources` data in `areaScope.test.ts`, which is where the counting bug it
 * guarded actually lived: nine of La Jolla's ten beaches read buoy 46254 and
 * one reads none, which is one source and a gap rather than "2 different
 * sources".
 */
test("a withheld product is not read at all", async () => {
  const { areaBySlug, areaSources } = await import("@/lib/areas");
  const { scopeFor } = await import("./areaScope");
  const area = areaBySlug("la-jolla")!;

  // The probe. If La Jolla ever shares a buoy, this test is asserting nothing
  // and should be pointed at whichever area still has the gap.
  expect(areaSources(area).waves.kind).toBe("mixed");

  render(
    await MeasuredPanel({
      slug: "la-jolla-shores-beach",
      area: scopeFor(area),
    }),
  );

  // There is nothing an area could do with one beach's buoy, and asking would
  // spend a reader's wait on a figure the page has already decided not to print.
  expect(readLatestWaves).not.toHaveBeenCalled();
  // Air is shared by all eighteen areas, so the band still speaks.
  expect(screen.getByText(/71°F/)).toBeDefined();
});
