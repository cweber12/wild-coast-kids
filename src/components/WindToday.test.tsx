import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WindToday } from "./WindToday";
import { DISCLOSURE_TARGET } from "./disclosure";

/** Scripps Pier: what La Jolla Shores now reads for temperature and wind. */
const PIER = { name: "Scripps Pier", distanceM: 1_381 };
/** Miramar: what it still reads for sky and visibility, ten kilometres inland. */
const KNKX = { name: "Miramar", distanceM: 10_429 };

const AIR = {
  kind: "reading" as const,
  airTempF: 71.42,
  windMph: 8.05,
  gustMph: null,
  windDirDegT: 320,
};

const SKY = {
  kind: "reading" as const,
  visibilityMi: 10.0,
  visibilityAtCeiling: true,
  sky: "Clear",
};

const panel = (overrides = {}) => ({
  beachName: "La Jolla Shores Beach",
  airStation: PIER,
  skyStation: KNKX,
  air: AIR,
  sky: SKY,
  ...overrides,
});

test("the temperature is the panel's largest figure and visibility is not", () => {
  // Visibility held this slot and sits at METAR's ten-mile ceiling most of the
  // time, which made the largest text on the panel a near-constant describing
  // an airport. See ADR 0010.
  render(<WindToday {...panel()} />);

  expect(screen.getByText("71°F").className).toContain("text-stat");
  expect(screen.getByText("10 miles or more").className).not.toContain(
    "text-stat",
  );
});

test("wind, sky and visibility are figures beneath the temperature, not a sentence", () => {
  // They were clauses in one paragraph, which meant learning the wind speed
  // required reading a sentence. Each is a labelled figure now.
  render(<WindToday {...panel()} />);

  expect(screen.getByText("Wind")).toBeDefined();
  expect(screen.getByText("8 mph from the north-west")).toBeDefined();
  expect(screen.getByText("Sky")).toBeDefined();
  expect(screen.getByText("Clear")).toBeDefined();
  expect(screen.getByText("Visibility")).toBeDefined();
  expect(screen.getByText("10 miles or more")).toBeDefined();
});

/**
 * ADR-0010's requirement, asserted structurally rather than by reading prose.
 * The four figures come from two stations at very different distances, and the
 * grouping is what lets a reader tell which supplied which. One group must
 * never span both.
 */
test("the figures are grouped by the station that supplied them", () => {
  const { container } = render(<WindToday {...panel()} />);

  const groups = container.querySelectorAll("dl");
  expect(groups.length).toBe(2);

  const wind = groups[0].textContent ?? "";
  expect(wind).toContain("Wind");
  expect(wind).not.toContain("Visibility");

  const sky = groups[1].textContent ?? "";
  expect(sky).toContain("Visibility");
  expect(sky).not.toContain("Wind");
});

test("both stations are named, each with its own distance", () => {
  // The cost of the two-provenance decision, and deliberately not hidden: a
  // reader who cannot tell which station supplied which figure is worse off
  // than one who has to read two lines.
  render(<WindToday {...panel()} />);

  const air = screen.getByText(/Scripps Pier/).textContent ?? "";
  expect(air).toContain("Temperature and wind");
  expect(air).toContain("1.4 km from this beach");

  const sky = screen.getByText(/Miramar/).textContent ?? "";
  expect(sky).toContain("Sky and visibility");
  expect(sky).toContain("10 km away");
});

test("a near station keeps its distance rather than rounding it away", () => {
  // The single-station panel hid anything under five kilometres. With two
  // stations named that makes them incomparable, and comparing them is what
  // tells a reader why the sky is less local than the temperature.
  render(<WindToday {...panel()} />);

  expect(screen.getByText(/1\.4 km from this beach/)).toBeDefined();
});

/**
 * "Why the sky comes from an airport" moved to `ConditionsNotes`, and is
 * asserted there. It is true at every beach on the site, so it was collected
 * with the rest of the shared explanation rather than sitting under this one
 * panel. What this panel still owes the reader — both stations named, each with
 * its own distance — is asserted above.
 */

test("the ten-mile ceiling reads as a floor, never as an exact measurement", () => {
  render(<WindToday {...panel()} />);

  expect(screen.getByText("10 miles or more")).toBeDefined();
});

test("a visibility below the ceiling is given as the measurement it is", () => {
  render(
    <WindToday
      {...panel({
        sky: { ...SKY, visibilityMi: 8.0, visibilityAtCeiling: false },
      })}
    />,
  );

  expect(screen.getByText("8 miles")).toBeDefined();
});

