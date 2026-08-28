import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { localMidnightOf } from "@/lib/pacific-time";

const readSkyWording = vi.fn();
const readDaylightWeek = vi.fn();
const readHourlyTide = vi.fn();
const readSkyWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({
  readSkyWording,
  readDaylightWeek,
  readHourlyTide,
  readSkyWeek,
}));

const { DayPanel } = await import("./DayPanel");

const CELL = { id: "SGX/54,21", elevationM: 0 };
const HOUR = 3_600_000;
const TODAY = "2026-08-17";
const TOMORROW = "2026-08-18";

const BINDING = {
  beachName: "La Jolla Shores Beach",
  station: {
    name: "La Jolla (Scripps Institution Wharf)",
    water: "open-coast",
    distanceM: 1369,
  },
};

/** 2 PM Pacific on the 17th, which is inside that day and easy to place. */
const NOW = localMidnightOf(TODAY) + 14 * HOUR;

/**
 * The daylight read, whose first day is today by construction -- `weekOfDays`
 * builds its array from today outward -- and which carries the instant it was
 * computed from. Both are load-bearing here: the first decides which day the
 * panel shows, the second is where the chart's "now" line is drawn.
 */
function daylight(dates: string[], atMs = NOW) {
  readDaylightWeek.mockReturnValue({
    beachName: BINDING.beachName,
    atMs,
    days: dates.map((localDate, index) => ({
      localDate,
      dayLabel: "Mon, Aug 17",
      dateLabel: "Mon, Aug 17",
      isToday: index === 0,
      sunriseLabel: "6:14 AM",
      sunsetLabel: "7:32 PM",
      sunriseMs: localMidnightOf(localDate) + 6 * HOUR + 14 * 60_000,
      sunsetMs: localMidnightOf(localDate) + 19 * HOUR + 32 * 60_000,
    })),
  });
}

/** A day of hourly heights that rises and falls, so a curve has somewhere to go. */
function hoursOn(localDate: string, offset = 0) {
  return {
    localDate,
    dayLabel: "Mon, Aug 17",
    dateLabel: "Mon, Aug 17",
    isToday: localDate === TODAY,
    startMs: localMidnightOf(localDate),
    endMs: localMidnightOf(localDate) + 24 * HOUR,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      atMs: localMidnightOf(localDate) + hour * HOUR,
      feet: offset + 2.5 + 2 * Math.sin((hour / 24) * 2 * Math.PI),
    })),
  };
}

function tideWeek(dates: string[]) {
  readHourlyTide.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "week",
      days: dates.map((date, index) => hoursOn(date, index)),
    },
  });
}

function skyWeek(dates: string[], percent = 40) {
  readSkyWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "week",
      days: dates.map((localDate) => ({
        localDate,
        dayLabel: "Mon, Aug 17",
        dateLabel: "Mon, Aug 17",
        isToday: localDate === TODAY,
        thirds: { am: percent, mid: percent, eve: percent },
        hours: Array.from({ length: 24 }, (_, hour) => ({
          atMs: localMidnightOf(localDate) + hour * HOUR,
          percent,
        })),
        phenomenon: null,
      })),
    },
  });
}

function wordingWeek(
  days: { localDate: string; periodName: string; words: string }[],
) {
  readSkyWording.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "week",
      days: days.map((day) => ({ ...day, isDaytime: true })),
    },
  });
}

/** The chart's curve, scoped so no other SVG on the page is counted. */
function curve(container: HTMLElement): Element | null {
  return container.querySelector('svg[aria-label^="Tide today"] path');
}

beforeEach(() => {
  readSkyWording.mockReset();
  readDaylightWeek.mockReset();
  readHourlyTide.mockReset();
  readSkyWeek.mockReset();
  daylight([TODAY, TOMORROW]);
  tideWeek([TODAY, TOMORROW]);
  skyWeek([TODAY, TOMORROW]);
  wordingWeek([
    {
      localDate: TODAY,
      periodName: "Today",
      words: "Patchy Fog then Mostly Sunny",
    },
    { localDate: TOMORROW, periodName: "Tuesday", words: "Mostly Sunny" },
  ]);
});

test("asks every read for the slug it was given", async () => {
  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  for (const read of [
    readSkyWording,
    readDaylightWeek,
    readHourlyTide,
    readSkyWeek,
  ]) {
    expect(read).toHaveBeenCalledWith("la-jolla-shores-beach");
  }
});

