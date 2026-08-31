import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { HourChart, NARROW_FRAME } from "./HourChart";
import { TOUCH_TARGET } from "../ui/touchTarget";
import type { SparkPoint } from "./DaySpark";
import { localMidnightOf } from "@/lib/pacific-time";

/**
 * One ordinary Pacific day. Every instant is derived from it rather than
 * written as a literal, so the fixture cannot drift from the zone the site is
 * displayed in.
 */
const START = localMidnightOf("2026-08-17");
const END = localMidnightOf("2026-08-18");
const HOUR = 3_600_000;

/** About 6:14 AM and 7:32 PM at La Jolla Shores on this date. */
const SUNRISE = START + 6 * HOUR + 14 * 60_000;
const SUNSET = START + 19 * HOUR + 32 * 60_000;

function hourly(values: readonly number[], published = true): SparkPoint[] {
  return values.map((value, hour) => ({
    atMs: START + hour * HOUR,
    value,
    published,
  }));
}

/** A day that dips hard at 3 AM -- the overnight low ADR-0023 dropped. */
const OVERNIGHT_DIP = hourly([
  3, 2.4, 1.2, 0.2, 1.1, 2.2, 3.1, 3.9, 4.4, 4.6, 4.3, 3.8, 3.1, 2.5, 2.1, 2.0,
  2.4, 3.1, 3.9, 4.5, 4.8, 4.6, 4.1, 3.5,
]);

/**
 * Each tab's source, written out rather than imported from `tideStation.ts` and
 * `mopLine.ts`.
 *
 * This component looks nothing up: it prints what the caller composed. A
 * fixture sharing the constants could not tell a chart printing its caller's
 * words from one that had gone and found its own.
 */
const TIDE_SOURCE = {
  label: "Tide",
  source: "La Jolla (Scripps Institution Wharf)",
  network: "NOAA Tides & Currents",
};

const SWELL_SOURCE = {
  label: "Swell",
  source: "MOP line D0481",
  network: "CDIP, Scripps Institution of Oceanography",
  note: "a model of the swell at 10 m depth, not a measurement",
};

/** The tab this chart opens on, and the one every test here drives unless it says otherwise. */
const TIDE = {
  key: "tide",
  label: "Tide",
  unitLabel: "ft",
  points: OVERNIGHT_DIP as readonly SparkPoint[],
  description: "Tide through Monday, 0.2 to 4.8 feet",
  absence: "No hourly prediction for this day.",
  provenance: TIDE_SOURCE,
};

/**
 * A second tab, three-hourly, so the swell's cadence has something to be
 * different from. Eight published estimates and the sixteen hours between
 * them, which is what CDIP's grid looks like in Pacific time.
 */
const SWELL = {
  key: "swell",
  label: "Swell",
  unitLabel: "ft",
  points: Array.from({ length: 24 }, (_, hour) => ({
    atMs: START + hour * HOUR,
    value: 2 + Math.sin(hour / 4),
    published: hour % 3 === 2,
  })) as readonly SparkPoint[],
  description: "Swell through Monday, three-hourly",
  absence: "No swell forecast reaches this day.",
  provenance: SWELL_SOURCE,
};

const PROPS = {
  startMs: START,
  endMs: END,
  sunriseMs: SUNRISE,
  sunsetMs: SUNSET,
  series: [TIDE],
};

/** The same chart with the tide tab drawing something other than the usual day. */
function tideOf(points: readonly SparkPoint[]) {
  return [{ ...TIDE, points }];
}

function plot(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("expected a plot");
  return svg as SVGSVGElement;
}

/** The `d` of the series path, as [x, y] pairs. */
function pathPoints(container: HTMLElement): [number, number][] {
  // `[data-curve]` rather than the first `<path>`: the fill under the curve is
  // a path too and it draws first, so a bare `path` query silently measured the
  // fill -- a shape closed to the foot of the frame, which would have made
  // several of these assertions meaningless.
  const path = container.querySelector("[data-curve]");
  if (path === null) throw new Error("expected a curve");
  return (path.getAttribute("d") ?? "")
    .split(/(?=[ML])/)
    .filter((step) => step.trim() !== "")
    .map((step) => {
      const [x, y] = step.slice(1).trim().split(/\s+/).map(Number);
      return [x, y] as [number, number];
    });
}