test("a visibility under a mile keeps its decimal, being the reading that matters", () => {
  // Rounded to whole miles this would render "0 miles", which reads as an
  // instrument fault rather than as thick fog.
  render(
    <WindToday
      {...panel({
        sky: { ...SKY, visibilityMi: 0.25, visibilityAtCeiling: false },
      })}
    />,
  );

  expect(screen.getByText("0.3 miles")).toBeDefined();
});

test("one mile is singular", () => {
  render(
    <WindToday
      {...panel({
        sky: { ...SKY, visibilityMi: 1.2, visibilityAtCeiling: false },
      })}
    />,
  );

  expect(screen.getByText("1 mile")).toBeDefined();
});

test("wind is given in plain words, from the direction it blows from", () => {
  // 320 degrees true. Naming it as the direction the wind blows *towards*
  // would reverse every reading on the page.
  render(<WindToday {...panel()} />);

  expect(screen.getByText("8 mph from the north-west")).toBeDefined();
});

test("a gust is shown when the station published one", () => {
  render(<WindToday {...panel({ air: { ...AIR, gustMph: 14.2 } })} />);

  expect(screen.getByText("Gusting")).toBeDefined();
  expect(screen.getByText("14 mph")).toBeDefined();
});

test("wind with no direction is still given as a speed", () => {
  render(<WindToday {...panel({ air: { ...AIR, windDirDegT: null } })} />);

  expect(screen.getByText("8 mph")).toBeDefined();
});

test("no wind value says so rather than reading as calm", () => {
  // A blank here would read as a still day.
  render(
    <WindToday
      {...panel({ air: { ...AIR, windMph: null, windDirDegT: null } })}
    />,
  );

  expect(screen.getByText("Wind")).toBeDefined();
  expect(screen.getByText("Not reported")).toBeDefined();
});

test("a genuine calm is named as calm, not as a missing reading", () => {
  render(
    <WindToday {...panel({ air: { ...AIR, windMph: 0, windDirDegT: 0 } })} />,
  );

  expect(screen.getByText("Calm")).toBeDefined();
});

/**
 * Regression. The sentence this replaced returned at "The wind is calm" and
 * never reached its gust clause; the first stats version appended one anyway,
 * and the live page rendered "Wind: Calm / Gusting: 2 mph" — a card
 * contradicting itself. Under a knot of wind a gust is instrument noise rather
 * than weather anybody feels.
 */
test("a calm wind reports no gust, however the instrument twitched", () => {
  render(
    <WindToday
      {...panel({
        air: { ...AIR, windMph: 0.4, windDirDegT: 0, gustMph: 2.1 },
      })}
    />,
  );

  expect(screen.getByText("Calm")).toBeDefined();
  expect(screen.queryByText("Gusting")).toBeNull();
});

test("a gust with no wind speed at all is not reported either", () => {
  // "Not reported / Gusting 14 mph" would be the same contradiction wearing a
  // different hat: a gust is a property of a wind we do not have.
  render(
    <WindToday
      {...panel({
        air: { ...AIR, windMph: null, windDirDegT: null, gustMph: 14.2 },
      })}
    />,
  );

  expect(screen.getByText("Not reported")).toBeDefined();
  expect(screen.queryByText("Gusting")).toBeNull();
});

test("a missing temperature says so rather than leaving the panel headed by nothing", () => {
  // Sky and wind may go unsaid on the line beneath. The primary slot cannot: an
  // empty one reads as a rendering fault, and it is the figure the reader came
  // for.
  render(<WindToday {...panel({ air: { ...AIR, airTempF: null } })} />);

  expect(screen.getByText("No temperature reading")).toBeDefined();
});

test("a station publishing no sky simply goes unsaid", () => {
  render(<WindToday {...panel({ sky: { ...SKY, sky: null } })} />);

  expect(screen.queryByText("Sky")).toBeNull();
  // Visibility still renders: it is the other half of the same station.
  expect(screen.getByText("10 miles or more")).toBeDefined();
});

test("an airport publishing no visibility says so rather than rendering blank", () => {
  render(
    <WindToday
      {...panel({
        sky: { ...SKY, visibilityMi: null, visibilityAtCeiling: false },
      })}
    />,
  );

  expect(screen.getByText("Visibility")).toBeDefined();
  expect(screen.getByText("Not reported")).toBeDefined();
});

