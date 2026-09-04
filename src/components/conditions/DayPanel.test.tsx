import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { localMidnightOf } from "@/lib/pacific-time";
import { SelectedDayProvider } from "./selectedDay";

const readSkyWording = vi.fn();
const readSurfZone = vi.fn();
const readDaylightWeek = vi.fn();
const readHourlyTide = vi.fn();
const readSkyWeek = vi.fn();
const readWaveWeek = vi.fn();
const readGridpointWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({
  readSkyWording,
  readSurfZone,
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

/**
 * A day of hourly heights that rises and falls, so a curve has somewhere to go.
 *
 * **These helpers assume a 24-hour day and every date they are used with is
 * one.** `endMs` is a literal `+ 24 * HOUR` where production takes the next
 * day's local midnight, and the hour arrays are `{ length: 24 }`. Dating a test
 * on 2026-11-01 or 2027-03-14 through here would build a 24-hour fixture for a
 * 25- or 23-hour day, and any assertion about the transition would pass without
 * ever meeting one. The DST tests at the foot of this file build their own days
 * for that reason -- see `dstWeek`.
 */
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
          // CDIP's own estimates carry a bearing and a period; the hours drawn
          // between them carry neither, which is what the swell needle and the
          // readout's row read. Steady, so the resultant is exactly this and
          // the assertion can be an equality.
          periodS: hour % 3 === 2 ? 15 : null,
          directionDegT: hour % 3 === 2 ? 315 : null,
        })),
      })),
    },
  });
}

/**
 * A knot, in the miles per hour this page states.
 *
 * The National Weather Service issues this cell's wind on a whole-knot grid --
 * measured over 400 values across six of this coast's cells, with not one off
 * it, which is the finding ADR-0042 rests on. A knot is 1.15078 mph, so almost
 * nothing the office forecasts arrives here whole.
 */
const KNOT_MPH = 1.852 / 1.609344;

/**
 * A day of wind at the resolution the office actually publishes it.
 *
 * **A fixture of whole miles per hour cannot fail the way #191 failed.** Every
 * rule for rounding a whole number agrees with every other, which is why that
 * defect was invisible on the temperature tab and why the wind fixture above
 * -- 5, 8, 11 and 14 mph -- could not see it either. One knot per six-hour
 * block, which is the shape a real run has at this range.
 */
function knotWind(localDate: string, knotsPerBlock: readonly number[]) {
  return {
    kind: "published" as const,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      atMs: localMidnightOf(localDate) + hour * HOUR,
      value: knotsPerBlock[Math.floor(hour / 6)] * KNOT_MPH,
      published: hour % 6 === 0,
    })),
  };
}

/**
 * The cell's wind and air temperature as the read hands them over: hourly
 * hours, but published only where a block began. Six-hour blocks, which is
 * what the far end of a real run looks like.
 */
