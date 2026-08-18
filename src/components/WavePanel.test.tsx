import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readLatestWaves = vi.fn();
vi.mock("@/lib/conditions", () => ({ readLatestWaves }));

const { WavePanel } = await import("./WavePanel");

beforeEach(() => {
  readLatestWaves.mockReset();
});

test("asks for the slug it was given and renders the reading", async () => {
  readLatestWaves.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    buoy: { name: "Scripps Nearshore", distanceM: 1400 },
    state: {
      kind: "reading",
      heightFt: 2.62,
      periodS: 5,
      directionDegT: 278,
      waterTempF: 69.98,
    },
  });

  render(await WavePanel({ slug: "la-jolla-shores-beach" }));

  expect(readLatestWaves).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("2.6 ft")).toBeDefined();
});

test("a bay beach renders its own state, not an outage", async () => {
  readLatestWaves.mockResolvedValue({
    beachName: "Agua Hedionda Lagoon",
    buoy: null,
    state: { kind: "no-buoy", reason: "swell does not reach here" },
  });

  render(await WavePanel({ slug: "agua-hedionda-lagoon" }));

  expect(screen.getByText(/what we expect rather than a fault/)).toBeDefined();
});
