import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { HourChart } from "./HourChart";
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

const PROPS = {
  startMs: START,
  endMs: END,
  sunriseMs: SUNRISE,
  sunsetMs: SUNSET,
  variableLabel: "Tide",
  unitLabel: "ft",
  description: "Tide through Monday, 0.2 to 4.8 feet",
  absence: "No hourly prediction for this day.",
};

function plot(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("expected a plot");
  return svg as SVGSVGElement;
}

/** The `d` of the series path, as [x, y] pairs. */
function pathPoints(container: HTMLElement): [number, number][] {
  const path = container.querySelector("path");
  if (path === null) throw new Error("expected a path");
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
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(pathPoints(container)).toHaveLength(24);
  });

  test("draws the overnight low inside a band that is visibly night", () => {
    // The figure ADR-0023 could not fit as a number. It is carried here as a
    // dip a reader can see is in the dark, which is the whole argument that
    // drawing it costs nothing the label did.
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

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
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(container.querySelector('[data-night="before-dawn"]')).toBeDefined();
    expect(container.querySelector('[data-night="after-dusk"]')).toBeDefined();
    expect(container.querySelectorAll("[data-night]")).toHaveLength(2);
  });

  test("every label is markup, so none of them shrinks with the frame", () => {
    // An SVG <text> scales with the viewBox: a label that reads at 1536 renders
    // about 4px at 375. Keeping the scales in markup is what makes the plot
    // readable at a phone's width, and it is why the SVG holds only geometry.
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(plot(container).querySelectorAll("text")).toHaveLength(0);
    expect(container.querySelector('[data-axis="low"]')?.tagName).toBe("SPAN");
    expect(container.querySelector('[data-axis-hour="6"]')?.tagName).toBe(
      "SPAN",
    );
  });

  test("cloud is a strip along the top and never covers the curve's ground", () => {
    // The fault this chart was rebuilt for. Drawn as a full-height wash, cloud
    // and night were two greys of similar weight over the same ground, and a
    // reader had to separate them before the curve said anything. Position does
    // that work now: sky along the top, sea below it, night crossing both.
    const { container } = render(
      <HourChart
        {...PROPS}
        points={OVERNIGHT_DIP}
        cloud={[{ atMs: START + 8 * HOUR, value: 60, published: true }]}
      />,
    );

    const wash = container.querySelector("[data-cloud-percent]");
    const night = container.querySelector("[data-night]");
    const washHeight = Number(wash?.getAttribute("height"));
    const nightHeight = Number(night?.getAttribute("height"));

    expect(washHeight).toBeLessThan(nightHeight / 4);
    // And the curve is plotted clear of it, rather than under it.
    const highest = pathPoints(container).reduce((a, b) =>
      b[1] < a[1] ? b : a,
    );
    expect(highest[1]).toBeGreaterThan(washHeight);
  });
});

describe("the now line", () => {
  test("appears on today", () => {
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} nowMs={START + 14 * HOUR} />,
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
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} nowMs={null} />,
    );

    expect(container.querySelector("[data-now]")).toBeNull();
  });

  test("is not drawn for an instant outside this day", () => {
    // The caller passing yesterday's clock is a bug, and a line clamped to the
    // frame's edge would hide it behind a plausible-looking marker.
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} nowMs={END + HOUR} />,
    );

    expect(container.querySelector("[data-now]")).toBeNull();
  });

  test("differs from the curve by more than its colour", () => {
    // Colour is never the only channel separating two marks on this page. The
    // rule is dashed and the curve is not.
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} nowMs={START + 2 * HOUR} />,
    );

    const now = container.querySelector("[data-now]");
    expect(now?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(
      container.querySelector("path")?.getAttribute("stroke-dasharray"),
    ).toBeNull();
  });
});

