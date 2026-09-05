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

  expect(screen.getByText("2.6 ft")).toBeDefined();
  expect(screen.getByText("71°F")).toBeDefined();
});

test("it is today's block, so the absence sentence never appears here", async () => {
  // `MeasuredPanel` is only ever mounted on today. The other six days get
  // `MeasuredToday` with no readings, from `DayPanel`, without a request.
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

  expect(screen.getByText(/could not get a wave reading/)).toBeDefined();
  expect(screen.getByText("71°F")).toBeDefined();
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

  expect(screen.getByText("No temperature just now")).toBeDefined();
  expect(screen.getByText("2.6 ft")).toBeDefined();
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
 * The withheld card's sentence, against what `areaSources` really returns.
 *
 * Every other assertion about that card hands `MeasuredToday` a hand-written
 * `NotShared`, so it can only ever check that the component renders the numbers
 * it was given. That is how `/conditions/la-jolla` came to say "The 10 beaches
 * in La Jolla read 2 different sources for a wave reading" with a passing test
 * over it: nine read buoy 46254 and `childrens-pool` reads none, and the
 * fixture said 2 because a `null` had been counted as a source.
 *
 * So this one builds the scope the way the page does -- from `areaSources` over
 * committed data -- and reads the sentence off the rendered card. Both operands
 * are not the same source: the left is the component's output and the right is
 * what La Jolla's ten beaches actually bind.
 */
test("a withheld card states what the area's beaches really bind", async () => {
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

  expect(
    screen.getByText(
      /Only 9 of the 10 beaches in La Jolla have a wave reading, and they share one source/,
    ),
  ).toBeDefined();
  expect(screen.queryByText(/different sources/)).toBeNull();

  // And the withheld product was not read, which is the other half of the
  // contract: there is nothing an area could do with one beach's buoy.
  expect(readLatestWaves).not.toHaveBeenCalled();
});
