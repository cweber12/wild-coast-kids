import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeasuredBand } from "./MeasuredBand";
import type { MeasuredReadings } from "./bandText";

/** 11:13 AM Pacific. `bandText.test.ts` owns what the figures say; this owns the markup. */
const WAVE_TAKEN_AT_MS = Date.UTC(2026, 7, 17, 18, 13);
/** 10:48 AM Pacific: the older of the two, so it is what the bound must print. */
const AIR_TAKEN_AT_MS = Date.UTC(2026, 7, 17, 17, 48);

const WAVE_READING = {
  kind: "reading",
  heightFt: 2.62,
  periodS: 5,
  directionDegT: 278,
  waterTempF: 69.98,
  observedAtMs: WAVE_TAKEN_AT_MS,
} as const;

const AIR_READING = {
  kind: "reading",
  airTempF: 71.42,
  windMph: 8.05,
  gustMph: null,
  windDirDegT: 320,
  observedAtMs: AIR_TAKEN_AT_MS,
} as const;

function readings(
  overrides: {
    waves?: Partial<MeasuredReadings["waves"]>;
    air?: Partial<MeasuredReadings["air"]>;
  } = {},
): MeasuredReadings {
  return {
    waves: {
      beachName: "La Jolla Shores Beach",
      buoy: { name: "Scripps Nearshore", distanceM: 1400 },
      state: WAVE_READING,
      ...overrides.waves,
    },
    air: {
      beachName: "La Jolla Shores Beach",
      airStation: { name: "Scripps Pier", distanceM: 1381 },
      air: AIR_READING,
      ...overrides.air,
    },
  } as MeasuredReadings;
}

/* =========================================================================
 * One band where there were two cards
 * ========================================================================= */

test("it is one region, not two", () => {
  render(<MeasuredBand readings={readings()} />);

  // ADR-0010 permits two provenances behind one panel. This is the panel.
  expect(screen.getAllByRole("region")).toHaveLength(1);
  expect(screen.queryByRole("region", { name: /^Waves and water/ })).toBeNull();
});

/**
 * A landmark named only "Measured now" loses its context for somebody
 * navigating by region rather than reading top to bottom -- the argument
 * `ReadingCard` made for keeping the beach in its own accessible name. The
 * place is not printed: the header and the chooser already say it.
 */
test("the landmark names the place, and the band does not print it", () => {
  render(<MeasuredBand readings={readings()} />);

  expect(
    screen.getByRole("region", {
      name: "Measured now · La Jolla Shores Beach",
    }),
  ).toBeDefined();
  expect(screen.queryByText("La Jolla Shores Beach")).toBeNull();
});

/** An area page labels the band with the area, since that is what it answers for. */
test("an area's band is named for the area", () => {
  render(
    <MeasuredBand readings={readings({ air: { beachName: "La Jolla" } })} />,
  );

  expect(
    screen.getByRole("region", { name: "Measured now · La Jolla" }),
  ).toBeDefined();
});

/**
 * The two card `<h2>`s left the outline with the cards. What replaces them is
 * nothing: `aria-label` on the region, because the accessible-name algorithm
 * joins adjacent inline text nodes with no separator and this repo uses
 * `sr-only` nowhere.
 */
test("the band contributes no heading to the page outline", () => {
  render(<MeasuredBand readings={readings()} />);

  expect(screen.queryAllByRole("heading")).toHaveLength(0);
});

/* =========================================================================
 * The ground it is printed on
 * ========================================================================= */

/**
 * `CARD_PROSE` and `CARD_MUTED` are white at 75% and 55%, measured against
 * `--color-dark` and against nothing else. White at 55% on this page's cream
 * paints 1.03:1 -- the bug #175 fixed in three places -- so a band that carried
 * the card's classes onto cream would reintroduce it invisibly.
 */
test("the band's colours are the ones measured against its own surface", () => {
  const { container } = render(<MeasuredBand readings={readings()} />);

  const markup = container.innerHTML;
  // The pairings cardText.ts measured against --color-dark: 10.02:1 and 5.96:1.
  expect(markup).toContain("bg-dark");
  expect(markup).toContain("text-white/75");
  expect(markup).toContain("text-white/55");
  // And not `text-fog`, which is chosen against cream and is the wrong half of
  // the same file: each of these is measured against one surface only.
  expect(markup).not.toContain("text-fog");
});

/* =========================================================================
 * The two clocks
 * ========================================================================= */

/**
 * The observation bound is a fact about the past and survives the route's
 * `revalidate = 900` intact; "now" cannot, so it is a client value and renders
 * nothing on the server. A reader with a blocked script keeps the half that is
 * still true. ADR-0054.
 */
test("the server render carries the bound and no clock", () => {
  const markup = renderToStaticMarkup(<MeasuredBand readings={readings()} />);

  expect(markup).toContain("nothing older than 10:48 AM");
});

/**
 * Up to three rows sit behind these figures, so "readings from 10:48 AM" would
 * be false of the buoy's, which is 25 minutes newer. A bound over a set is true
 * of all of them and attributes nothing to any one -- which is also what keeps
 * two networks from standing behind one claim.
 */
test("the time is worded as a bound, never as a point", () => {
  render(<MeasuredBand readings={readings()} />);

  expect(screen.getByText(/nothing older than 10:48 AM/)).toBeDefined();
  expect(screen.queryByText(/readings from/)).toBeNull();
  // The older of the two sources, not the newer.
  expect(screen.queryByText(/11:13 AM/)).toBeNull();
});