test("a failing sky never takes the temperature down with it", () => {
  // The two halves are separate fetches to separate networks. Withholding a
  // measured shore temperature because an airport missed a minute would trade
  // the good reading for the irrelevant one.
  render(
    <WindToday
      {...panel({
        sky: {
          kind: "unavailable",
          detail: "NWS KNKX returns 404 for its latest observation.",
          drift: false,
        },
      })}
    />,
  );

  expect(screen.getByText("71°F")).toBeDefined();
  expect(screen.getByText("8 mph from the north-west")).toBeDefined();
  expect(screen.getByText(/returns 404/)).toBeDefined();
  expect(screen.queryByText(/Visibility/)).toBeNull();
});

test("a failing temperature never takes the sky down with it", () => {
  render(
    <WindToday
      {...panel({
        air: {
          kind: "unavailable",
          detail: "NDBC LJAC1 returns 404 for realtime2.",
          drift: false,
        },
      })}
    />,
  );

  expect(screen.getByText("Clear")).toBeDefined();
  expect(screen.getByText("10 miles or more")).toBeDefined();
  expect(screen.getByText("No temperature just now")).toBeDefined();
  expect(screen.getByText(/returns 404/)).toBeDefined();
});

test("drift is disclosed as a bug here rather than a problem upstream", () => {
  render(
    <WindToday
      {...panel({
        air: {
          kind: "unavailable",
          detail: "ATMP is published in degF, not degC.",
          drift: true,
        },
      })}
    />,
  );

  expect(
    screen.getByText(/bug here rather than a problem at the station/),
  ).toBeDefined();
});

test("no air station is a permanent fact about the place, with its reason", () => {
  render(
    <WindToday
      {...panel({
        airStation: null,
        air: {
          kind: "no-station",
          reason:
            "the lower endpoint published upstream (32.1327, -117.1332) is outside San Diego County, so no station can be joined to it",
        },
      })}
    />,
  );

  expect(screen.getByText("No station near enough")).toBeDefined();
  expect(screen.getByText(/outside San Diego County/)).toBeDefined();
  // Never invite a reader to retry something that will never work.
  expect(screen.queryByText(/just now/)).toBeNull();
  expect(screen.queryByText(/Temperature and wind/)).toBeNull();
});

test("no sky station leaves the temperature standing on its own", () => {
  render(
    <WindToday
      {...panel({
        skyStation: null,
        sky: {
          kind: "no-station",
          reason: "no station near this beach publishes a sky description",
        },
      })}
    />,
  );

  expect(screen.getByText("71°F")).toBeDefined();
  expect(screen.getByText(/publishes a sky description/)).toBeDefined();
  expect(screen.queryByText(/Sky and visibility/)).toBeNull();
});

/**
 * ADR-0004's 44px floor, on the elements that were the last thing on this page
 * under it. A `<summary>` is background-less, so it takes the floor at every
 * breakpoint and carries no `md:min-h-0` -- see `disclosure.ts` for why the
 * display is left alone and why the padding is part of the composition.
 *
 * Every summary the component can render rather than a named one, because the
 * failure this repo has is drift: a disclosure added later without the floor.
 * Per ADR-0001 jsdom applies no stylesheets, so this proves the class is
 * referenced, not that the box measures 44px. That stays a human check.
 */
test("every disclosure this card can render composes the touch-target floor", () => {
  // Four of the ten on this page are here, because the two halves fail
  // separately and each has both a no-station and an unavailable disclosure.
  const renders = [
    render(
      <WindToday
        {...panel({
          airStation: null,
          skyStation: null,
          air: { kind: "no-station", reason: "no station near enough" },
          sky: {
            kind: "no-station",
            reason: "nothing near here publishes sky",
          },
        })}
      />,
    ),
    render(
      <WindToday
        {...panel({
          air: {
            kind: "unavailable",
            detail: "NDBC LJAC1 returns 404 for realtime2.",
            drift: false,
          },
          sky: {
            kind: "unavailable",
            detail: "NWS KNKX returns 404 for its latest observation.",
            drift: false,
          },
        })}
      />,
    ),
  ];

  const summaries = renders.flatMap((r) => [
    ...r.container.querySelectorAll("summary"),
  ]);

  expect(summaries).toHaveLength(4);
  for (const summary of summaries) {
    expect(summary.className).toContain(DISCLOSURE_TARGET);
  }
});
