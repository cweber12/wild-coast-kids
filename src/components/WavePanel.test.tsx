import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readLatestWaves = vi.fn();
const readWaveWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({ readLatestWaves, readWaveWeek }));

const { WavePanel } = await import("./WavePanel");

const READING = {
  beachName: "La Jolla Shores Beach",
  buoy: { name: "Scripps Nearshore", distanceM: 1400 },
  state: {
    kind: "reading",
    heightFt: 2.62,
    periodS: 5,
    directionDegT: 278,
    waterTempF: 69.98,
  },
};

const LINE = { id: "D0498", distanceM: 325 };

const day = (localDate: string, isToday: boolean, timeLabel: string) => ({
  localDate,
  dayLabel: localDate,
  isToday,
  timeLabel,
  heightFt: 0.8,
  periodS: 6.25,
});

beforeEach(() => {
  readLatestWaves.mockReset();
  readWaveWeek.mockReset();
  readWaveWeek.mockResolvedValue({
    beachName: READING.beachName,
    line: LINE,
    state: {
      kind: "week",
      days: [
        day("2026-08-26", true, "11:00 AM"),
        day("2026-08-27", false, "2:00 PM"),
      ],
    },
  });
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

test("both publishers are asked, and today's peak is the one shown", async () => {
  // The card answers "what is it doing", so the forecast beside it is today's
  // column and not a second, differently-chosen figure.
  readLatestWaves.mockResolvedValue(READING);

  render(await WavePanel({ slug: "la-jolla-shores-beach" }));

  expect(readWaveWeek).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("11:00 AM")).toBeDefined();
  expect(screen.queryByText("2:00 PM")).toBeNull();
});

test("a week that does not reach today leaves the card with no forecast", async () => {
  // The horizon is tight, and a forecast rerun that slips can start tomorrow.
  // Nothing is said here: the week grid below carries the row and the note.
  readLatestWaves.mockResolvedValue(READING);
  readWaveWeek.mockResolvedValue({
    beachName: READING.beachName,
    line: LINE,
    state: { kind: "week", days: [day("2026-08-27", false, "2:00 PM")] },
  });

  render(await WavePanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText("2.6 ft")).toBeDefined();
  expect(screen.queryByText(/MOP line/)).toBeNull();
});

test("a CDIP outage costs the forecast block and nothing else", async () => {
  readLatestWaves.mockResolvedValue(READING);
  readWaveWeek.mockResolvedValue({
    beachName: READING.beachName,
    line: LINE,
    state: {
      kind: "unavailable",
      detail: "CDIP returned HTTP 503 for MOP line D0498.",
      drift: false,
    },
  });

  render(await WavePanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText("2.6 ft")).toBeDefined();
  expect(screen.getByText(/NDBC/)).toBeDefined();
  expect(screen.queryByText(/Forecast today/)).toBeNull();
});

test("a bay beach gets neither half, and is not told twice", async () => {
  readLatestWaves.mockResolvedValue({
    beachName: "Mission Bay",
    buoy: null,
    state: { kind: "no-buoy", reason: "swell does not reach here" },
  });
  readWaveWeek.mockResolvedValue({
    beachName: "Mission Bay",
    line: null,
    state: { kind: "no-line", reason: "swell does not reach here" },
  });

  render(await WavePanel({ slug: "mission-bay" }));

  expect(screen.getByText(/what we expect rather than a fault/)).toBeDefined();
  expect(screen.queryByText(/MOP line/)).toBeNull();
});