function gridWeek(
  dates: string[],
  overrides: {
    // Published as well as absent, because the values themselves are under
    // test once precision is: see `knotWind`.
    windMph?: { kind: "absent"; reason: string } | ReturnType<typeof knotWind>;
    airTempF?: { kind: "absent"; reason: string };
    windDirDegT?: { kind: "absent"; reason: string };
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

  /**
   * One steady bearing all day, and a different one per day.
   *
   * Steady so the resultant is exactly the number written here and the
   * assertion can be an equality rather than a range -- the circular mean has
   * its own tests, and this one is about whether the wiring reaches the page.
   * Different per day because a readout showing the wrong day is otherwise
   * invisible, which is the failure the whole client island exists around.
   */
  const directions = (localDate: string) => ({
    kind: "published" as const,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      atMs: localMidnightOf(localDate) + hour * HOUR,
      value: localDate === TODAY ? 180 : 270,
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
        windDirDegT: overrides.windDirDegT ?? directions(localDate),
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

/**
 * The surf zone bulletin, defaulted so that every test in this file gets a
 * block rather than a crash. What it says is asserted in `SurfZone.test.tsx`
 * and in `conditions.test.ts`; here it only has to exist, because this panel's
 * job is to hand one node per day to `ChosenDay`.
 */
function surfZoneWeek(
  days: { localDate: string; level: "Low" | "Moderate" | "High" }[],
) {
  readSurfZone.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    state: {
      kind: "forecast",
      issuedMs: localMidnightOf(TODAY) + 3_600_000,
      headline: null,
      staleAfterHours: null,
      days: days.map((day) => ({
        ...day,
        periodName: "TODAY",
        meaning: "Life threatening rip currents are possible.",
        surfHeight: "2 to 4 feet.",
        waterTemperature: "70 to 76 degrees.",
      })),
    },
  });
}

beforeEach(() => {
  readSkyWording.mockReset();
  readSurfZone.mockReset();
  surfZoneWeek([{ localDate: TODAY, level: "Moderate" }]);
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
    readSurfZone,
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
  // Scoped to the published marks rather than every circle in the plot: the
  // chart now arrives on an hour, so its selection mark is a circle too, and
  // counting all of them would count the reader's position as an estimate.
  expect(plot?.querySelectorAll("[data-marks] circle")).toHaveLength(8);
  // And the sentence says it too, for a reader who gets no marks at all.
  expect(plot?.getAttribute("aria-label")).toContain(
    "publishes every three hours and issued 8 estimates",
  );
});

test("the panel opens on the hour it is now, taken from the daylight read", () =>
  DayPanel({ slug: "la-jolla-shores-beach" }).then((node) => {
    // The one place the current hour is actually computed. `NOW` is 2 PM, and
    // the read that carries it is the same one the "now" line is drawn from --
    // which is why they cannot name different hours.
    const { container } = render(node);

    expect(container.querySelector("[data-selected-mark]")).not.toBeNull();
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("2 PM");
  }));

test("a read that names no day today selects no hour, rather than midnight", async () => {
  // Unreachable through `weekOfDays`, which builds its array from today
  // outward -- so this asserts the shape of the failure rather than a state the
  // page reaches. It is here because the alternative was passing a made-up hour
  // to satisfy the signature, and a page whose read went wrong selecting
  // midnight plausibly is worse than selecting nothing visibly.
  readDaylightWeek.mockReturnValue({
    beachName: BINDING.beachName,
    atMs: NOW,
    days: [TODAY, TOMORROW].map((localDate) => ({
      localDate,
      dayLabel: "Mon, Aug 17",
      dateLabel: "Mon, Aug 17",
      isToday: false,
      sunriseLabel: "6:14 AM",
      sunsetLabel: "7:32 PM",
      sunriseMs: localMidnightOf(localDate) + 6 * HOUR + 14 * 60_000,
      sunsetMs: localMidnightOf(localDate) + 19 * HOUR + 32 * 60_000,
    })),
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(container.querySelector("[data-selected-mark]")).toBeNull();
  expect(container.querySelector("[data-hour-readout]")?.textContent).toBe(
    "Pick an hour to read it.",
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
  // The published marks, not the selection mark beside them. See the swell
  // tab's own count above.
  expect(plot?.querySelectorAll("[data-marks] circle")).toHaveLength(4);
  expect(plot?.getAttribute("aria-label")).toContain(
    "in blocks rather than by the hour, and this day's is made of 4 of them",
  );
});

test("the wind range a reader is told is the wind range the axis shows", async () => {
  /*
    #191. Four places on the chart printed this figure to a decimal and the
    plot's own accessible name printed it to none, so one reader was told the
    day tops at 12 mph and then, on arrowing to the hour it happens at, that it
    is 11.5. Two numbers, not two renderings of one.

    **Both sides of every assertion here are read off the page.** A test
    pinning "from 2 to 12 mph" would pass with the axis still saying 11.5,
    which is the shape of the suites that let this ship: `HourChart`'s tests
    assert its own figures, `DayPanel`'s assert the description strings, each
    is internally consistent and neither reads the other.
  */
  gridWeek([TODAY, TOMORROW], { windMph: knotWind(TODAY, [2, 6, 10, 4]) });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="wind"]')!);

  const spoken =
    container
      .querySelector('svg[aria-label^="Wind today"]')
      ?.getAttribute("aria-label") ?? "";
  const range = /from (\S+) to (\S+) mph/.exec(spoken);
  expect(range).not.toBeNull();
  const [, low, high] = range!;

  expect(container.querySelector('[data-axis="low"]')?.textContent).toBe(
    `${low} mph`,
  );
  expect(container.querySelector('[data-axis="high"]')?.textContent).toBe(
    `${high} mph`,
  );

  // And the hour the day's high falls on states it the same way -- which is
  // the second half of the contradiction, since arrowing to that hour is how
  // the reader who was told "12" finds out it is called something else.
  const peak = [...container.querySelectorAll("[data-hour-column]")].find(
    (column) => (column.textContent ?? "").includes(`, ${high} mph`),
  );
  expect(peak).toBeDefined();

  fireEvent.click(peak!);
  expect(container.querySelector("[data-hour-readout]")?.textContent).toContain(
    `${high} mph`,
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

/**
 * The sighting layer from #121, reserved on the map rather than instead of it.
 *
 * These three tests moved here with the slot. They were in
 * `ConditionsSection.test.tsx`, which mocks this component — so left there they
 * would pass whatever the slot said, including nothing.
 */
test("the day names the sighting layer as coming rather than staying silent", async () => {
  // A reader can tell the difference between a feature that is coming and one
  // that was never considered. That is the whole point of a reserved slot, and
  // the map arriving is what changes the copy from "a map is coming" to "the
  // sightings are coming, on this map".
  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText(/Sightings will be drawn on this map/)).toBeDefined();
});

test("the slot promises a record of reports, never a survey", async () => {
  // The claim the layer is allowed to make, fixed in the copy before it exists.
  // iNaturalist records where people with phones went, not where animals are,
  // and a slot promising a density surface would commit the page to something
  // the data cannot support (#121).
  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(
    screen.getByText(/reported by naturalists, not surveyed by us/),
  ).toBeDefined();
});

test("the slot says what the layer will show, not what was found", async () => {
  // The tense is the claim. Named animals, a named window and a named place in
  // the past tense read as a report of what was found here, and no such report
  // exists. On a page whose discipline is that every figure names its station
  // and nothing unmeasured is asserted, this is the one sentence a skimming
  // reader could come away believing.
  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  const slot = screen.getByText(/Sightings will be drawn on this map/);

  expect(slot.textContent).toContain(
    "Will show octopus, nudibranchs, sea hares and leopard sharks logged " +
      "near this beach in the past week",
  );
});

test("the map carries a readout for the day the reader chose", async () => {
  // The map is one picture for the whole week and the readout is not, so the
  // coast stays server-rendered and only the readout moves. Asserted through the
  // words rather than through the drawing, because the words are what a reader
  // not looking at the picture is given.
  const dates = [TODAY, TOMORROW];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek(
    dates.map((localDate) => ({
      localDate,
      periodName: "Today",
      words: "Patchy Fog",
    })),
  );

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-row='wind']")).not.toBeNull();

  // The row itself is the spoken equivalent now, so the bearing is read off its
  // accessible name rather than off a sentence beneath the picture.
  expect(
    screen.getByRole("img", { name: /^Wind at 2 PM, from the south, 180°/ }),
  ).toBeDefined();

  // Scoped to the row's own provenance. The sky wording names the same cell a
  // few hundred pixels up, which is ADR-0029's permitted duplication and is why
  // an unscoped query for that sentence finds two.
  const line = screen.getByText(/^Biggest wind in daylight/).closest("li")!;
  expect(line.textContent).toContain(
    "this beach's own grid cell · National Weather Service, San Diego",
  );
});

test("the wind row prints this hour's speed, and the day's biggest moves to the line beneath", async () => {
  // The two halves of ADR-0035's wind. The cell's speeds step 5, 8, 11, 14
  // through four six-hour blocks, so 2 PM is inside the third and the row says
  // 11.0; daylight runs 6:14 AM to 7:32 PM, so the last block's 14 is the
  // largest hour a reader could be there for and the provenance label says so
  // with the hour it happened at.
  //
  // **The label is the only place this page states that figure.** ADR-0034
  // justified drawing the readout everywhere partly on the week grid stating
  // the same one; it does not, and ADR-0035 records the correction. An hour
  // instrument that simply dropped it would be a figure gone from the page
  // with nothing announcing it.
  //
  // One decimal on both, because four of the five places this page prints a
  // wind figure use it and the fifth is issue #191. A sixth statement joining
  // the four is what keeps that issue about one function rather than two.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(
    container.querySelector("[data-readout-figure='wind']")!.textContent,
  ).toBe("11 mph");
  expect(screen.getByText(/^Biggest wind in daylight/).textContent).toBe(
    "Biggest wind in daylight, 14 mph at 6:00 PM ",
  );
});

test("the caption names the hour every row in the block is for", async () => {
  // Always present, so the block never changes its numbers with nothing
  // visible saying what they now mean -- and never grows a line on the first
  // click, which would move the rows under a reader's eye.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-caption]")!.textContent).toBe(
    "2 PM",
  );
  // The same words the chart's own readout uses, from the same function, so
  // one hour named twice on one screen is named the same way.
  expect(container.querySelector("[data-hour-readout]")!.textContent).toContain(
    "2 PM",
  );
});

test("the readout is not a live region, because the chart's already is", async () => {
  // Two live regions firing on one arrow-press means a keyboard reader hears
  // the same change twice. The chart's readout keeps the announcement because
  // it is the region the control sits in.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(
    container.querySelector("[data-readout]")!.closest("[aria-live]"),
  ).toBeNull();
  expect(container.querySelectorAll("[aria-live]")).toHaveLength(1);
});

test("the swell row is the estimate nearest the hour, and states it whole", async () => {
  // **This reverses an invariant `DayPanel` used to hold.** The row was the
  // week grid's own `WaveReading` -- the day's biggest daylight step, 1.8 ft --
  // so the two regions could not print different numbers for one day. They can
  // now, and that is ADR-0035's stated cost: the grid states the day and the
  // map states the hour a reader is looking at, each named by its own caption
  // and its own provenance line, which is the condition ADR-0010 and ADR-0029
  // set rather than an exception to them.
  //
  // Whole, off one published step: height, period and bearing all from the
  // 2 PM estimate. Reading the fields off `WaveHour` one by one would take the
  // height from this hour and the bearing from another, because only CDIP's own
  // estimates carry a direction.
  //
  // The step's own time is not beside the figure -- it is in the provenance
  // line, because a three-hour step is not a peak located to the minute and the
  // readout has no room to say so.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(
    container.querySelector("[data-readout-figure='swell']")!.textContent,
  ).toBe("1.3 ft · 15 s");
  // Not the day's selected estimate, which is what this row used to print.
  expect(
    container.querySelector("[data-readout-row='swell']")!.textContent,
  ).not.toContain("1.8 ft");
  expect(
    container.querySelector("[data-readout-row='swell']")!.textContent,
  ).not.toContain("2:00 PM");

  const line = screen.getByText(/MOP line D0481/).closest("li")!;
  expect(line.textContent).toContain("for the three-hour step at 2:00 PM");
  // The superlative went with the day figure. What labels this line is the
  // word, and what qualifies it is the step named at the end of it.
  expect(line.querySelector("span")!.textContent).toBe("Swell ");
});

test("the rows follow the hour and the wedge behind them does not", async () => {
  // **The two halves of ADR-0035 in one render.** The arrow and the figure are
  // the hour a reader chose; the wedge is the day's daylight swing and stays
  // put. A wedge that meant daylight sometimes and midnight to midnight at
  // other times would be the ambiguity this decision took out of the arrow,
  // moved to the mark behind it.
  //
  // The cell's speeds step through six-hour blocks, so 9 AM is inside the
  // second and 2 PM the third.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  // A bearing that moves through the day, where the shared fixture holds one
  // steady: a day that never turned has no wedge to hold still.
  readGridpointWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "week",
      days: dates.map((localDate) => ({
        localDate,
        dayLabel: "Mon, Aug 17",
        dateLabel: "Mon, Aug 17",
        isToday: true,
        windMph: {
          kind: "published",
          hours: Array.from({ length: 24 }, (_, hour) => ({
            atMs: localMidnightOf(localDate) + hour * HOUR,
            value: 5 + Math.floor(hour / 6) * 3,
            published: hour % 6 === 0,
          })),
        },
        windDirDegT: {
          kind: "published",
          hours: Array.from({ length: 24 }, (_, hour) => ({
            atMs: localMidnightOf(localDate) + hour * HOUR,
            value: 180 + (hour % 4) * 10,
            published: hour % 6 === 0,
          })),
        },
        airTempF: {
          kind: "published",
          hours: Array.from({ length: 24 }, (_, hour) => ({
            atMs: localMidnightOf(localDate) + hour * HOUR,
            value: 64,
            published: hour % 6 === 0,
          })),
        },
      })),
    },
  });
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  const wedge = () =>
    container.querySelector("[data-wedge='wind']")!.getAttribute("d");
  const arrow = () =>
    container.querySelector("[data-arrow='wind']")!.getAttribute("x1");
  const figure = () =>
    container.querySelector("[data-readout-figure='wind']")!.textContent;

  // 2 PM: 180 + (14 % 4) * 10, and the third six-hour block of speeds.
  expect(figure()).toBe("11 mph");
  expect(
    screen.getByRole("img", { name: /^Wind at 2 PM, from the south, 200°/ }),
  ).toBeDefined();
  const dayWedge = wedge();
  const afternoonArrow = arrow();

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);

  expect(container.querySelector("[data-readout-caption]")!.textContent).toBe(
    "9 AM",
  );
  expect(figure()).toBe("8 mph");
  expect(
    screen.getByRole("img", { name: /^Wind at 9 AM, from the south, 190°/ }),
  ).toBeDefined();
  expect(arrow()).not.toBe(afternoonArrow);

  // And the day behind it did not move.
  expect(wedge()).toBe(dayWedge);
});