describe("the whole day, which is what discharges ADR-0023", () => {
  test("plots all twenty-four hours, not only the daylight window", () => {
    // THE POINT OF THIS COMPONENT. ADR-0023 dropped the overnight extreme from
    // six week cells of seven "until a day view carries them". A chart that
    // started at sunrise would leave that debt exactly where it was.
    const { container } = render(<HourChart {...PROPS} />);

    expect(pathPoints(container)).toHaveLength(24);
  });

  test("draws the overnight low inside a band that is visibly night", () => {
    // The figure ADR-0023 could not fit as a number. It is carried here as a
    // dip a reader can see is in the dark, which is the whole argument that
    // drawing it costs nothing the label did.
    const { container } = render(<HourChart {...PROPS} />);

    const points = pathPoints(container);
    const lowest = points.reduce((a, b) => (b[1] > a[1] ? b : a));
    const beforeDawn = container.querySelector('[data-night="before-dawn"]');
    if (beforeDawn === null) throw new Error("expected a night band");

    const from = Number(beforeDawn.getAttribute("x"));
    const to = from + Number(beforeDawn.getAttribute("width"));
    // The 3 AM low sits inside the band, not merely near it.
    expect(lowest[0]).toBeGreaterThanOrEqual(from);
    expect(lowest[0]).toBeLessThanOrEqual(to);
  });

  test("shades both ends of the day, because a day starts and ends dark", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelector('[data-night="before-dawn"]')).toBeDefined();
    expect(container.querySelector('[data-night="after-dusk"]')).toBeDefined();
    expect(container.querySelectorAll("[data-night]")).toHaveLength(2);
  });

  test("every label is markup, so none of them shrinks with the frame", () => {
    // An SVG <text> scales with the viewBox: a label that reads at 1536 renders
    // about 4px at 375. Keeping the scales in markup is what makes the plot
    // readable at a phone's width, and it is why the SVG holds only geometry.
    const { container } = render(<HourChart {...PROPS} />);

    expect(plot(container).querySelectorAll("text")).toHaveLength(0);
    expect(container.querySelector('[data-axis="low"]')?.tagName).toBe("SPAN");
    expect(container.querySelector('[data-axis-hour="6"]')?.tagName).toBe(
      "SPAN",
    );
  });

  test("cloud is a band outside the plot, sharing no pixel with the night shading", () => {
    // The fault this chart was rebuilt for, twice. As a full-height wash, cloud
    // and night were two greys of similar weight over the same ground. As a
    // strip inside the frame it still crossed the night band, because night
    // runs the plot's full height. Out of the frame entirely is what finally
    // makes them independent: cloud is a band about the sky, the plot is a
    // frame about the sea, and no pixel belongs to both.
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 8 * HOUR, value: 60, published: true }]}
      />,
    );

    const svgs = [...container.querySelectorAll("svg")];
    const cloudSvg = svgs.find(
      (svg) => svg.querySelector("[data-cloud-percent]") !== null,
    );
    const plotSvg = svgs.find(
      (svg) => svg.querySelector("[data-curve]") !== null,
    );

    expect(cloudSvg).toBeDefined();
    expect(plotSvg).toBeDefined();
    expect(cloudSvg).not.toBe(plotSvg);
    expect(plotSvg?.querySelectorAll("[data-cloud-percent]")).toHaveLength(0);
    expect(cloudSvg?.querySelectorAll("[data-night]")).toHaveLength(0);
  });

  test("the band is labelled, and keyed in percentages rather than in words", () => {
    // NAMING THE BANDS WOULD REVERSE ADR-0024. That decision measured this site
    // banding cloud cover on the National Weather Service's own scale and
    // disagreeing with the National Weather Service on three days of six. The
    // publisher's own wording now sits directly above this chart, so a banded
    // word here would contradict a sentence the reader can see at the time.
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 8 * HOUR, value: 60, published: true }]}
      />,
    );

    expect(screen.getByText("Cloud")).toBeDefined();

    const key = container.querySelector("[data-cloud-key]");
    expect(key).not.toBeNull();
    expect(key?.textContent).toContain("0%");
    expect(key?.textContent).toContain("100%");
    for (const verdict of ["sunny", "cloudy", "clear", "overcast", "fair"]) {
      expect(key?.textContent?.toLowerCase()).not.toContain(verdict);
    }
  });

  test("no band and no key when the forecast said nothing about the sky", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelector("[data-cloud-key]")).toBeNull();
    expect(container.querySelectorAll("[data-cloud-percent]")).toHaveLength(0);
  });
});

