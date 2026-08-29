import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { localMidnightOf } from "@/lib/pacific-time";

const readSkyWording = vi.fn();
const readDaylightWeek = vi.fn();
const readHourlyTide = vi.fn();
const readSkyWeek = vi.fn();
const readWaveWeek = vi.fn();
const readGridpointWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({
  readSkyWording,
  readDaylightWeek,
  readHourlyTide,
  readSkyWeek,
  readWaveWeek,
  readGridpointWeek,
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

/**
 * A day of CDIP's grid as the read hands it over: eight published estimates
 * and the sixteen hours interpolated between them. The pattern is what matters
 * -- a fixture with every hour published could not tell a swell tab that
 * claimed hourly resolution from one that did not.
 */
function waveWeek(dates: string[]) {
  readWaveWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    line: { id: "D0481", distanceM: 117 },
    state: {
      kind: "week",
      days: dates.map((localDate) => ({
        localDate,
        dayLabel: "Mon, Aug 17",
        dateLabel: "Mon, Aug 17",
        isToday: localDate === TODAY,
        daylight: { timeLabel: "11:00 AM", heightFt: 1.8, periodS: 15 },
        allDay: null,
        hours: Array.from({ length: 24 }, (_, hour) => ({
          atMs: localMidnightOf(localDate) + hour * HOUR,
          heightFt: 1.5 + Math.sin((hour / 24) * 2 * Math.PI) / 2,
          published: hour % 3 === 2,
        })),
      })),
    },
  });
}

/**
 * The cell's wind and air temperature as the read hands them over: hourly
 * hours, but published only where a block began. Six-hour blocks, which is
 * what the far end of a real run looks like.
 */
function gridWeek(
  dates: string[],
  overrides: {
    windMph?: { kind: "absent"; reason: string };
    airTempF?: { kind: "absent"; reason: string };
  } = {},
) {
  const hours = (localDate: string, base: number) => ({
    kind: "published" as const,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      atMs: localMidnightOf(localDate) + hour * HOUR,
      value: base + Math.floor(hour / 6) * 3,
      published: hour % 6 === 0,
    })),
  });

  readGridpointWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "week",
      days: dates.map((localDate) => ({
        localDate,
        dayLabel: "Mon, Aug 17",
        dateLabel: "Mon, Aug 17",
        isToday: localDate === TODAY,
        windMph: overrides.windMph ?? hours(localDate, 5),
        airTempF: overrides.airTempF ?? hours(localDate, 64),
      })),
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
  return container.querySelector('svg[aria-label^="Tide today"] [data-curve]');
}

beforeEach(() => {
  readSkyWording.mockReset();
  readDaylightWeek.mockReset();
  readHourlyTide.mockReset();
  readSkyWeek.mockReset();
  readWaveWeek.mockReset();
  readGridpointWeek.mockReset();
  daylight([TODAY, TOMORROW]);
  tideWeek([TODAY, TOMORROW]);
  waveWeek([TODAY, TOMORROW]);
  gridWeek([TODAY, TOMORROW]);
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
    readWaveWeek,
    readGridpointWeek,
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
  // NAMES NOAA AND CARRIES THE DETAIL. With four tabs, "we have no figure for
  // today" printed on whichever one is quiet says nothing about which publisher
  // went silent -- and the detail is the only thing on the page that does.
  expect(
    screen.getByText(/tide prediction from NOAA just now\. HTTP 503/i),
  ).toBeDefined();
  // And the words are untouched: a NOAA outage is not a National Weather
  // Service outage.
  expect(screen.getByText("Patchy Fog then Mostly Sunny")).toBeDefined();
});