test("a day that never turned in daylight draws the arrow and no wedge", async () => {
  // The wedge is the day's daylight swing, so a day with no published bearing
  // inside daylight has none to draw -- and the row still states the hour's own
  // estimate rather than going down with it. Zero draws no wedge, which is the
  // same absence a settled day would show.
  const dates = [TODAY];
  daylight(dates, localMidnightOf(TODAY) + 2 * HOUR);
  tideWeek(dates);
  readWaveWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    line: { id: "D0481", distanceM: 117 },
    state: {
      kind: "week",
      days: dates.map((localDate) => ({
        localDate,
        dayLabel: "Mon, Aug 17",
        dateLabel: "Mon, Aug 17",
        isToday: true,
        daylight: null,
        allDay: null,
        // One estimate, at 2 AM, hours before sunrise at 6:14.
        hours: Array.from({ length: 24 }, (_, hour) => ({
          atMs: localMidnightOf(localDate) + hour * HOUR,
          heightFt: 1.5,
          published: hour === 2,
          periodS: hour === 2 ? 15 : null,
          directionDegT: hour === 2 ? 315 : null,
        })),
      })),
    },
  });
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-row='swell']")).not.toBeNull();
  expect(container.querySelector("[data-arrow='swell']")).not.toBeNull();
  expect(container.querySelector("[data-wedge='swell']")).toBeNull();
});