describe("the now line", () => {
  test("appears on today", () => {
    const { container } = render(
      <HourChart {...PROPS} nowMs={START + 14 * HOUR} />,
    );

    const now = container.querySelector("[data-now]");
    if (now === null) throw new Error("expected a now line");
    // 2 PM is 14/24 of the way across the plot area, past the left gutter.
    const x1 = Number(now.getAttribute("x1"));
    expect(x1).toBe(Number(now.getAttribute("x2")));
    expect(x1).toBeGreaterThan(0);
  });

  test("appears on no other day", () => {
    // A vertical rule at an instant is a claim about the present. Drawing one
    // on Thursday would tell a reader they are standing in Thursday.
    const { container } = render(<HourChart {...PROPS} nowMs={null} />);

    expect(container.querySelector("[data-now]")).toBeNull();
  });

  test("is not drawn for an instant outside this day", () => {
    // The caller passing yesterday's clock is a bug, and a line clamped to the
    // frame's edge would hide it behind a plausible-looking marker.
    const { container } = render(<HourChart {...PROPS} nowMs={END + HOUR} />);

    expect(container.querySelector("[data-now]")).toBeNull();
  });

  test("differs from the curve by more than its colour", () => {
    // Colour is never the only channel separating two marks on this page. The
    // rule is dashed and the curve is not.
    const { container } = render(
      <HourChart {...PROPS} nowMs={START + 2 * HOUR} />,
    );

    const now = container.querySelector("[data-now]");
    expect(now?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(
      container.querySelector("[data-curve]")?.getAttribute("stroke-dasharray"),
    ).toBeNull();
  });
});

describe("the cloud band, which lives here rather than on the sparkline", () => {
  test("names itself separately from the plot, crediting its own publisher", () => {
    // The plot is NOAA's tide and the band is the National Weather Service's
    // sky. One accessible name covering both would credit the wrong publisher
    // for half of what it described.
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 8 * HOUR, value: 60, published: true }]}
        cloudDescription="Cloud cover through Monday, 40 to 70 per cent."
      />,
    );

    const labels = [...container.querySelectorAll("svg")].map((svg) =>
      svg.getAttribute("aria-label"),
    );
    expect(labels).toContain("Cloud cover through Monday, 40 to 70 per cent.");
    expect(labels).toContain(TIDE.description);
  });

  test("a heavier hour washes darker than a lighter one", () => {
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[
          { atMs: START + 8 * HOUR, value: 20, published: true },
          { atMs: START + 9 * HOUR, value: 80, published: true },
        ]}
      />,
    );

    const [light, heavy] = [
      ...container.querySelectorAll("[data-cloud-percent]"),
    ];
    expect(Number(light.getAttribute("fill-opacity"))).toBeLessThan(
      Number(heavy.getAttribute("fill-opacity")),
    );
  });

  test("a forecast 0% is visible, so a clear sky is not silence", () => {
    // Two different facts: a clear sky, and an hour nobody forecast. At zero
    // opacity they would render identically, which is an absence passing for a
    // reading. The floor moved here with the layer, per ADR-0026.
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 8 * HOUR, value: 0, published: true }]}
      />,
    );

    const wash = container.querySelector("[data-cloud-percent]");
    expect(Number(wash?.getAttribute("fill-opacity"))).toBeGreaterThan(0);
  });

  test("an hour the forecast never reached draws nothing at all", () => {
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[
          { atMs: START + 8 * HOUR, value: 40, published: true },
          // Nothing for 9:00. A wash stretched to the next point it did reach
          // would claim cloud for an hour nobody published.
          { atMs: START + 10 * HOUR, value: 40, published: true },
        ]}
      />,
    );

    expect(container.querySelectorAll("[data-cloud-percent]")).toHaveLength(2);
  });

  test("no cloud at all draws no wash, rather than a clear sky", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelectorAll("[data-cloud-percent]")).toHaveLength(0);
  });
});

describe("reading a value off it", () => {
  test("the axis states this day's own range", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelector('[data-axis="low"]')?.textContent).toBe(
      "0.2 ft",
    );
    expect(container.querySelector('[data-axis="high"]')?.textContent).toBe(
      "4.8 ft",
    );
  });

  test("the hours are named in the reader's own clock", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelector('[data-axis-hour="0"]')?.textContent).toBe(
      "12 AM",
    );
    expect(container.querySelector('[data-axis-hour="12"]')?.textContent).toBe(
      "12 PM",
    );
    expect(container.querySelector('[data-axis-hour="15"]')?.textContent).toBe(
      "3 PM",
    );
  });

  test("the extremes are stated as text as well as drawn", () => {
    // The plot is data rather than decoration. What a reader would take off the
    // curve is also written, for anyone who cannot see it and for anyone whose
    // images have not painted.
    render(<HourChart {...PROPS} />);

    expect(screen.getByText(/Low 0\.2 ft/)).toBeDefined();
    expect(screen.getByText(/high 4\.8 ft/)).toBeDefined();
  });

  test("the plot names itself for anyone who cannot see it", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(plot(container).getAttribute("role")).toBe("img");
    expect(plot(container).getAttribute("aria-label")).toBe(TIDE.description);
  });

  test("a bigger value sits higher in the frame", () => {
    // The y axis runs downward in SVG. A component that forgot the flip would
    // draw every day upside down and still render a plausible curve.
    const { container } = render(
      <HourChart
        {...PROPS}
        series={tideOf([
          { atMs: START, value: 1, published: true },
          { atMs: START + 12 * HOUR, value: 5, published: true },
        ])}
      />,
    );

    const [low, high] = pathPoints(container);
    expect(high[1]).toBeLessThan(low[1]);
  });

  test("a flat day draws through the middle, not along the bottom", () => {
    // Dividing by a zero span would be a division by zero, and resolving it to
    // the floor would say "as low as it gets" -- a claim this data does not make.
    const { container } = render(
      <HourChart
        {...PROPS}
        series={tideOf(hourly(Array.from({ length: 24 }, () => 3)))}
      />,
    );

    const ys = pathPoints(container).map(([, y]) => y);
    expect(new Set(ys).size).toBe(1);
    // Midway between the top of the curve's area and the bottom of the frame,
    // which is where a day with no span honestly sits.
    expect(ys[0]).toBe((PAD_FOR_TEST + (HEIGHT_FOR_TEST - PAD_FOR_TEST)) / 2);
  });
});

