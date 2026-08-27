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
    air: {
      kind: "reading",
      airTempF: 71.42,
      windMph: 8.05,
      gustMph: null,
      windDirDegT: 320,
    },
  });

  render(await WindPanel({ slug: "la-jolla-shores-beach" }));

  expect(readLatestAir).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("71°F")).toBeDefined();
  // Both provenances reach the rendered panel through this seam, not just one.
  expect(screen.getByText(/Scripps Pier/)).toBeDefined();
  // No second station on this card since ADR-0020: the airport that supplied
  // sky and visibility is not read at all any more.
  expect(screen.queryByText(/Miramar MCAS/)).toBeNull();
});

test("the beach with no station renders its own state, not an outage", async () => {
  readLatestAir.mockResolvedValue({
    beachName: "Imperial Beach pier area",
    airStation: null,
    air: {
      kind: "no-station",
      reason:
        "the lower endpoint published upstream is outside San Diego County",
    },
  });

  render(await WindPanel({ slug: "imperial-beach-pier-area" }));

  expect(screen.getByText("No station near enough")).toBeDefined();
  // One disclosure now, not two: the sky half had a no-station disclosure of
  // its own and it went with the half.
  expect(screen.getAllByText(/outside San Diego County/).length).toBe(1);
});