test("an hour no estimate reaches loses the swell row and its line together", async () => {
  // CDIP's grid lands at 02:00 Pacific, so midnight is two hours from the
  // nearest estimate on either side -- the previous day's 23:00 belongs to the
  // previous date -- and no estimate speaks for it. The row is withheld rather
  // than reaching further back, and ADR-0032's rule takes the provenance line
  // with it: an attribution with nothing above it names the publisher of a
  // figure the page is not showing.
  const dates = [TODAY];
  daylight(dates, localMidnightOf(TODAY));
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-caption]")!.textContent).toBe(
    "12 AM",
  );
  expect(container.querySelector("[data-readout-row='swell']")).toBeNull();
  expect(screen.queryByText(/MOP line D0481/)).toBeNull();

  // The wind is hourly, so the block keeps the row it can still stand behind.
  expect(container.querySelector("[data-readout-row='wind']")).not.toBeNull();
});

test("an hour between two estimates takes the nearer of them", async () => {
  // The rule that answers 1 AM at all: the estimate an hour away speaks for it,
  // where "the last one at or before" -- which is what the plan wrote -- has
  // nothing to say until 2 AM. Ninety minutes is half of CDIP's step, so the
  // hour either side of an estimate is inside it and no hour is inside two.
  const dates = [TODAY];
  daylight(dates, localMidnightOf(TODAY) + HOUR);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-caption]")!.textContent).toBe(
    "1 AM",
  );
  const line = screen.getByText(/MOP line D0481/).closest("li")!;
  expect(line.textContent).toContain("for the three-hour step at 2:00 AM");
});

test("a cell that publishes no wind direction draws no readout row", async () => {
  // The needle goes and the map stays. The picture is about where this beach
  // is, which does not depend on a bearing.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates, {
    windDirDegT: {
      kind: "absent",
      reason: "the cell declares windDirection and published no values",
    },
  });
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-row='wind']")).toBeNull();
  expect(screen.queryByRole("img", { name: /^Wind at/ })).toBeNull();
  // The map itself is unaffected: it draws a place, and a place does not stop
  // existing because a forecast cell went quiet about the wind.
  expect(container.querySelector("[data-coast]")).not.toBeNull();
  expect(container.querySelector("[data-segment]")).not.toBeNull();
});

test("the readout carries a second row for the swell, from its own publisher", async () => {
  // One readout, two publishers -- `StatGroup`'s one-group-one-source contract
  // broken on purpose and answered the way `WeekGrid` answers it, with a
  // provenance line per row rather than by splitting the component.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  waveWeek(dates);
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelectorAll("[data-readout-row]")).toHaveLength(2);
  expect(
    screen.getByRole("img", {
      name: /^Swell at 2 PM, from the north-west, 315°/,
    }),
  ).toBeDefined();

  const line = screen.getByText(/MOP line D0481/).closest("li")!;
  expect(line.textContent).toContain("MOP line D0481");
  expect(line.textContent).toContain(
    "CDIP, Scripps Institution of Oceanography",
  );
  // The line the model stands on, which the readout itself has no room for.
  expect(line.textContent).toContain("about 0.1 km from this beach");
});

test("a beach with no swell model keeps its wind row", async () => {
  // 26 of 51 beaches bind no MOP line. The readout loses a row and keeps the
  // one it has, rather than the pair going down together.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  readWaveWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    line: null,
    state: {
      kind: "no-line",
      reason: "no MOP line is computed for this beach",
    },
  });
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelectorAll("[data-readout-row]")).toHaveLength(1);
  expect(
    screen.getByRole("img", { name: /^Wind at 2 PM, from the south, 180°/ }),
  ).toBeDefined();
  expect(screen.queryByRole("img", { name: /^Swell at/ })).toBeNull();
  expect(screen.queryByText(/MOP line/)).toBeNull();
});