/** Mirrors the component's own frame constants, which are private to it. */
const HEIGHT_FOR_TEST = 220;
const PAD_FOR_TEST = 8;

describe("published points", () => {
  test("marks what the publisher issued and nothing drawn between", () => {
    // At this size the mechanism starts earning its keep: an hourly tide marks
    // 24 points and a three-hourly swell marks 8, so the two models cannot look
    // alike the way they did at the sparkline's size.
    const { container } = render(
      <HourChart
        {...PROPS}
        series={tideOf([
          { atMs: START, value: 2, published: true },
          { atMs: START + HOUR, value: 3, published: false },
          { atMs: START + 2 * HOUR, value: 4, published: false },
          { atMs: START + 3 * HOUR, value: 5, published: true },
        ])}
      />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  test("an hourly day marks every hour", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelectorAll("circle")).toHaveLength(24);
  });
});

describe("when there is no series", () => {
  test("an unavailable series renders its reason, not an empty frame", () => {
    // A curve is a stronger claim than a figure: a flat line at zero says the
    // sea did something, where a named absence says we were not told.
    const { container } = render(<HourChart {...PROPS} series={tideOf([])} />);

    expect(screen.getByText(TIDE.absence)).toBeDefined();
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("the hour scale at a phone's width", () => {
  test("the quarter-day hours are always shown and the rest degrade", () => {
    // Eight labels at 10px need about 35px each, and a 283px plot gives them 35
    // exactly -- measured on the built page, where "12 PM" touched its
    // neighbours. The quarter-day hours stay at every width; the rest appear
    // from `sm`. Degrading before it lies is the same rule the sparkline follows.
    const { container } = render(<HourChart {...PROPS} />);

    for (const hour of [0, 6, 12, 18]) {
      const label = container.querySelector(`[data-axis-hour="${hour}"]`);
      expect(label?.className).not.toContain("hidden");
    }
    for (const hour of [3, 9, 15, 21]) {
      const label = container.querySelector(`[data-axis-hour="${hour}"]`);
      expect(label?.className).toContain("hidden");
      expect(label?.className).toContain("sm:inline");
    }
  });

  test("midnight is not centred on the plot's left edge", () => {
    // Centred, "12 AM" reaches half its own width to the left of the plot and
    // lands on top of the value scale. It sat on "-0.1 ft" on the built page.
    const { container } = render(<HourChart {...PROPS} />);

    expect(
      container.querySelector('[data-axis-hour="0"]')?.className,
    ).not.toContain("-translate-x-1/2");
    expect(
      container.querySelector('[data-axis-hour="6"]')?.className,
    ).toContain("-translate-x-1/2");
  });
});

describe("choosing an hour", () => {
  test("reads out the hour, the value, the sky and whether the sun was up", () => {
    // Every clause is a fact the page already holds. Nothing here says whether
    // the hour is *good*, which is ADR-0009's line and the one an interactive
    // readout is most likely to cross.
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 9 * HOUR, value: 62, published: true }]}
      />,
    );

    fireEvent.click(container.querySelector('[data-hour-column="9"]')!);

    const readout = container.querySelector("[data-hour-readout]")?.textContent;
    expect(readout).toContain("9 AM");
    expect(readout).toContain("4.6 ft");
    expect(readout).toContain("62% cloud");
    expect(readout).toContain("in daylight");
  });

  test("says an hour is outside daylight when it is", () => {
    const { container } = render(<HourChart {...PROPS} />);

    fireEvent.click(container.querySelector('[data-hour-column="3"]')!);

    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("before sunrise or after sunset");
  });

  test("says so when the forecast published no cloud for that hour", () => {
    // An hour nobody forecast is not a clear sky. The readout is the one place
    // a reader could mistake silence for a reading, because a missing clause
    // would simply look like a shorter sentence.
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 9 * HOUR, value: 62, published: true }]}
      />,
    );

    fireEvent.click(container.querySelector('[data-hour-column="14"]')!);

    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("no cloud forecast");
  });

  test("marks the chosen hour by size as well as by colour", () => {
    // Colour is never the only channel separating two marks on this page.
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelector("[data-selected-mark]")).toBeNull();
    fireEvent.click(container.querySelector('[data-hour-column="9"]')!);

    const chosen = container.querySelector("[data-selected-mark]");
    expect(chosen).not.toBeNull();
    const ordinary = container.querySelector(
      "circle:not([data-selected-mark])",
    );
    expect(Number(chosen?.getAttribute("r"))).toBeGreaterThan(
      Number(ordinary?.getAttribute("r")),
    );
    expect(container.querySelector("[data-selected-guide]")).not.toBeNull();
  });

  test("the summary stays put, so nothing moved behind the interaction", () => {
    // What the brief's no-affordance rule was protecting. The shape, the range
    // and the day's extremes are all still there once an hour is chosen; what
    // selection adds is detail the page never carried at all.
    const { container } = render(<HourChart {...PROPS} />);

    expect(screen.getByText(/Low 0\.2 ft/)).toBeDefined();
    fireEvent.click(container.querySelector('[data-hour-column="9"]')!);
    expect(screen.getByText(/Low 0\.2 ft/)).toBeDefined();
    expect(container.querySelector("[data-curve]")).not.toBeNull();
    expect(container.querySelectorAll("[data-night]")).toHaveLength(2);
  });
});

