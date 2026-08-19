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
    station: { name: "San Diego, Miramar MCAS", distanceM: 10_429 },
    state: {
      kind: "reading",
      visibilityMi: 10,
      visibilityAtCeiling: true,
      airTempF: 69.98,
      windMph: 5.82,
      gustMph: null,
      windDirDegT: 320,
      sky: "Clear",
    },
  });

  render(await WindPanel({ slug: "la-jolla-shores-beach" }));

  expect(readLatestAir).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("70°F")).toBeDefined();
});

test("the beach with no station renders its own state, not an outage", async () => {
  readLatestAir.mockResolvedValue({
    beachName: "Imperial Beach pier area",
    station: null,
    state: {
      kind: "no-station",
      reason:
        "the lower endpoint published upstream is outside San Diego County",
    },
  });

  render(await WindPanel({ slug: "imperial-beach-pier-area" }));

  expect(screen.getByText(/gap in what is published/)).toBeDefined();
});
