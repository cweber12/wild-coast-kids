import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readTodaysLowestLow = vi.fn();
vi.mock("@/lib/conditions", () => ({ readTodaysLowestLow }));

const { TidePanel } = await import("./TidePanel");

const BINDING = {
  beachName: "La Jolla Shores Beach",
  station: {
    name: "La Jolla (Scripps Institution Wharf)",
    water: "open-coast",
    distanceM: 1369,
  },
};

beforeEach(() => {
  readTodaysLowestLow.mockReset();
});

test("asks for the slug it was given and renders the reading", async () => {
  readTodaysLowestLow.mockResolvedValue({
    ...BINDING,
    state: { kind: "reading", timeLabel: "6:24 AM", feet: 1.368 },
  });

  render(await TidePanel({ slug: "la-jolla-shores-beach" }));

  expect(readTodaysLowestLow).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("6:24 AM")).toBeDefined();
  expect(screen.getByText("1.4 ft")).toBeDefined();
  expect(screen.getByText(/Above the average low tide/)).toBeDefined();
});

test("an unavailable reading reaches the reader as words, not a blank", async () => {
  readTodaysLowestLow.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "unavailable",
      detail: "NOAA returned HTTP 503 for station 9410230.",
      drift: false,
    },
  });

  render(await TidePanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText(/Nothing is wrong with the beach/)).toBeDefined();
  expect(
    screen.getByText("NOAA returned HTTP 503 for station 9410230."),
  ).toBeDefined();
});

test("a beach with no station renders its own state, not an outage", async () => {
  readTodaysLowestLow.mockResolvedValue({
    beachName: "Imperial Beach pier area",
    station: null,
    state: { kind: "no-station", reason: "upstream coordinates are unusable" },
  });

  render(await TidePanel({ slug: "imperial-beach-pier-area" }));

  expect(
    screen.getByText(/No tide station could be matched to it/),
  ).toBeDefined();
  expect(screen.queryByText(/try again shortly/)).toBeNull();
});

test("a failure to resolve the beach is not swallowed into a rendered nothing", async () => {
  readTodaysLowestLow.mockRejectedValue(new Error("no beach in the inventory"));

  await expect(TidePanel({ slug: "no-such-beach" })).rejects.toThrow(
    /no beach in the inventory/,
  );
});