describe("reaching the hours without a mouse", () => {
  test("the arrow keys walk the day, and stop at both ends", () => {
    const { container } = render(<HourChart {...PROPS} />);
    const group = container.querySelector("[data-hour-columns]")!;

    fireEvent.click(container.querySelector('[data-hour-column="0"]')!);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("1 AM");

    // Midnight is the left end and there is nothing before it. Wrapping to
    // 11 PM would say the day is a loop, which a tide day is not.
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("12 AM");

    fireEvent.keyDown(group, { key: "End" });
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("11 PM");
    fireEvent.keyDown(group, { key: "Home" });
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("12 AM");
  });

  test("one tab stop for the group, not twenty-four", () => {
    // A roving tabindex, the way a radio group behaves. Twenty-four stops would
    // put the rest of the page a day's worth of tabs away.
    const { container } = render(<HourChart {...PROPS} />);

    const stops = [...container.querySelectorAll("[data-hour-column]")].filter(
      (button) => button.getAttribute("tabindex") === "0",
    );
    expect(stops).toHaveLength(1);
  });

  test("each column names itself fully, not by its position", () => {
    // A screen reader landing on a column gets the hour, the reading and the
    // sky without moving to the readout to find out what it just selected.
    const { container } = render(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 9 * HOUR, value: 62, published: true }]}
      />,
    );

    const column = container.querySelector('[data-hour-column="9"]');
    expect(column?.textContent).toContain("9 AM");
    expect(column?.textContent).toContain("4.6 ft");
    expect(column?.textContent).toContain("62% cloud");
  });

  test("the stepper is a real control at the site's touch floor", () => {
    // Twenty-four columns are 33.6px across an 806px plot and 11.8px across a
    // 283px one, against ADR-0004's 44px. The columns are the enhancement; this
    // pair is the guarantee.
    const { container } = render(<HourChart {...PROPS} />);

    for (const selector of ["[data-hour-prev]", "[data-hour-next]"]) {
      const button = container.querySelector(selector);
      expect(button?.tagName).toBe("BUTTON");
      expect(button?.className).toContain(TOUCH_TARGET);
    }
  });

  test("the stepper moves the readout and stops at the ends", () => {
    const { container } = render(<HourChart {...PROPS} />);

    fireEvent.click(container.querySelector("[data-hour-next]")!);
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("12 AM");

    fireEvent.click(container.querySelector("[data-hour-next]")!);
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("1 AM");

    fireEvent.click(container.querySelector('[data-hour-column="23"]')!);
    expect(
      container.querySelector("[data-hour-next]")?.hasAttribute("disabled"),
    ).toBe(true);
  });

  test("the readout announces itself, since nobody is watching it", () => {
    const { container } = render(<HourChart {...PROPS} />);

    expect(
      container.querySelector("[data-hour-readout]")?.getAttribute("aria-live"),
    ).toBe("polite");
  });
});

