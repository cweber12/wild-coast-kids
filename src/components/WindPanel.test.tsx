import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readLatestAir = vi.fn();
vi.mock("@/lib/conditions", () => ({ readLatestAir }));

const { WindPanel } = await import("./WindPanel");

beforeEach(() => {
  readLatestAir.mockReset();
});

test("asks for the slug it was given and renders the reading", async () => {
  readLatestAir.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    airStation: { name: "Scripps Pier, La Jolla", distanceM: 1_381 },
    skyStation: { name: "San Diego, Miramar MCAS", distanceM: 10_429 },
    air: {
      kind: "reading",
      airTempF: 71.42,
      windMph: 8.05,
      gustMph: null,
      windDirDegT: 320,
    },
    sky: {
      kind: "reading",
      visibilityMi: 10,
      visibilityAtCeiling: true,
      sky: "Clear",
    },
  });

  render(await WindPanel({ slug: "la-jolla-shores-beach" }));

  expect(readLatestAir).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("71°F")).toBeDefined();
  // Both provenances reach the rendered panel through this seam, not just one.
  expect(screen.getByText(/Scripps Pier/)).toBeDefined();
  expect(screen.getByText(/Miramar MCAS/)).toBeDefined();
});

test("the beach with no station renders its own state, not an outage", async () => {
  readLatestAir.mockResolvedValue({
    beachName: "Imperial Beach pier area",
    airStation: null,
    skyStation: null,
    air: {
      kind: "no-station",
      reason:
        "the lower endpoint published upstream is outside San Diego County",
    },
    sky: {
      kind: "no-station",
      reason:
        "the lower endpoint published upstream is outside San Diego County",
    },
  });

  render(await WindPanel({ slug: "imperial-beach-pier-area" }));

  expect(screen.getByText("No station near enough")).toBeDefined();
  expect(screen.getAllByText(/outside San Diego County/).length).toBe(2);
});
