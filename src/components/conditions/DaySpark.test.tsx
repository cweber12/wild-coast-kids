import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DaySpark, type SparkPoint } from "./DaySpark";
import { localMidnightOf } from "@/lib/pacific-time";

/**
 * One ordinary Pacific day. Every instant below is derived from it rather than
 * written as a literal, so the fixture cannot drift from the zone the site is
 * displayed in.
 */
const START = localMidnightOf("2026-08-17");
const END = localMidnightOf("2026-08-18");
const HOUR = 3_600_000;

/** About 6:14 AM and 7:32 PM at La Jolla Shores on this date. */
const SUNRISE = START + 6 * HOUR + 14 * 60_000;
const SUNSET = START + 19 * HOUR + 32 * 60_000;

/** Twenty-four published hours, one per hour, dipping in the small hours. */
function hourly(values: readonly number[], published = true): SparkPoint[] {
  return values.map((value, hour) => ({
    atMs: START + hour * HOUR,
    value,
    published,
  }));
}

const FLAT_DAY = hourly(Array.from({ length: 24 }, () => 3));

const PROPS = {
  startMs: START,
  endMs: END,
  sunriseMs: SUNRISE,
  sunsetMs: SUNSET,
  lowValue: 0,
  highValue: 6,
  description: "Low tide, 0.2 to 5.4 feet",
  absence: "No hourly prediction for this day.",
};

function plot(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("expected a plot");
  return svg as SVGSVGElement;
}

/** The `d` of the one series path, as a list of [x, y] pairs. */
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