describe("what a reader without JavaScript gets", () => {
  test("the whole chart, and not one control that cannot work", () => {
    // Asserted against server-rendered markup, because that is the only thing a
    // reader with a blocked script ever sees. ADR-0025 requires the plot itself
    // to render here -- it is the page's primary content -- and
    // `BeachSelector`'s docstring records the other half: a control that
    // silently does nothing is worse than no control. There is nothing to fall
    // back *to* for per-hour detail, since that detail is not on the page in
    // any other form, so the honest fallback is no affordance at all.
    const markup = renderToStaticMarkup(
      <HourChart
        {...PROPS}
        cloud={[{ atMs: START + 9 * HOUR, value: 62, published: true }]}
        nowMs={START + 14 * HOUR}
      />,
    );

    // The chart is all there.
    expect(markup).toContain("data-curve");
    expect(markup).toContain("data-night");
    expect(markup).toContain("data-cloud-percent");
    expect(markup).toContain("data-now");
    expect(markup).toContain("Low 0.2 ft");
    expect(markup).toContain("12 AM");

    // And not one dead button.
    expect(markup).not.toContain("data-hour-column");
    expect(markup).not.toContain("data-hour-prev");
    expect(markup).not.toContain("data-hour-readout");
    expect(markup).not.toContain("<button");
  });
});