test("a bay beach with no model line gets both a coast and its wind row", async () => {
  // Two decisions meeting on one beach.
  //
  // ADR-0034: the dial was withheld wherever no coast was drawn, together with
  // its provenance, so nearly half the inventory printed no wind figure
  // anywhere on the picture -- for a rule about a needle over an empty frame
  // rather than about a labelled block.
  //
  // ADR-0039: the empty frame is gone too. `fiesta-island` binds no MOP line
  // and never will -- CDIP places none in Mission Bay -- but CDFW's ecoregion
  // boundary follows the bay shore, so there is a coastline to draw. The two
  // are independent, and this beach is where that shows: no line, and a coast.
  const dates = [TODAY];
  daylight(dates);
  tideWeek(dates);
  readWaveWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    line: null,
    state: {
      kind: "no-line",
      reason: "no MOP line is computed for this beach",
    },
  });
  skyWeek(dates);
  gridWeek(dates);
  wordingWeek([{ localDate: TODAY, periodName: "Today", words: "Patchy Fog" }]);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "fiesta-island" })}
    </SelectedDayProvider>,
  );

  // The picture this beach gets: the bay's own shoreline, and its stretch of it
  // drawn heavier. Both, where it used to get a chord across an empty square.
  expect(container.querySelector("[data-coast]")).not.toBeNull();
  expect(container.querySelector("[data-segment]")).not.toBeNull();

  // And the figures it used to have nowhere to print: this hour's, and the
  // day's biggest on the line beneath.
  expect(
    container.querySelector("[data-readout-figure='wind']")!.textContent,
  ).toBe("11 mph");
  expect(screen.getByText(/^Biggest wind in daylight/).textContent).toBe(
    "Biggest wind in daylight, 14 mph at 6:00 PM ",
  );
});

/* =========================================================================
 * Who published the curve
 * ========================================================================= */

/**
 * The chart's own attribution, scoped so that the sky wording's line above the
 * plot is never read in its place.
 *
 * Reading the wrong line is not a hypothetical here: the nearest provenance
 * above this chart names the grid cell, and the whole of finding 1 is that a
 * reader takes it for the plot's. An unscoped `getByText` would make the same
 * mistake the reader does, and pass.
 */
function provenance(container: HTMLElement): string {
  return container.querySelector("[data-series-provenance]")?.textContent ?? "";
}

test("the tide curve names NOAA, not the grid cell above it", async () => {
  // The line a reader would otherwise take for this plot's belongs to
  // `SkyWording` and names the National Weather Service's cell. The tide is
  // NOAA's, and the two are a few pixels apart.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(provenance(container)).toContain(
    "La Jolla (Scripps Institution Wharf)",
  );
  expect(provenance(container)).toContain("NOAA Tides & Currents");
  expect(provenance(container)).not.toContain("this beach's own grid cell");
});

test("the swell curve names CDIP's model, which is not the buoy below it", async () => {
  // ADR-0029 permits a modelled height beside a measured one on condition that
  // each is attributed. The sea card 40px under this curve leads with the
  // buoy's measurement, so an unattributed curve leaves the only named source
  // on the screen belonging to the figure that is not drawn.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

  expect(provenance(container)).toContain("MOP line D0481");
  expect(provenance(container)).toContain(
    "CDIP, Scripps Institution of Oceanography",
  );
  expect(provenance(container)).toContain(
    "a model of the swell at 10 m depth, not a measurement",
  );
  expect(provenance(container)).not.toContain("NOAA");
});

test("the wind and the air temperature name the cell, on both their tabs", async () => {
  // Neither is attributed anywhere on this page. The only wind provenance it
  // carries is the air card's Scripps Pier, which is the station these curves
  // did not come from -- ADR-0029's whole subject.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="wind"]')!);
  expect(provenance(container)).toContain("this beach's own grid cell");
  expect(provenance(container)).toContain(
    "National Weather Service, San Diego",
  );
  expect(provenance(container)).toContain(
    "a forecast, not a reading taken at the beach",
  );

  fireEvent.click(container.querySelector('[data-series-tab="temperature"]')!);
  expect(provenance(container)).toContain("this beach's own grid cell");
  // "Temp" is a tab shortened to fit four across a phone. Everywhere a reader
  // is not paying for the width, this page says the word in full.
  expect(provenance(container)).toContain("Air temperature");
});

test("a beach with no tide station credits nobody rather than reaching through", async () => {
  // `station` is null exactly in this state, and the four sources are composed
  // once for the week -- before any tab knows whether it has a curve to
  // attribute. An implementation that reached through the null would throw here
  // instead of rendering the absence the reader is owed.
  readHourlyTide.mockResolvedValue({
    beachName: BINDING.beachName,
    station: null,
    state: {
      kind: "no-station",
      reason: "no station within 40 km of this beach publishes predictions",
    },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(screen.getByText(/no station within 40 km/)).toBeDefined();
  expect(container.querySelector("[data-series-provenance]")).toBeNull();
});

test("a beach with no forecast cell leaves wind and temperature uncredited", async () => {
  // The same for the third source. There is no curve on either tab to
  // attribute, and no cell to name if there were.
  readGridpointWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: null,
    state: {
      kind: "no-cell",
      reason: "the forecast grid does not reach this beach",
    },
  });

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-series-tab="wind"]')!);

  expect(screen.getByText(/the forecast grid does not reach/)).toBeDefined();
  expect(container.querySelector("[data-series-provenance]")).toBeNull();
});

