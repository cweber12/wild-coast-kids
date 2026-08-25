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
  expect(air).toContain("about 1.4 km from this beach");

  const sky = screen.getByText(/Miramar/).textContent ?? "";
  expect(sky).toContain("Sky and visibility");
  expect(sky).toContain("about 10 km from this beach");
});

test("a near station keeps its distance rather than rounding it away", () => {
  // The single-station panel hid anything under five kilometres. With two
  // stations named that makes them incomparable, and comparing them is what
  // tells a reader why the sky is less local than the temperature.
  render(<WindToday {...panel()} />);

  expect(screen.getByText(/about 1\.4 km from this beach/)).toBeDefined();
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

/**
 * The finding as a reader met it. On `fiesta-island` both halves bind to the
 * same station, so one card printed "San Diego Airport · 4.7 km from this
 * beach" and "San Diego Airport · 4.7 km away" 80px apart: the identical fact,
 * phrased two ways, on one card. `ProvenanceLine` owns the wording now, so two
 * lines can only differ where the facts differ.
 */
test("one station bound to both halves is worded the same way twice", () => {
  const AIRPORT = { name: "San Diego Airport", distanceM: 4_700 };

  render(
    <WindToday {...panel({ airStation: AIRPORT, skyStation: AIRPORT })} />,
  );

  const lines = screen
    .getAllByText(/San Diego Airport/)
    .map((line) => line.textContent ?? "");

  expect(lines).toHaveLength(2);
  for (const line of lines) {
    expect(line).toContain("San Diego Airport · about 4.7 km from this beach");
  }
});

/**
 * The brief's card anatomy: "leads with one big number, says what it means in
 * plain words, and then shows its supporting measurements". The tide and waves
 * cards shipped with the line and this one did not, so nothing below the lead
 * figure aligned across the band and three instances of one component read as
 * three different layouts.
 */
test("the card says what its figures mean in plain words", () => {
  render(<WindToday {...panel()} />);

  // 71°F and 8 mph, restated. Never advice: ADR-0009 forbids a verdict, so a
  // Beaufort-style "a gentle breeze" is available and "a good day for it" is
  // not.
  expect(screen.getByText("Mild, with a gentle breeze.")).toBeDefined();
});

test("a calm wind is calm in the words and in the figure", () => {
  render(
    <WindToday {...panel({ air: { ...AIR, windMph: 0.4, gustMph: 2 } })} />,
  );

  expect(screen.getByText("Mild, with no wind.")).toBeDefined();
  expect(screen.getByText("Calm")).toBeDefined();
  // One threshold read by both. Two would let the card say "no wind" above
  // "Gusting 2 mph", which is the contradiction the gust rule already exists
  // to stop.
  expect(screen.queryByText("Gusting")).toBeNull();
});

test("either figure alone still makes a sentence", () => {
  // The two halves of this card fail separately, and so does each field a
  // station publishes: a station carrying a temperature and no wind is a
  // measured absence rather than an outage.
  const { unmount } = render(
    <WindToday {...panel({ air: { ...AIR, windMph: null, gustMph: null } })} />,
  );
  expect(screen.getByText("Mild.")).toBeDefined();
  unmount();

  render(<WindToday {...panel({ air: { ...AIR, airTempF: null } })} />);
  expect(screen.getByText("A gentle breeze.")).toBeDefined();
});

test("no line at all when neither figure arrived", () => {
  render(
    <WindToday
      {...panel({
        air: { ...AIR, airTempF: null, windMph: null, gustMph: null },
      })}
    />,
  );

  // A blank sentence is the same mistake as a blank primary: it reads as a
  // fault rather than as an absence, and this card already refuses one.
  expect(screen.getByText("No temperature reading")).toBeDefined();
  expect(screen.queryByText(/^(Cold|Chilly|Cool|Mild|Warm|Hot)/)).toBeNull();
  expect(screen.queryByText(/breeze|no wind/)).toBeNull();
});

/**
 * The bands themselves, which are the whole of what these two lines say. They
 * are this site's own wording for published figures rather than a standard, so
 * nothing upstream asserts them and this is the only place they are pinned.
 */
test("every temperature band has its own word", () => {
  const bands: [number, string][] = [
    [48, "Cold"],
    [55, "Chilly"],
    [64, "Cool"],
    [71, "Mild"],
    [79, "Warm"],
    [90, "Hot"],
  ];

  for (const [airTempF, word] of bands) {
    const { unmount } = render(
      <WindToday
        {...panel({ air: { ...AIR, airTempF, windMph: null, gustMph: null } })}
      />,
    );

    expect(screen.getByText(`${word}.`)).toBeDefined();
    unmount();
  }
});

test("every wind band has its own words", () => {
  const bands: [number, string][] = [
    [0.4, "No wind."],
    [2, "Barely any wind."],
    [6, "A light breeze."],
    [11, "A gentle breeze."],
    [16, "A moderate breeze."],
    [22, "A fresh breeze."],
    [28, "A strong breeze."],
    [40, "A hard wind."],
  ];

  // Read with no temperature, so the wind is the whole sentence and reaches
  // the capitalising branch the clause form never does.
  for (const [windMph, words] of bands) {
    const { unmount } = render(
      <WindToday
        {...panel({ air: { ...AIR, airTempF: null, windMph, gustMph: null } })}
      />,
    );

    expect(screen.getByText(words)).toBeDefined();
    unmount();
  }
});

/**
 * ADR-0015. 💨 rather than the thermometer it replaced, and rather than 🌬️:
 * the wind face is the obvious Unicode choice and putting a face on a page of
 * instrument readings was the objection to it. 💨 is the one faceless glyph
 * that means moving air, and it is also the one that cannot be read without
 * the dark card beneath it — the glyph and the surface were decided together.
 */
test("the air card is marked by wind rather than by a thermometer", () => {
  const { container } = render(<WindToday {...panel()} />);

  const glyph = container.querySelector('[aria-hidden="true"]');
  expect(glyph?.textContent).toBe("💨");
});