describe("the series", () => {
  test("a path is drawn for a given series", () => {
    const { container } = render(<DaySpark {...PROPS} points={FLAT_DAY} />);

    const points = pathPoints(container);
    expect(points).toHaveLength(24);
    // Midnight is the left edge; the last hour is 23/24 of the way across.
    expect(points[0][0]).toBeCloseTo(0, 5);
    expect(points[23][0]).toBeCloseTo((23 / 24) * 240, 2);
  });

  test("a bigger value sits higher in the frame, which is what makes it a shape", () => {
    // The y axis runs downward in SVG. A component that forgot the flip would
    // draw every day upside down and still render a plausible-looking curve.
    const { container } = render(
      <DaySpark
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

  test("the scale comes from the caller, so seven days are one instrument", () => {
    // THE SMALL-MULTIPLE RULE. The same two values drawn against two ranges
    // must land in different places; a component that scaled to its own data
    // would draw these identically and make a flat Tuesday look like a
    // dramatic one.
    const points = [
      { atMs: START, value: 2, published: true },
      { atMs: START + 12 * HOUR, value: 4, published: true },
    ];

    const wide = render(
      <DaySpark {...PROPS} lowValue={0} highValue={10} points={points} />,
    );
    const narrow = render(
      <DaySpark {...PROPS} lowValue={2} highValue={4} points={points} />,
    );

    expect(pathPoints(wide.container)[0][1]).not.toBeCloseTo(
      pathPoints(narrow.container)[0][1],
      2,
    );
    // The narrow range puts them on the frame's own edges; the wide one does not.
    expect(pathPoints(narrow.container)[1][1]).toBeCloseTo(3, 5);
  });

  test("a range with no span draws through the middle, not along the bottom", () => {
    // A day whose every hour is the same value. Dividing by the span would be a
    // division by zero, and resolving it to the floor would say "as low as it
    // gets" -- a claim this data does not make.
    const { container } = render(
      <DaySpark {...PROPS} lowValue={3} highValue={3} points={FLAT_DAY} />,
    );

    expect(pathPoints(container).every(([, y]) => y === 15)).toBe(true);
  });
});

describe("the night band", () => {
  test("it covers the hours outside the daylight window, at both ends", () => {
    const { container } = render(<DaySpark {...PROPS} points={FLAT_DAY} />);

    const before = container.querySelector('[data-night="before-dawn"]');
    const after = container.querySelector('[data-night="after-dusk"]');
    if (before === null || after === null)
      throw new Error("expected both night bands");

    // Sunrise is 6h14m into a 24-hour day: 6.2333/24 of 240 user units.
    expect(Number(before.getAttribute("x"))).toBeCloseTo(0, 5);
    expect(Number(before.getAttribute("width"))).toBeCloseTo(62.33, 1);
    // Sunset is 19h32m in, leaving 4h28m of night.
    expect(Number(after.getAttribute("x"))).toBeCloseTo(195.33, 1);
    expect(Number(after.getAttribute("width"))).toBeCloseTo(44.67, 1);
  });

  test("the two bands leave exactly the daylight window unshaded", () => {
    const { container } = render(<DaySpark {...PROPS} points={FLAT_DAY} />);

    const bands = [...container.querySelectorAll("[data-night]")];
    const shaded = bands.reduce(
      (total, band) => total + Number(band.getAttribute("width")),
      0,
    );
    const daylightHours = (SUNSET - SUNRISE) / HOUR;
    expect(240 - shaded).toBeCloseTo((daylightHours / 24) * 240, 1);
  });

  test("night is drawn over the cloud wash, because a cloudy night is still night", () => {
    const { container } = render(
      <DaySpark
        {...PROPS}
        points={FLAT_DAY}
        cloud={[{ atMs: START, value: 90, published: true }]}
      />,
    );

    const rects = [...plot(container).querySelectorAll("rect")];
    const cloudAt = rects.findIndex((r) =>
      r.hasAttribute("data-cloud-percent"),
    );
    const nightAt = rects.findIndex((r) => r.hasAttribute("data-night"));
    expect(cloudAt).toBeLessThan(nightAt);
  });
});

describe("the cloud wash", () => {
  test("a heavier hour washes darker than a lighter one", () => {
    const { container } = render(
      <DaySpark
        {...PROPS}
        points={FLAT_DAY}
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
    // The two are different facts: one is a clear sky, the other is an hour
    // nobody forecast. At zero opacity they would render identically, which is
    // an absence passing for a reading.
    const { container } = render(
      <DaySpark
        {...PROPS}
        points={FLAT_DAY}
        cloud={[{ atMs: START + 8 * HOUR, value: 0, published: true }]}
      />,
    );

    const wash = container.querySelector("[data-cloud-percent]");
    expect(Number(wash?.getAttribute("fill-opacity"))).toBeGreaterThan(0);
  });

  test("an hour the forecast never reached draws nothing at all", () => {
    const { container } = render(
      <DaySpark
        {...PROPS}
        points={FLAT_DAY}
        cloud={[
          { atMs: START + 8 * HOUR, value: 40, published: true },
          // Nothing for 9:00. A wash stretched to the next point it did reach
          // would claim cloud for an hour nobody published.
          { atMs: START + 10 * HOUR, value: 40, published: true },
        ]}
      />,
    );

    const washes = [...container.querySelectorAll("[data-cloud-percent]")];
    expect(washes).toHaveLength(2);
    // One hour wide each: 240/24 user units, and no wider.
    expect(washes.map((w) => Number(w.getAttribute("width")))).toEqual([
      10, 10,
    ]);
  });

  test("no cloud at all draws no wash, rather than a clear sky", () => {
    const { container } = render(<DaySpark {...PROPS} points={FLAT_DAY} />);
    expect(container.querySelectorAll("[data-cloud-percent]")).toHaveLength(0);
  });
});

describe("published points", () => {
  test("published points are marked and interpolated ones are not", () => {
    // The design's second principle at its smallest: a three-hourly model and
    // an hourly one must not be able to look alike.
    const { container } = render(
      <DaySpark
        {...PROPS}
        points={[
          { atMs: START, value: 2, published: true },
          { atMs: START + HOUR, value: 3, published: false },
          { atMs: START + 2 * HOUR, value: 4, published: false },
          { atMs: START + 3 * HOUR, value: 5, published: true },
        ]}
      />,
    );

    // Four points on the curve, two of them the model's own.
    expect(pathPoints(container)).toHaveLength(4);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  test("a mark sits on the curve it belongs to", () => {
    const { container } = render(
      <DaySpark
        {...PROPS}
        points={[
          { atMs: START, value: 2, published: false },
          { atMs: START + 12 * HOUR, value: 5, published: true },
        ]}
      />,
    );

    const mark = container.querySelector("circle");
    const [, published] = pathPoints(container);
    expect(Number(mark?.getAttribute("cx"))).toBeCloseTo(published[0], 2);
    expect(Number(mark?.getAttribute("cy"))).toBeCloseTo(published[1], 2);
  });

  test("an hourly series marks every hour, which is its real resolution", () => {
    const { container } = render(<DaySpark {...PROPS} points={FLAT_DAY} />);
    expect(container.querySelectorAll("circle")).toHaveLength(24);
  });
});

describe("an empty series", () => {
  test("renders a named absence, never a flat line at zero", () => {
    // A curve is a stronger claim than a figure. A line along the bottom says
    // the sea did something; the words say we were not told.
    const { container } = render(<DaySpark {...PROPS} points={[]} />);

    expect(
      screen.getByText("No hourly prediction for this day."),
    ).toBeDefined();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("path")).toBeNull();
  });
});

describe("what a reader who cannot see it is told", () => {
  test("the shape carries the caller's description as its name", () => {
    render(<DaySpark {...PROPS} points={FLAT_DAY} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Low tide, 0.2 to 5.4 feet",
    );
  });

  test("it is one image rather than a tree of shapes", () => {
    // `role="img"` collapses the whole plot, so the bands, washes and marks are
    // not announced one at a time as unnamed graphics.
    const { container } = render(<DaySpark {...PROPS} points={FLAT_DAY} />);
    expect(plot(container).getAttribute("role")).toBe("img");
  });
});