test("the attribution survives choosing an hour", async () => {
  // ADR-0027 lets a plot be asked a question only additively: an interaction
  // may reveal what the page did not carry, and may never put something drawn
  // or written behind a gesture.
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);

  expect(provenance(container)).toContain("NOAA Tides & Currents");
});

/**
 * The map's caption on the two days a year a position is not a clock hour.
 *
 * **Its own fixture rather than the shared helpers above**, which hardcode a
 * 24-hour day: fed a DST date they would build 24 hours for a 25-hour span, and
 * a test asserting the transition would pass without a transition in it. This
 * one takes the day's length from `localMidnightOf` at both ends, which is what
 * `DayPanel` itself does, so the span is 25 or 23 because the zone says so.
 *
 * The caption is the site issue #196 does not mention and the one ADR-0035
 * makes non-optional: if the chart names hours from instants while the caption
 * counts positions, the two regions disagree on exactly the days that decision
 * arranged for them to agree on.
 */
function dstWeek(localDate: string, nextDate: string, atMs: number) {
  const startMs = localMidnightOf(localDate);
  const count = Math.round((localMidnightOf(nextDate) - startMs) / HOUR);
  const day = {
    localDate,
    dayLabel: "Sun, Nov 1",
    dateLabel: "Sun, Nov 1",
    isToday: true,
  };
  const hourly = <T,>(build: (hour: number) => T) =>
    Array.from({ length: count }, (_, hour) => build(hour));

  readDaylightWeek.mockReturnValue({
    beachName: BINDING.beachName,
    atMs,
    days: [
      {
        ...day,
        sunriseLabel: "6:14 AM",
        sunsetLabel: "4:55 PM",
        sunriseMs: startMs + 6 * HOUR + 14 * 60_000,
        sunsetMs: startMs + 17 * HOUR + 55 * 60_000,
      },
    ],
  });

  readHourlyTide.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "week",
      days: [
        {
          ...day,
          startMs,
          endMs: localMidnightOf(nextDate),
          hours: hourly((hour) => ({
            atMs: startMs + hour * HOUR,
            feet: 2.5 + 2 * Math.sin((hour / count) * 2 * Math.PI),
          })),
        },
      ],
    },
  });

  readWaveWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    line: { id: "D0481", distanceM: 117 },
    state: {
      kind: "week",
      days: [
        {
          ...day,
          daylight: { timeLabel: "11:00 AM", heightFt: 1.8, periodS: 15 },
          allDay: null,
          hours: hourly((hour) => ({
            atMs: startMs + hour * HOUR,
            heightFt: 1.5,
            published: hour % 3 === 2,
            periodS: hour % 3 === 2 ? 15 : null,
            directionDegT: hour % 3 === 2 ? 315 : null,
          })),
        },
      ],
    },
  });

  const published = (value: number) => ({
    kind: "published" as const,
    hours: hourly((hour) => ({
      atMs: startMs + hour * HOUR,
      value,
      published: true,
    })),
  });

  readGridpointWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "week",
      days: [
        {
          ...day,
          windMph: published(8),
          windDirDegT: published(180),
          airTempF: published(64),
        },
      ],
    },
  });

  readSkyWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "week",
      days: [
        {
          ...day,
          thirds: { am: 40, mid: 40, eve: 40 },
          hours: hourly((hour) => ({
            atMs: startMs + hour * HOUR,
            percent: 40,
          })),
          phenomenon: null,
        },
      ],
    },
  });

  wordingWeek([{ localDate, periodName: "Today", words: "Patchy Fog" }]);
  return { startMs, count };
}

test("the map's caption names the last hour of a fall-back day 11 PM", async () => {
  // Position 24 of a 25-hour day. Read as a clock hour it fell through to
  // `${hour - 12} PM` and the caption said "12 PM" -- noon, printed at eleven
  // at night, over a wind arrow for the wrong hour.
  const { startMs, count } = dstWeek(
    "2026-11-01",
    "2026-11-02",
    localMidnightOf("2026-11-01") + 24 * HOUR,
  );
  expect(count).toBe(25);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-caption]")!.textContent).toBe(
    "11 PM",
  );
  // And the chart's readout says the same words about the same hour, which is
  // the property ADR-0035 exists for and the one that would break first if
  // only one region were fixed.
  expect(container.querySelector("[data-hour-readout]")!.textContent).toContain(
    "11 PM",
  );
  expect(startMs + 24 * HOUR).toBeGreaterThan(startMs);
});

test("the map's caption names a spring-forward hour ahead, not behind", async () => {
  // The mirror. Position 2 of a 23-hour day is 3 AM: a fix that subtracted an
  // hour would pass the test above and fail this one.
  const { count } = dstWeek(
    "2027-03-14",
    "2027-03-15",
    localMidnightOf("2027-03-14") + 2 * HOUR,
  );
  expect(count).toBe(23);

  const { container } = render(
    <SelectedDayProvider>
      {await DayPanel({ slug: "la-jolla-shores-beach" })}
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout-caption]")!.textContent).toBe(
    "3 AM",
  );
  expect(container.querySelector("[data-hour-readout]")!.textContent).toContain(
    "3 AM",
  );
});

/* =========================================================================
 * The day, answering for an area
 * ========================================================================= */

/**
 * The scope a page hands this panel, built from `areas.json` rather than
 * invented. `areaSources` is not mocked: the point is what this region does
 * with what the real table says, and a fixture would let the two drift apart in
 * the way ADR-0048's own counts drifted once.
 */
async function areaScope(slug: string) {
  const { areaBySlug } = await import("@/lib/areas");
  const { scopeFor } = await import("./areaScope");
  return scopeFor(areaBySlug(slug)!);
}