describe("the tabs", () => {
  const TABBED = { ...PROPS, series: [TIDE, SWELL] };

  test("names every series, and marks the chosen one by more than colour", () => {
    // ADR-0027's fourth condition, and the accessibility pass's rule that
    // colour is never the only channel. The selected tab takes the site's own
    // pill -- a filled ground where the others have none -- so the selection is
    // a change of shape as well as of ink, and `aria-selected` carries it for
    // anyone who sees neither.
    const { container } = render(<HourChart {...TABBED} />);

    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Tide", "Swell"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
    expect(tabs[0].className).toContain("bg-white");
    expect(tabs[1].className).not.toContain("bg-white");
  });

  test("opens on the first series, never on whichever one has data", () => {
    // A rule the reader could not see from the page would be worse than a quiet
    // first tab: they would have no way to know why the chart opened on the
    // swell one day and the tide the next.
    const { container } = render(
      <HourChart {...TABBED} series={[{ ...TIDE, points: [] }, SWELL]} />,
    );

    expect(screen.getByText(TIDE.absence)).toBeDefined();
    expect(container.querySelector("[data-curve]")).toBeNull();
  });

  test("choosing a tab redraws the foreground and leaves the background alone", () => {
    // The design's first principle at this zoom level: cloud and daylight are
    // the conditions the selected variable happens in, not competitors to it.
    // If the night bands moved when a tab did, the four would be four charts
    // sharing a tile rather than one instrument.
    const cloud = [{ atMs: START + 8 * HOUR, value: 60, published: true }];
    const { container } = render(<HourChart {...TABBED} cloud={cloud} />);

    const bands = () =>
      [...container.querySelectorAll("[data-night]")].map(
        (band) => `${band.getAttribute("x")}/${band.getAttribute("width")}`,
      );
    const cloudHours = () =>
      [...container.querySelectorAll("[data-cloud-percent]")].map((hour) =>
        hour.getAttribute("data-cloud-percent"),
      );

    const nightBefore = bands();
    const cloudBefore = cloudHours();
    const curveBefore = container
      .querySelector("[data-curve]")
      ?.getAttribute("d");

    fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

    expect(bands()).toEqual(nightBefore);
    expect(cloudHours()).toEqual(cloudBefore);
    expect(container.querySelector("[data-curve]")?.getAttribute("d")).not.toBe(
      curveBefore,
    );
  });

  test("a three-hourly tab marks eight points where the hourly one marks twenty-four", () => {
    // THE MECHANISM, at the size it was built for. #171 recorded that these
    // marks are invisible in a 21px sparkline and correctly so; this is where
    // they earn their keep, because an hourly model and a three-hourly one are
    // now drawn in the same frame one tap apart.
    const { container } = render(<HourChart {...TABBED} />);

    expect(container.querySelectorAll("circle")).toHaveLength(24);
    fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);
    expect(container.querySelectorAll("circle")).toHaveLength(8);
  });

  test("each tab states its own unit and its own spoken description", () => {
    const { container } = render(
      <HourChart {...TABBED} series={[TIDE, { ...SWELL, unitLabel: "m" }]} />,
    );

    expect(plot(container).getAttribute("aria-label")).toBe(TIDE.description);

    fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

    expect(plot(container).getAttribute("aria-label")).toBe(SWELL.description);
    expect(
      container.querySelector('[data-axis="high"]')?.textContent,
    ).toContain("m");
  });

  test("a tab whose feed is quiet says why, and keeps the bar", () => {
    // The absence used to replace the whole component, which was right with one
    // series and would strand a reader now: they would have chosen a tab and
    // lost the control that got them there.
    const { container } = render(
      <HourChart {...TABBED} series={[TIDE, { ...SWELL, points: [] }]} />,
    );

    fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

    expect(screen.getByText(SWELL.absence)).toBeDefined();
    expect(container.querySelector("[data-curve]")).toBeNull();
    expect(container.querySelector('[data-series-tab="tide"]')).not.toBeNull();
  });

  test("a quiet tab draws no cloud band either, so nothing frames an empty frame", () => {
    const { container } = render(
      <HourChart
        {...TABBED}
        series={[{ ...TIDE, points: [] }, SWELL]}
        cloud={[{ atMs: START + 8 * HOUR, value: 60, published: true }]}
      />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  test("the chosen hour survives a change of tab", () => {
    // Why the selection is held as an instant rather than as an index. An index
    // means something different in each series -- a swell that ran out at
    // teatime has fewer points -- so index 9 would land on 9 AM in one tab and
    // mid-afternoon in another.
    const { container } = render(<HourChart {...TABBED} />);

    fireEvent.click(container.querySelector('[data-hour-column="9"]')!);
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("9 AM");

    fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);
    expect(
      container.querySelector("[data-hour-readout]")?.textContent,
    ).toContain("9 AM");
  });

  test("the tabs walk with the arrow keys and stop at both ends", () => {
    const { container } = render(<HourChart {...TABBED} />);

    const tablist = container.querySelector('[role="tablist"]')!;
    const chosen = () =>
      container
        .querySelector('[role="tab"][aria-selected="true"]')
        ?.getAttribute("data-series-tab");

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(chosen()).toBe("swell");
    // Stops rather than wrapping, which is the rule the hour columns follow.
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(chosen()).toBe("swell");
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(chosen()).toBe("tide");
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(chosen()).toBe("tide");
    fireEvent.keyDown(tablist, { key: "End" });
    expect(chosen()).toBe("swell");
  });

  test("one tab stop for the bar, not one per tab", () => {
    // A roving tabindex, the way a radio group behaves. One stop per tab would
    // put three keystrokes between a reader and the plot every time they
    // passed it.
    const { container } = render(<HourChart {...TABBED} />);

    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(
      tabs.filter((tab) => tab.getAttribute("tabindex") === "0"),
    ).toHaveLength(1);
  });

  test("the tabs are real controls at the site's touch floor", () => {
    // ADR-0027's third condition, and the one a new control is most likely to
    // miss because it only fails at a width nobody develops at. Composing the
    // constant does not prove 44px renders -- jsdom applies no stylesheets --
    // so this asserts the element refers to the standard.
    const { container } = render(<HourChart {...TABBED} />);

    for (const tab of container.querySelectorAll('[role="tab"]')) {
      expect(tab.className).toContain(TOUCH_TARGET);
    }
  });

  test("the panel is named by the tab that chose it", () => {
    const { container } = render(<HourChart {...TABBED} />);

    const panel = container.querySelector('[role="tabpanel"]');
    const selected = container.querySelector(
      '[role="tab"][aria-selected="true"]',
    );
    expect(panel?.getAttribute("aria-labelledby")).toBe(selected?.id);
    expect(selected?.getAttribute("aria-controls")).toBe(panel?.id);
  });

  test("without a script the band names the drawn series and offers no tab", () => {
    // The same rule the hour controls follow, for the same reason: four words
    // that look like controls and are not is the failure `BeachSelector`'s
    // `noscript` list exists to prevent. There is nothing to fall back *to* --
    // the other series are not on the page in any other form -- so the honest
    // fallback is the one that was drawn, named.
    const markup = renderToStaticMarkup(<HourChart {...TABBED} />);

    expect(markup).toContain("Tide");
    expect(markup).not.toContain('role="tab"');
    expect(markup).not.toContain("data-series-tab");
    expect(markup).not.toContain('role="tabpanel"');
    expect(markup).toContain("data-curve");
  });
});

describe("who published the curve", () => {
  const TABBED = { ...PROPS, series: [TIDE, SWELL] };

  /** The chart's own attribution, and nothing else on the page that looks like one. */
  function line(container: HTMLElement): HTMLElement | null {
    return container.querySelector("[data-series-provenance] p");
  }

  test("the line names the tab that is selected, not the tab that opened", () => {
    // Four tabs and three publishers, so one line for the chart would be wrong
    // on at least two of them. This is the whole of finding 1 in the day view's
    // design review.
    const { container } = render(<HourChart {...TABBED} />);

    expect(line(container)?.textContent).toContain("NOAA Tides & Currents");

    fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

    expect(line(container)?.textContent).toContain("MOP line D0481");
    expect(line(container)?.textContent).not.toContain("NOAA");
  });

  test("a series with no source prints no line rather than an empty one", () => {
    // 26 of 51 beaches bind no MOP line, and a beach with no tide station or no
    // forecast cell has nothing to name either. A `ProvenanceLine` with an
    // empty source would be a credit to nobody dressed as a credit.
    const { container } = render(
      <HourChart {...PROPS} series={[{ ...TIDE, provenance: null }]} />,
    );

    expect(container.querySelector("[data-curve]")).not.toBeNull();
    expect(line(container)).toBeNull();
  });

  test("a quiet tab prints no attribution, because its absence names the publisher", () => {
    // What is attributed is the curve. There is none here, and the sentence in
    // its place already says which publisher went quiet -- that is what
    // `DayPanel`'s per-product wording exists for.
    const { container } = render(
      <HourChart {...PROPS} series={[{ ...TIDE, points: [] }]} />,
    );

    expect(screen.getByText(TIDE.absence)).toBeDefined();
    expect(line(container)).toBeNull();
  });

  test("the line is legible on the chart's own ground, not a card's", () => {
    // `ProvenanceLine` defaults to the reading card's colour -- white at 55%,
    // which paints 1.03:1 on cream and shipped that way from two call sites.
    // This chart's shell is `bg-white/60`, lighter still.
    const { container } = render(<HourChart {...TABBED} />);

    expect(line(container)?.getAttribute("class")).toContain("text-fog");
    expect(line(container)?.getAttribute("class")).not.toContain("text-white");
  });

  test("the attribution survives choosing an hour", () => {
    // ADR-0027's additive condition: an interaction may reveal what the page
    // did not carry and may never put something written behind a gesture.
    const { container } = render(<HourChart {...TABBED} />);

    fireEvent.click(container.querySelector('[data-hour-column="9"]')!);

    expect(line(container)?.textContent).toContain("NOAA Tides & Currents");
  });
});

describe("the frame on a phone", () => {
  test("the plot's shape changes below sm, and the drawing stretches to fill it", () => {
    // One aspect ratio cannot serve 806px and 237px. Measured on the built page
    // 2026-08-28: the frame's own 3.27:1 renders 246px at 1536 and 72px at 375.
    // Below `sm` the frame is 2:1 instead and the drawing stretches into it,
    // which is what takes 375 to 119px and 320 to 91px.
    const { container } = render(<HourChart {...PROPS} />);

    const frame = container.querySelector("[data-series-panel] .relative");
    expect(frame?.className).toContain(NARROW_FRAME);
    expect(plot(container).getAttribute("preserveAspectRatio")).toBe("none");
  });

  test("the literal Tailwind needs is written out, not composed", () => {
    // ADR-0006: source detection scans `src/` for literal strings, so a class
    // built from template parts compiles to nothing and fails only on a device
    // no test runs on. The `built-css` gate's AT_RULES row is the other half --
    // this class name sits in the markup whether or not a rule was emitted for
    // it, so jsdom finds it either way.
    expect(NARROW_FRAME).toBe("max-sm:aspect-[2/1]");
  });

  test("a dense series drops its marks on a phone; a sparse one keeps them", () => {
    // Not "narrow screens have no marks". The marks are dropped exactly where
    // they say least: twenty-four of them say "hourly", which is the least
    // surprising cadence on this page, where the swell's eight are the thing a
    // reader needs to tell a coarse model from a fine one.
    const hourlyChart = render(<HourChart {...PROPS} />);
    // `className` on an SVG element is an SVGAnimatedString, not a string.
    expect(
      hourlyChart.container
        .querySelector("[data-marks]")
        ?.getAttribute("class"),
    ).toContain("max-sm:hidden");

    const swellChart = render(<HourChart {...PROPS} series={[SWELL]} />);
    expect(
      swellChart.container.querySelector("[data-marks]")?.getAttribute("class"),
    ).toBe("");
    // And it really is the sparse one keeping them, not nobody having any.
    expect(swellChart.container.querySelectorAll("circle")).toHaveLength(8);
  });

  test("the marks are still in the markup, so nothing is lost above sm", () => {
    // A CSS rule, not a branch: the same server render serves both widths, and
    // at 1536 all twenty-four marks draw. Removing them from the DOM would make
    // the shape depend on a width the server does not know.
    const { container } = render(<HourChart {...PROPS} />);

    expect(container.querySelectorAll("circle")).toHaveLength(24);
  });
});