describe("the cloud wash, which lives here rather than on the sparkline", () => {
  test("a heavier hour washes darker than a lighter one", () => {
    const { container } = render(
      <HourChart
        {...PROPS}
        points={OVERNIGHT_DIP}
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
        points={OVERNIGHT_DIP}
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
        points={OVERNIGHT_DIP}
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
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(container.querySelectorAll("[data-cloud-percent]")).toHaveLength(0);
  });
});

describe("reading a value off it", () => {
  test("the axis states this day's own range", () => {
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(container.querySelector('[data-axis="low"]')?.textContent).toBe(
      "0.2 ft",
    );
    expect(container.querySelector('[data-axis="high"]')?.textContent).toBe(
      "4.8 ft",
    );
  });

  test("the hours are named in the reader's own clock", () => {
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

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
    render(<HourChart {...PROPS} points={OVERNIGHT_DIP} />);

    expect(screen.getByText(/low 0\.2 ft/)).toBeDefined();
    expect(screen.getByText(/high 4\.8 ft/)).toBeDefined();
  });

  test("the plot names itself for anyone who cannot see it", () => {
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(plot(container).getAttribute("role")).toBe("img");
    expect(plot(container).getAttribute("aria-label")).toBe(PROPS.description);
  });

  test("a bigger value sits higher in the frame", () => {
    // The y axis runs downward in SVG. A component that forgot the flip would
    // draw every day upside down and still render a plausible curve.
    const { container } = render(
      <HourChart
        {...PROPS}
        points={[
          { atMs: START, value: 1, published: true },
          { atMs: START + 12 * HOUR, value: 5, published: true },
        ]}
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
        points={hourly(Array.from({ length: 24 }, () => 3))}
      />,
    );

    const ys = pathPoints(container).map(([, y]) => y);
    expect(new Set(ys).size).toBe(1);
    // Midway between the top of the curve's area and the bottom of the frame,
    // which is where a day with no span honestly sits.
    expect(ys[0]).toBe(
      (CLOUD_H_FOR_TEST + PAD_FOR_TEST + (HEIGHT_FOR_TEST - PAD_FOR_TEST)) / 2,
    );
  });
});

/** Mirrors the component's own frame constants, which are private to it. */
const HEIGHT_FOR_TEST = 220;
const CLOUD_H_FOR_TEST = 18;
const PAD_FOR_TEST = 8;

describe("published points", () => {
  test("marks what the publisher issued and nothing drawn between", () => {
    // At this size the mechanism starts earning its keep: an hourly tide marks
    // 24 points and a three-hourly swell marks 8, so the two models cannot look
    // alike the way they did at the sparkline's size.
    const { container } = render(
      <HourChart
        {...PROPS}
        points={[
          { atMs: START, value: 2, published: true },
          { atMs: START + HOUR, value: 3, published: false },
          { atMs: START + 2 * HOUR, value: 4, published: false },
          { atMs: START + 3 * HOUR, value: 5, published: true },
        ]}
      />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  test("an hourly day marks every hour", () => {
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(24);
  });
});

describe("when there is no series", () => {
  test("an unavailable series renders its reason, not an empty frame", () => {
    // A curve is a stronger claim than a figure: a flat line at zero says the
    // sea did something, where a named absence says we were not told.
    const { container } = render(<HourChart {...PROPS} points={[]} />);

    expect(screen.getByText(PROPS.absence)).toBeDefined();
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("the hour scale at a phone's width", () => {
  test("the quarter-day hours are always shown and the rest degrade", () => {
    // Eight labels at 10px need about 35px each, and a 283px plot gives them 35
    // exactly -- measured on the built page, where "12 PM" touched its
    // neighbours. The quarter-day hours stay at every width; the rest appear
    // from `sm`. Degrading before it lies is the same rule the sparkline follows.
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

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
    const { container } = render(
      <HourChart {...PROPS} points={OVERNIGHT_DIP} />,
    );

    expect(
      container.querySelector('[data-axis-hour="0"]')?.className,
    ).not.toContain("-translate-x-1/2");
    expect(
      container.querySelector('[data-axis-hour="6"]')?.className,
    ).toContain("-translate-x-1/2");
  });
});