/**
 * A product the area's beaches share is read and drawn. La Jolla's ten all bind
 * `9410230`, so the tide curve is the area's.
 */
test("an area draws the curve its beaches share", async () => {
  const { container } = render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );

  expect(readHourlyTide).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(
    container.querySelector('svg[aria-label^="Tide today"] [data-curve]'),
  ).not.toBeNull();
});

/**
 * And a product they do not share keeps its tab, is not read, and carries the
 * area's sentence where the plot would be.
 *
 * The tab staying is the decision: four tabs are this region's vocabulary for
 * its four products, and La Jolla shares only the tide, so a bar gated to what
 * it can draw would be one tab wide and a reader would never learn the swell
 * exists. ADR-0049.
 */
test("a withheld product keeps its tab and says why it is empty", async () => {
  const { container } = render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );

  const swell = container.querySelector('[data-series-tab="swell"]');
  expect(swell).not.toBeNull();
  fireEvent.click(swell!);

  // No curve, and no request that could have produced one.
  expect(
    container.querySelector('svg[aria-label^="Swell today"] [data-curve]'),
  ).toBeNull();
  expect(readWaveWeek).not.toHaveBeenCalled();

  // The area's own sentence, and the counts in it are La Jolla's real ones:
  // nine of ten beaches read eight model lines and one reads none.
  expect(
    screen.getByText(
      /Only 9 of the 10 beaches in La Jolla have a swell forecast, and they read 8 different sources/,
    ),
  ).toBeDefined();
});

/**
 * The four tabs are three publishers, and the cell's two go together. So do the
 * cloud band drawn behind every tab and the office's own wording above the
 * chart, which come off that same cell.
 */
test("a withheld cell takes both its tabs, the cloud and the wording", async () => {
  const { container } = render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );

  expect(readGridpointWeek).not.toHaveBeenCalled();
  expect(readSkyWeek).not.toHaveBeenCalled();
  expect(readSkyWording).not.toHaveBeenCalled();

  // The office's sentences are replaced rather than dropped: one member's
  // wording under the whole area's name is the thing this refuses.
  expect(screen.queryByText("Patchy Fog then Mostly Sunny")).toBeNull();
  expect(
    screen.getAllByText(
      /The 10 beaches in La Jolla read 4 different sources for a forecast in words/,
    ).length,
  ).toBeGreaterThan(0);

  for (const [tab, product] of [
    ["wind", "a wind forecast"],
    ["temperature", "an air temperature forecast"],
  ] as const) {
    fireEvent.click(container.querySelector(`[data-series-tab="${tab}"]`)!);
    expect(
      screen.getByText(new RegExp(`4 different sources for ${product}`)),
      tab,
    ).toBeDefined();
  }
});

/**
 * The bar keeps all four tabs whatever the area shares. This is the assertion
 * the decision turns on, so it is made against the area that would lose the
 * most: La Jolla shares one of the chart's three products.
 */
test("the tab bar is the same four tabs at either scope", async () => {
  const tabsOf = (root: HTMLElement) =>
    [...root.querySelectorAll("[data-series-tab]")].map((node) =>
      node.getAttribute("data-series-tab"),
    );

  const beach = render(await DayPanel({ slug: "la-jolla-shores-beach" }));
  const onBeach = tabsOf(beach.container);
  beach.unmount();

  const { container } = render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );

  expect(onBeach).toEqual(["tide", "swell", "wind", "temperature"]);
  expect(tabsOf(container)).toEqual(onBeach);
});

/**
 * An area page draws the area's own coast, which is the whole point of making
 * the area the thing a reader picks: it had readings and a chooser and no
 * picture of the place they were about.
 *
 * The spoken label says the count, because the picture cannot. Nothing on an
 * area map is picked out, so a reader who cannot see it is owed the fact that
 * this is several beaches' coast rather than one's.
 */
test("an area page draws the whole area's coast", async () => {
  const { container } = render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );

  const map = container.querySelector("svg[aria-label^='A map of']");
  expect(map).not.toBeNull();
  expect(map!.getAttribute("aria-label")).toBe(
    "A map of La Jolla: the whole stretch of coast its 10 beaches sit on, " +
      "with the open water shaded.",
  );
  // The placeholder it replaces is gone, and asserted gone: a sentence left
  // beside a real map would read as the map having failed.
  expect(screen.queryByText(/The map draws one beach's own/)).toBeNull();
});

/**
 * And nothing on it is drawn heavy, because no one beach is the subject.
 *
 * That is the zoom the plan describes rather than a missing feature: the beach
 * page draws its own stretch heavy in a frame sized to it, and the two are two
 * committed frames the route swaps between. Asserted against the beach page in
 * the same test so it cannot pass by the marker having been renamed.
 */
test("an area map picks out no single beach, where a beach map does", async () => {
  const onArea = render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );
  expect(onArea.container.querySelector("[data-segment]")).toBeNull();
  onArea.unmount();

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );
  expect(container.querySelector("[data-segment]")).not.toBeNull();
  expect(
    container
      .querySelector("svg[aria-label^='A map of']")!
      .getAttribute("aria-label"),
  ).toMatch(/^A map of La Jolla Shores Beach: its own stretch/);
});

/**
 * Every area gets a frame, which is what says this is not a feature only the
 * area it was built against has. Measured over the twelve areas that draw one:
 * the other six hold a single beach and show that beach's map instead.
 */
test("every multi-beach area has a coast to draw", async () => {
  const { beachesByArea } = await import("@/lib/areas");
  const { shoreViewForArea } = await import("./shore");

  const drawn = beachesByArea().filter(({ area }) => area.beaches.length > 1);
  expect(drawn).toHaveLength(12);

  for (const { area } of drawn) {
    const view = shoreViewForArea(area);
    expect(view.bounds, area.slug).not.toBeNull();
    expect(view.coast.length, area.slug).toBeGreaterThan(1);
    expect(view.segment, area.slug).toBeNull();
  }
});