test("nothing measured means no bound is printed", () => {
  render(
    <MeasuredBand
      readings={readings({
        waves: {
          buoy: null,
          state: {
            kind: "no-buoy",
            reason: "inside a bay",
            modelAnswersInstead: false,
          },
        },
        air: { air: { kind: "unavailable", detail: "504", drift: false } },
      })}
    />,
  );

  expect(screen.queryByText(/nothing older than/)).toBeNull();
  // But the band still says which station went quiet, rather than rendering
  // empty: CLAUDE.md's "nothing fails silently".
  expect(screen.getByText(/Scripps Pier is not answering/)).toBeDefined();
});

/* =========================================================================
 * The attribution
 * ========================================================================= */

/**
 * ADR-0010's closing guarantee -- "no figure is ever shown without the reader
 * being able to see where it came from" -- kept on the band itself rather than
 * moved into `ConditionsNotes`, which is a `<details>` closed by default at the
 * foot of the page.
 */
test("both instruments are named beneath their figures", () => {
  render(<MeasuredBand readings={readings()} />);

  expect(
    screen.getByText(
      /Waves from Buoy Scripps Nearshore \(NDBC\) · air from Scripps Pier, 1\.4 km away/,
    ),
  ).toBeDefined();
});

test("a station with no recorded distance is still named", () => {
  render(
    <MeasuredBand
      readings={readings({
        air: { airStation: { name: "Scripps Pier", distanceM: null } },
      })}
    />,
  );

  expect(screen.getByText(/air from Scripps Pier/)).toBeDefined();
  expect(screen.queryByText(/km away · air/)).toBeNull();
});

test("no attribution line is drawn when no instrument answered", () => {
  render(
    <MeasuredBand
      readings={readings({
        waves: {
          buoy: null,
          state: {
            kind: "no-buoy",
            reason: "inside a bay",
            modelAnswersInstead: false,
          },
        },
        air: {
          airStation: null,
          air: { kind: "no-station", reason: "no station near enough" },
        },
      })}
    />,
  );

  expect(screen.queryByText(/from Buoy/)).toBeNull();
  expect(screen.getByText(/No air station near enough to read/)).toBeDefined();
});

/* =========================================================================
 * The segments
 * ========================================================================= */

test("a segment with no figures carries no plain-words line", () => {
  const { container } = render(
    <MeasuredBand
      readings={readings({
        air: {
          air: { kind: "unavailable", detail: "504 from NWS", drift: false },
        },
      })}
    />,
  );

  // The wave gloss is still there; the air segment has no figure to gloss, and
  // an empty line beside it would read as a fault.
  expect(screen.getByText("about waist high.")).toBeDefined();
  expect(container.innerHTML).not.toContain("undefined");
});

/** ADR-0015's vocabulary is closed, and the glyphs are decoration to a reader
 *  who cannot see them -- the figures beside them say the same thing in words. */
test("the glyphs are hidden from the accessibility tree", () => {
  const { container } = render(<MeasuredBand readings={readings()} />);

  const glyphs = [...container.querySelectorAll('[aria-hidden="true"]')].map(
    (node) => node.textContent,
  );
  expect(glyphs).toEqual(["🏄", "💨"]);
});

/**
 * The regression: the clock renders nothing on the server and for a reader with
 * a blocked script, so a separator written on the bound's side opened that line
 * on a stray interpunct. Asserted against the server render, which is the one
 * place the bug was visible.
 */
test("the server render opens on no stray separator", () => {
  const markup = renderToStaticMarkup(<MeasuredBand readings={readings()} />);

  // The property is about the line, not about any span: the clock is absent
  // here, so whatever comes first must not lead with a join. Asserted on the
  // text of the whole meta paragraph, which is where a reader sees it.
  expect(metaLineOf(markup).startsWith("nothing older than ")).toBe(true);
});

/** The subordinate line's text, with tags and comment markers taken out. */
function metaLineOf(markup: string): string {
  const meta = markup.slice(markup.lastIndexOf("<p class="));
  return meta
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * All three parts of the meta line are optional, so every separator belongs to
 * the part that can be absent. This is the state where only the attribution
 * survives: the station is named, it did not answer, and nothing was measured
 * for a bound to be about.
 */
test("an attribution with no bound before it opens on no separator", () => {
  const markup = renderToStaticMarkup(
    <MeasuredBand
      readings={readings({
        waves: {
          buoy: null,
          state: {
            kind: "no-buoy",
            reason: "inside a bay",
            modelAnswersInstead: false,
          },
        },
        air: { air: { kind: "unavailable", detail: "504", drift: false } },
      })}
    />,
  );

  expect(metaLineOf(markup).startsWith("Air from Scripps Pier")).toBe(true);
});

/**
 * When the reading was taken and which instrument took it are two questions,
 * and running them together is what made this block read as a grey wall. They
 * cost the same height at 568px, where the run wraps to two lines either way.
 */
test("the clocks and the instruments are on separate lines", () => {
  const { container } = render(<MeasuredBand readings={readings()} />);

  const attribution = container.querySelector("p:last-of-type span.block");
  expect(attribution?.textContent).toContain("Waves from Buoy");
  expect(attribution?.textContent).not.toContain("nothing older than");
});
