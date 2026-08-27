import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WindToday } from "./WindToday";
import { DISCLOSURE_TARGET } from "./disclosure";

/** Scripps Pier: the one station this card names, and the only one it reads. */
const PIER = { name: "Scripps Pier", distanceM: 1_381 };

const AIR = {
  kind: "reading" as const,
  airTempF: 71.42,
  windMph: 8.05,
  gustMph: null,
  windDirDegT: 320,
};

const panel = (overrides = {}) => ({
  beachName: "La Jolla Shores Beach",
  airStation: PIER,
  air: AIR,
  ...overrides,
});

test("the temperature is the panel's largest figure", () => {
  // Visibility held this slot once and sat at METAR's ten-mile ceiling most of
  // the time, which made the largest text on the panel a near-constant
  // describing an airport. ADR-0010 demoted it; ADR-0020 removed it.
  render(<WindToday {...panel()} />);

  expect(screen.getByText("71°F").className).toContain("text-stat");
});

test("wind is a figure beneath the temperature, not a sentence", () => {
  // It was a clause in one paragraph, which meant learning the wind speed
  // required reading a sentence. It is a labelled figure now.
  render(<WindToday {...panel()} />);

  expect(screen.getByText("Wind")).toBeDefined();
  expect(screen.getByText("8 mph from the north-west")).toBeDefined();
});

/**
 * ADR-0020 took sky and visibility off this card. The figures were an airport
 * METAR at a median 7.9 km, and `sensor-representativeness.md` §7 holds that
 * ceiling and visibility do not transfer off an aerodrome at any distance.
 * Cloud reaches the reader in the week grid instead, as a forecast for the
 * beach's own cell; no visibility figure is published anywhere.
 *
 * Asserted as an absence because that is what shipped, and an absence nobody
 * asserts is an absence somebody re-adds.
 */
test("no sky and no visibility appear on this card at all", () => {
  render(<WindToday {...panel()} />);

  expect(screen.queryByText("Sky")).toBeNull();
  expect(screen.queryByText("Visibility")).toBeNull();
  expect(screen.queryByText(/miles or more/)).toBeNull();
  expect(screen.queryByText(/Miramar/)).toBeNull();
});

/**
 * ADR-0010 required that one `StatGroup` never span two stations, because the
 * grouping was what let a reader tell which supplied which. With one station
 * left the rule has nothing to separate — and the structure it produced is
 * still the assertion, because a second group appearing here would mean a
 * second provenance arrived without the argument that ADR demands.
 */
test("one station means one group, and a second would need its own argument", () => {
  const { container } = render(<WindToday {...panel()} />);

  const groups = container.querySelectorAll("dl");
  expect(groups.length).toBe(1);
  expect(groups[0].textContent).toContain("Wind");
});

test("the station is named, with its distance", () => {
  // The distance stays now that there is nothing to compare it against. It is
  // what tells a reader how near this reading was taken, which is the claim the
  // card is making.
  render(<WindToday {...panel()} />);

  const air = screen.getByText(/Scripps Pier/).textContent ?? "";
  expect(air).toContain("Temperature and wind");
  expect(air).toContain("about 1.4 km from this beach");
});

test("a near station keeps its distance rather than rounding it away", () => {
  // An older single-station panel hid anything under five kilometres, which
  // threw away most of what this figure says: the air station runs 0.7 km to
  // 7.4 km across the inventory, so "under 5 km" covers nearly all of it.
  render(<WindToday {...panel()} />);

  expect(screen.getByText(/about 1\.4 km from this beach/)).toBeDefined();
});

/**
 * The four tests that stood here asserted how a visibility figure was worded --
 * the ten-mile ceiling as a floor, a sub-mile reading keeping its decimal, the
 * singular "1 mile". They are deleted rather than adapted: the card publishes
 * no visibility, the site publishes none anywhere, and `visibilityWords` went
 * with them. Wording rules for a figure nobody renders are the dead code
 * CLAUDE.md says to delete and let git remember.
 *
 * What replaced them is the absence assertion above, plus `ConditionsNotes`'
 * explanation of why there is no such figure to word.
 */

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

/**
 * Two tests stood here proving the halves failed apart: a failing sky left the
 * temperature standing and a failing temperature left the sky standing. With
 * one half left there is nothing to fail apart FROM, and the property that
 * replaces them is simpler and stricter -- an unavailable air reading is now
 * the only failure this card has.
 */
test("an unavailable reading says so and does not blank the card", () => {
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

  expect(screen.getByText("No temperature just now")).toBeDefined();
  expect(screen.getByText(/Why there is no temperature or wind/)).toBeDefined();
  // The card still names the beach and the station it could not reach.
  expect(screen.getByText(/Scripps Pier/)).toBeDefined();
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
  // Two now, not four: the sky half had a no-station and an unavailable
  // disclosure of its own, and both went with it.
  const renders = [
    render(
      <WindToday
        {...panel({
          airStation: null,
          air: { kind: "no-station", reason: "no station near enough" },
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
        })}
      />,
    ),
  ];

  const summaries = renders.flatMap((r) => [
    ...r.container.querySelectorAll("summary"),
  ]);

  expect(summaries).toHaveLength(2);
  for (const summary of summaries) {
    expect(summary.className).toContain(DISCLOSURE_TARGET);
  }
});

/**
 * A test stood here for the finding as a reader met it: on `fiesta-island` both
 * halves of this card bound to the same station, so it printed "San Diego
 * Airport · 4.7 km from this beach" and "San Diego Airport · 4.7 km away" 80px
 * apart -- the identical fact, phrased two ways, on one card.
 *
 * The scenario cannot occur any more. This card has one binding, so it prints
 * one provenance line and there is no second wording for it to disagree with.
 * The wording rule itself did not go with it: `ProvenanceLine` owns it and its
 * own tests assert it, which is what stops the drift returning the next time
 * two call sites state one fact.
 */

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