/**
 * The beach page is unchanged, and this says so structurally rather than by
 * re-asserting every tab: with no scope there is nothing to withhold, so all
 * six reads are made exactly as they were before areas existed.
 */
test("with no area scope every product is still read", async () => {
  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  for (const read of [
    readHourlyTide,
    readWaveWeek,
    readSkyWeek,
    readGridpointWeek,
    readSkyWording,
    readSurfZone,
  ]) {
    expect(read).toHaveBeenCalledWith("la-jolla-shores-beach");
  }
});

/**
 * The bulletin is not gated by the area's agreement, and that is deliberate
 * rather than an oversight: the National Weather Service issues one for "San
 * Diego County Coastal Areas", a unit larger than any area in this table. It is
 * still read through a member here; the exception gets its own decision.
 */
test("the surf zone bulletin is read at either scope", async () => {
  render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );

  expect(readSurfZone).toHaveBeenCalledWith("la-jolla-shores-beach");
});

/**
 * The exception, and it is a category difference rather than a relaxation. The
 * National Weather Service issues one bulletin for "San Diego County Coastal
 * Areas", so what an area needs is not a member its beaches agree about but a
 * member the forecast is issued for — which for Tijuana Estuary is not the
 * member everything else in this region is read through. ADR-0050.
 */
test("the bulletin is read through a member the forecast is issued for", async () => {
  render(
    await DayPanel({
      slug: "tijuana-slough-national-wildlife-refuge",
      area: await areaScope("tijuana-estuary"),
    }),
  );

  // Everything else reads through the slug it was given; the bulletin does not.
  expect(readSurfZone).toHaveBeenCalledWith("border-field-state-park");
  expect(readSurfZone).not.toHaveBeenCalledWith(
    "tijuana-slough-national-wildlife-refuge",
  );
});

/**
 * And where the forecast reaches no member, the sentence is about the area
 * rather than about the beach it was read through. That is a claim rather than
 * a hedge: `surfZoneBeachOf` falls back only when every member is sheltered,
 * which `areas.test.ts` asserts over the whole table.
 */
test("a wholly sheltered area is told the forecast is not issued for any of it", async () => {
  readSurfZone.mockResolvedValue({
    beachName: "Mission Bay, Riviera Shores",
    state: {
      kind: "no-surf-zone",
      reason:
        "the National Weather Service issues this forecast for San Diego County's coastal " +
        "areas, and a bay, lagoon or inlet has no surf zone, so it does not describe the " +
        "water here",
    },
  });

  render(
    await DayPanel({
      slug: "mission-bay-riviera-shores",
      area: await areaScope("mission-bay-west"),
    }),
  );

  expect(
    screen.getByText(
      /This forecast is not issued for any beach in Mission Bay – West/,
    ),
  ).toBeDefined();
  expect(screen.queryByText(/not issued for this beach/)).toBeNull();
});

/** And a beach page still says "this beach", which is what it is. */
test("a beach page keeps the beach-scoped wording", async () => {
  readSurfZone.mockResolvedValue({
    beachName: "Mission Bay, Riviera Shores",
    state: { kind: "no-surf-zone", reason: "a bay has no surf zone" },
  });

  render(await DayPanel({ slug: "mission-bay-riviera-shores" }));

  expect(
    screen.getByText(/This forecast is not issued for this beach/),
  ).toBeDefined();
});

/**
 * The readout arrives with the area map, and only where the area has a bearing
 * to state.
 *
 * An area reports a wind bearing only where its beaches share a forecast cell
 * and a swell bearing only where they share a model line. La Jolla shares
 * neither, so no hour of any day has a needle — and `DayCompass` renders null
 * in that state while `ShoreMap` would still draw its labelled box around it.
 * That put an empty block under the coast, which reads as a fault. ADR-0051.
 */
test("an area with no shared cell or line carries the map and no readout", async () => {
  const { container } = render(
    await DayPanel({
      slug: "la-jolla-shores-beach",
      area: await areaScope("la-jolla"),
    }),
  );

  expect(container.querySelector("svg[aria-label^='A map of']")).not.toBeNull();
  expect(container.querySelector("[data-readout]")).toBeNull();
});

/** And an area that does share a cell keeps its wind, which is the promise. */
test("an area that shares a forecast cell keeps its readout", async () => {
  const { container } = render(
    await DayPanel({
      slug: "mission-bay-riviera-shores",
      area: await areaScope("mission-bay-west"),
    }),
  );

  const readout = container.querySelector("[data-readout]");
  expect(readout).not.toBeNull();
  expect(readout!.textContent).toContain("Wind");
});

/**
 * A beach page never reaches the empty state, and this is what says the fix is
 * about areas rather than a guard bolted onto both: every beach in the
 * inventory binds a forecast cell, so there is always a wind arrow.
 */
test("a beach page always has a readout", async () => {
  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(container.querySelector("[data-readout]")).not.toBeNull();
});

/**
 * A slug the inventory does not hold draws no map, rather than inventing one.
 *
 * Unreachable from a URL — both routes resolve the slug before rendering — and
 * asserted because this panel is handed a slug rather than a beach, so the
 * question of what it does with a bad one has an answer either way. It was
 * covered incidentally while an area page took this path; the area map moved
 * area pages onto their own, so it is asserted deliberately now.
 */
test("a slug the inventory does not hold draws no map", async () => {
  const { container } = render(await DayPanel({ slug: "not-a-beach" }));

  expect(container.querySelector("svg[aria-label^='A map of']")).toBeNull();
  // The rest of the region still renders: the map is one part of it.
  expect(container.querySelector("[data-series-tab]")).not.toBeNull();
});