test("an outage on one tab's feed does not cost the other tab", async () => {
  // The whole reason the frame is arithmetic on the calendar rather than a
  // field of the tide read. Before the tabs, no tide meant no chart; a swell
  // forecast that answered would have gone undrawn because a different agency
  // did not.
  readHourlyTide.mockResolvedValue({
    ...BINDING,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  const swell = container.querySelector('[data-series-tab="swell"]');
  expect(swell).not.toBeNull();
  fireEvent.click(swell!);

  expect(
    container.querySelector('svg[aria-label^="Swell today"] [data-curve]'),
  ).not.toBeNull();
});

test("the swell tab marks CDIP's own estimates and no others", async () => {
  // The mechanism that stops a three-hourly model looking like an hourly one.
  // The tide beside it marks twenty-four; this marks the eight CDIP issued.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

  const plot = container.querySelector('svg[aria-label^="Swell today"]');
  expect(plot?.querySelectorAll("circle")).toHaveLength(8);
  // And the sentence says it too, for a reader who gets no marks at all.
  expect(plot?.getAttribute("aria-label")).toContain(
    "publishes every three hours and issued 8 estimates",
  );
});

test("a beach with no MOP line says that, not that the feed failed", async () => {
  // Two absences that look alike and are not: 26 of 51 beaches have no line at
  // all, which is permanent, where an outage is this quarter of an hour.
  readWaveWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    line: null,
    state: {
      kind: "no-line",
      reason: "every point the model publishes sits out on the open coast",
    },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

  expect(screen.getByText(/sits out on the open coast/)).toBeDefined();
  expect(screen.queryByText(/just now/)).toBeNull();
  // The bar survives, so the reader can get back to the tab that has a curve.
  expect(container.querySelector('[data-series-tab="tide"]')).not.toBeNull();
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

test("the wind tab marks each block the office issued, not every hour", async () => {
  // The cell is not an hourly forecast. It publishes intervals -- one hour near
  // the present, three and six further out -- and the expansion that makes a
  // day selectable would otherwise claim twenty-four points where the office
  // issued four. The fixture is six-hour blocks, so four is the honest count.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="wind"]')!);

  const plot = container.querySelector('svg[aria-label^="Wind today"]');
  expect(plot).not.toBeNull();
  expect(plot?.querySelectorAll("circle")).toHaveLength(4);
  expect(plot?.getAttribute("aria-label")).toContain(
    "in blocks rather than by the hour, and today's is made of 4 of them",
  );
});

test("the temperature tab is the air, in Fahrenheit, and says so in full", async () => {
  // "Temp" fits four tabs across a phone where "Temperature" does not. The word
  // it drops is put back everywhere a reader is not paying for the width.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="temperature"]')!);

  const plot = container.querySelector('svg[aria-label^="Air temperature"]');
  expect(plot).not.toBeNull();
  expect(container.querySelector('[data-axis="high"]')?.textContent).toContain(
    "°F",
  );
});

test("a cell that forecasts no wind says so, and never draws a flat line at zero", async () => {
  // THE FAILURE THIS WHOLE SHAPE EXISTS TO PREVENT. "The wind drops to nothing"
  // and "we were not told" are different facts, and a curve along the floor
  // would make the stronger of the two out of the weaker.
  gridWeek([TODAY, TOMORROW], {
    windMph: {
      kind: "absent",
      reason:
        "SGX/54,21: the National Weather Service declares windSpeed and published no values for it.",
    },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="wind"]')!);

  expect(
    screen.getByText(/declares windSpeed and published no values/),
  ).toBeDefined();
  expect(container.querySelector("[data-curve]")).toBeNull();
});

test("a quiet series costs its own tab and no other", async () => {
  // One cell, one payload, five series -- and the parser lets four of them
  // answer when the fifth is empty. That softness is only worth having if the
  // page keeps it, which is what this asserts.
  gridWeek([TODAY, TOMORROW], {
    windMph: { kind: "absent", reason: "no wind published for this cell" },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="temperature"]')!);

  expect(
    container.querySelector('svg[aria-label^="Air temperature"] [data-curve]'),
  ).not.toBeNull();
});

test("a cell that could not be reached says which publisher, on both its tabs", async () => {
  readGridpointWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="wind"]')!);
  expect(
    screen.getByText(
      /wind forecast from the National Weather Service just now\. HTTP 503/,
    ),
  ).toBeDefined();

  fireEvent.click(container.querySelector('[data-series-tab="temperature"]')!);
  expect(
    screen.getByText(
      /temperature forecast from the National Weather Service just now\. HTTP 503/,
    ),
  ).toBeDefined();
});

test("the four tabs are in the order the page leads with", async () => {
  // Tide first because it is the page's lead product and the one the server
  // draws. The rest follow the week grid's own row order, so a reader moving
  // between the two regions is not re-learning an order.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(
    [...container.querySelectorAll("[data-series-tab]")].map((tab) =>
      tab.getAttribute("data-series-tab"),
    ),
  ).toEqual(["tide", "swell", "wind", "temperature"]);
});