test("draws today's tide and today's words, not another day's", async () => {
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(screen.getByText("Patchy Fog then Mostly Sunny")).toBeDefined();
  expect(screen.queryByText("Mostly Sunny")).toBeNull();

  // The series is the day whose heights start at midnight on the 17th. The
  // fixture offsets each day's values, so a panel showing tomorrow would draw
  // a curve a foot higher.
  const path = curve(container);
  expect(path).not.toBeNull();
  const ys = (path?.getAttribute("d") ?? "")
    .split(/(?=[ML])/)
    .filter((step) => step.trim() !== "");
  expect(ys).toHaveLength(24);
});

test("plots the whole day, which is what discharges ADR-0023", async () => {
  // The overnight extreme the week grid dropped "until a day view carries
  // them". A chart starting at sunrise would leave that debt where it was.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  const label = container
    .querySelector('svg[aria-label^="Tide today"]')
    ?.getAttribute("aria-label");
  expect(label).toContain("midnight to midnight");
});

test("draws the now line at the instant the daylight read was computed from", async () => {
  // Not from a clock in this component: reading one during render is impure
  // and this repo's lint rules refuse it. Moving the instant must move the line.
  const early = render(await DayPanel({ slug: "la-jolla-shores-beach" }));
  const at2pm = Number(
    early.container.querySelector("[data-now]")?.getAttribute("x1"),
  );

  daylight([TODAY, TOMORROW], localMidnightOf(TODAY) + 20 * HOUR);
  const late = render(await DayPanel({ slug: "la-jolla-shores-beach" }));
  const at8pm = Number(
    late.container.querySelector("[data-now]")?.getAttribute("x1"),
  );

  expect(at8pm).toBeGreaterThan(at2pm);
});

test("washes today's cloud across the plot", async () => {
  // The layer ADR-0026 moved off the sparkline and onto this chart, where
  // there is height for it.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(
    container.querySelectorAll("[data-cloud-percent]").length,
  ).toBeGreaterThan(0);
});

test("a quiet cloud feed costs the wash and not the curve", async () => {
  // Three products, three outages. The National Weather Service going quiet
  // must not take NOAA's tide off the page with it.
  readSkyWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(container.querySelectorAll("[data-cloud-percent]")).toHaveLength(0);
  expect(curve(container)).not.toBeNull();
});

test("a quiet tide feed says so, and never draws a flat line at zero", async () => {
  // A curve is a stronger claim than a figure: a drawn zero says the sea did
  // something, where a named absence says we were not told.
  readHourlyTide.mockResolvedValue({
    ...BINDING,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(curve(container)).toBeNull();
  expect(screen.getByText(/no hour-by-hour tide prediction/i)).toBeDefined();
  // And the words are untouched: a NOAA outage is not a National Weather
  // Service outage.
  expect(screen.getByText("Patchy Fog then Mostly Sunny")).toBeDefined();
});

test("a quiet wording feed costs the words and not the chart", async () => {
  readSkyWording.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(screen.getByText(/could not get/)).toBeDefined();
  expect(curve(container)).not.toBeNull();
});

test("a day the tide window did not reach says so rather than drawing nothing", async () => {
  tideWeek([TOMORROW]);

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(curve(container)).toBeNull();
  expect(screen.getByText(/no hour-by-hour tide prediction/i)).toBeDefined();
});

test("names the region for what it now carries", async () => {
  // It said "Today" while the region held one sentence. The chart is here, so
  // the heading may say so -- a heading naming content the region does not have
  // is the page promising more than it delivers, and the reverse is a heading
  // saying less than the region is.
  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
    "Today, hour by hour",
  );
});

test("the region is labelled by its heading, for anyone navigating by region", async () => {
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  const section = container.querySelector("section");
  const heading = screen.getByRole("heading", { level: 2 });
  expect(section?.getAttribute("aria-labelledby")).toBe(heading.id);
});

test("a failure to resolve the beach is not swallowed into a rendered nothing", async () => {
  readSkyWording.mockRejectedValue(new Error("no beach in the inventory"));

  await expect(DayPanel({ slug: "no-such-beach" })).rejects.toThrow(
    /no beach in the inventory/,
  );
});
