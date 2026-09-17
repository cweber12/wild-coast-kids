import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TOOL_WORDMARK } from "../ui/headingRank";

/** The area holding `DEFAULT_BEACH_SLUG`, so the header and the list agree with it. */
const DEFAULT_AREA = "la-jolla";

/*
  Two regions are left with a Suspense boundary this file owns, and both have
  to be holdable open. Each mock throws a never-settling promise for one
  reserved slug and behaves normally for every other, which is what lets the
  tests below read what a waiting reader sees.

  Spelled literally inside the factory rather than referencing the constant:
  `vi.mock` is hoisted above every other statement in the file, so a `const`
  declared beside it is not initialised when the factory is defined.
*/
const SUSPEND = "suspend-the-panels";
const dayPanel = vi.fn();
vi.mock("@/components/conditions/DayPanel", () => ({
  DayPanel: (props: { slug: string }) => dayPanel(props),
}));
const weekPanel = vi.fn();
vi.mock("@/components/conditions/WeekPanel", () => ({
  WeekPanel: (props: { slug: string }) => weekPanel(props),
}));
/*
  The measured block moved up here from the day panel, and its reads came with
  it. Mocked at the component rather than at `@/lib/conditions`, which is the
  shape the two panels above already use and which is also what proves its
  Suspense boundary is real: a block folded into this section synchronously
  could not be stubbed this way.

  `measuredPanel` is reassigned by the two tests that need the real cards
  rendered, because a stub's heading is whatever the stub says and the outline
  is exactly what those two are about.
*/
const measuredPanel = vi.fn();
vi.mock("@/components/conditions/MeasuredPanel", () => ({
  MeasuredPanel: (props: { slug: string }) => measuredPanel(props),
}));

// Reset between tests, because two of them swap in the real cards and the spy
// would otherwise carry that swap into every test after them -- silently, since
// the real cards render figures rather than throwing.
beforeEach(() => {
  ripLevel.mockReset();
  ripLevel.mockImplementation(({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>rip for {slug}</p>;
  });
  measuredPanel.mockReset();
  measuredPanel.mockImplementation(({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>measured for {slug}</p>;
  });
  weekPanel.mockReset();
  weekPanel.mockImplementation(({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>week for {slug}</p>;
  });
  dayPanel.mockReset();
  dayPanel.mockImplementation(({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>day for {slug}</p>;
  });
});
const ripLevel = vi.fn();
vi.mock("@/components/conditions/RipLevel", () => ({
  RipLevel: (props: { slug: string }) => ripLevel(props),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { ConditionsSection } = await import("./ConditionsSection");
const { inventoryCaveats, DEFAULT_BEACH_SLUG } = await import("@/lib/beaches");

test("the view carries the chooser, the two regions and the caveats", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  expect(screen.getByLabelText("Choose an area")).toBeDefined();
  // Reachable by a reader, not merely built: the two regions mount on their
  // own Suspense boundaries, so a section that dropped one would still render
  // and still pass every other assertion here.
  expect(screen.getByText(`week for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  expect(screen.getByText(`day for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  expect(
    screen.getByText("What we are unsure about in this data"),
  ).toBeDefined();
  // The reach is part of what this view owes a reader: the chooser offers 41
  // beaches and the county lists 73, and nothing else on the page says so.
  expect(
    screen.getByText(/answers for \d+ of the \d+ beaches San Diego County/),
  ).toBeDefined();
});

/**
 * The order the brief asks for: what is measured, then the week, then the day.
 *
 * The slab that stood here once is still gone and this still asserts that.
 * Three cards sat between the header and the week -- today's lowest tide, the
 * buoy, the air station -- and the tide one was removed as a duplicate of the
 * week grid's own first column. What came back is the other two, which were
 * never duplicated anywhere: the buoy and the shore station are the only
 * instruments this site reports.
 *
 * Asserted as a sequence rather than as three separate presence checks, because
 * "the readings are on the page" is true of the arrangement this replaces as
 * well. Being *first* is the change.
 */
test("what is measured comes before the week, and the week before the day", () => {
  const { container } = render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  // The tide card stays gone: its figure is the week grid's first column.
  expect(screen.queryByText(`panel for ${DEFAULT_BEACH_SLUG}`)).toBeNull();

  const regions = [...container.querySelectorAll("p")]
    .map((node) => node.textContent ?? "")
    .filter(
      (text) =>
        text.startsWith("measured for ") ||
        text.startsWith("week for ") ||
        text.startsWith("day for "),
    );
  expect(regions).toEqual([
    `measured for ${DEFAULT_BEACH_SLUG}`,
    `week for ${DEFAULT_BEACH_SLUG}`,
    `day for ${DEFAULT_BEACH_SLUG}`,
  ]);
});

/**
 * The contract of the whole slice, and the one a later change is most likely to
 * break without noticing: the block says what the instruments read *now*, and
 * picking Thursday must not move it.
 *
 * Asserted as the shape of the call rather than by choosing a day and re-reading
 * the figures. That second test would pass here whatever the wiring did -- this
 * file mocks the panel, so its output is a stub's and would not move either way
 * -- and it would pass in the real page too, because React does not re-render
 * `children` a provider merely passes through.
 *
 * What is actually true is that there is nothing to follow. The block is
 * rendered outside `SelectedDayProvider` and is handed the beach and nothing
 * else, so no day is in scope for it to read even by mistake. A later change
 * that wired one in would have to add an argument, and that is what fails here.
 */
test("the measured block is asked for a beach and never for a day", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const [props] = measuredPanel.mock.calls[0] as [Record<string, unknown>];

  // An allowlist rather than an exact match, and it grew by one deliberately:
  // `area` arrived when this block learned to answer for an area as well as a
  // beach, and this test caught it, which is the allowlist working. What it
  // must never grow is a day, so that is asserted as its own line rather than
  // left implicit in the list above it.
  expect(Object.keys(props).sort()).toEqual(["area", "slug"]);
  expect(Object.keys(props).some((key) => /day|date/i.test(key))).toBe(false);

  // On a beach page there is no area scope at all, so the block is answering
  // for that beach and nothing wider.
  expect(props.slug).toBe(DEFAULT_BEACH_SLUG);
  expect(props.area).toBeUndefined();
});

/**
 * And on an area page it is handed the area, plus a beach to read through.
 *
 * Which beach cannot matter: a product is only read when every beach in the
 * area binds the same source for it, which `areas.test.ts` asserts over the
 * whole table. Asserted here so that a later change passing a *chosen*
 * representative — rather than any member — has to say so.
 */
test("on an area page the measured block is given the area and a member", () => {
  render(<ConditionsSection areaSlug="la-jolla" beachSlug={null} />);

  const [props] = measuredPanel.mock.calls[0] as [Record<string, unknown>];
  const area = props.area as { name: string; beaches: readonly string[] };

  expect(area.name).toBe("La Jolla");
  expect(area.beaches).toHaveLength(10);
  expect(area.beaches[0]).toBe("la-jolla-shores-beach");
  expect(props.slug).toBe("la-jolla-shores-beach");
});

/**
 * Both instruments, as `MeasuredPanel` hands them over once its reads land.
 * Every other test here stands the panel down to a paragraph, which is all they
 * need; the outline needs the real cards, because a stub's heading is whatever
 * the stub says.
 *
 * These two tests came from `DayPanel.test.tsx` with the block itself. Left
 * there they would have asserted a containment that no longer exists.
 */
const MEASURED = {
  waves: {
    beachName: "La Jolla Shores Beach",
    buoy: { name: "Scripps Nearshore", distanceM: 1400 },
    state: {
      kind: "reading" as const,
      heightFt: 2.62,
      periodS: 5,
      directionDegT: 278,
      waterTempF: 69.98,
      observedAtMs: Date.UTC(2026, 7, 17, 18, 13),
    },
  },
  air: {
    beachName: "La Jolla Shores Beach",
    airStation: { name: "Scripps Pier", distanceM: 1381 },
    air: {
      kind: "reading" as const,
      airTempF: 71.42,
      windMph: 8.05,
      gustMph: null,
      windDirDegT: 320,
      observedAtMs: Date.UTC(2026, 7, 17, 17, 48),
    },
  },
};

/**
 * The two card `<h2>`s left the outline with the cards (ADR-0056), and this is
 * what says the outline is still whole rather than merely shorter.
 *
 * `ReadingCard` required `headingLevel` rather than defaulting it, precisely so
 * that a component moving a card had to answer the question -- #176 moved these
 * two into the day region and left `h2` behind, making them siblings-in-outline
 * of the heading that contained them. The band answers the same question by
 * carrying no heading at all: what is left under the `<h1>` is the three region
 * `<h2>`s, and the day's `<h3>`s under those, with no card level between.
 */
test("the band adds no heading, and skips no level under the h1", async () => {
  const { MeasuredBand } = await import("./MeasuredBand");
  measuredPanel.mockImplementation(() => <MeasuredBand readings={MEASURED} />);

  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const ranks = screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
  expect(ranks).not.toContain("Waves and water");
  expect(ranks).not.toContain("Air");

  // The regions the band sits above are still there and still rank as regions,
  // so the outline lost a level rather than gaining a hole.
  expect(ranks.length).toBeGreaterThan(0);
});

/**
 * A landmark named only "Measured now" loses its context for somebody
 * navigating by region rather than reading the page top to bottom -- which is
 * the argument `ReadingCard` made for keeping the beach in its own accessible
 * name, and the band inherits it. `aria-label` rather than a hidden heading,
 * because the accessible-name algorithm joins adjacent inline text nodes with
 * no separator and this repo uses `sr-only` nowhere.
 */
test("the band is one landmark, named for the place it measures", async () => {
  const { MeasuredBand } = await import("./MeasuredBand");
  measuredPanel.mockImplementation(() => <MeasuredBand readings={MEASURED} />);

  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  expect(
    screen.getByRole("region", {
      name: "Measured now · La Jolla Shores Beach",
    }),
  ).toBeDefined();
  // One region where there were two: the block is one panel now, which is what
  // ADR-0010 permits for two provenances.
  expect(screen.queryByRole("region", { name: /^Waves and water/ })).toBeNull();
});

test("every caveat the data files carry reaches this page", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  // The other half of the check in src/lib/caveats.test.ts: that one asserts
  // nothing is dropped between the files and the loader, this one asserts
  // nothing is dropped between the loader and the reader.
  for (const caveat of inventoryCaveats()) {
    expect(screen.getByText(caveat)).toBeDefined();
  }
});

/*
  The three sighting-slot tests that stood here have moved to DayPanel.test.tsx,
  with the slot itself. This file mocks DayPanel, so leaving them here would
  have left three tests that pass whatever the slot says -- or says not at all.
*/

/**
 * The standing notice ADR-0009 rests on. That decision rejects an embed partly
 * because inside a frame "the host page is asserting something it does not
 * control", and this sentence is the assertion — so the page not carrying it
 * would make a shipped ADR untrue rather than merely leave a gap.
 *
 * Both halves are asserted because the entry this replaced only had the first.
 * `docs/plans/conditions-tool.md` names the second: lifeguards and posted signs
 * on the day are the authority.
 */
/**
 * The page title, after ADR-0058.
 *
 * Two claims, because they can fail apart. The **text** is one word: a headline
 * saying "Check conditions first." was addressed to a reader who has not
 * arrived, and the only ways here are a nav item reading "Conditions" and the
 * landing page's teaser. The **register** is the label one, which is what makes
 * it smaller than the region headings beneath it rather than merely shorter.
 *
 * Asserted by class reference and not by painted size, because jsdom applies no
 * stylesheets (ADR-0001) -- the same contract `TOOL_REGION_HEADING` is held to
 * in `WeekGrid.test.tsx`. What stops the referenced rule silently compiling to
 * nothing is the `stylesheet` gate, and what confirms the rank is visible is a
 * human.
 *
 * The level is asserted too: this decision changes how the title is painted and
 * deliberately does not change the outline, so an `<h1>` that quietly became an
 * `<h2>` would be this change going further than it claimed to.
 */
/**
 * The bar's rows are rows, and they are the same rows whatever is in them.
 *
 * This is a regression test with a specific bug behind it. Every item lived in
 * one `flex-wrap` container, so which line an item landed on was decided by how
 * wide its content happened to be. On a beach page the readings are two
 * segments and wrapped onto their own line; on an area page with no shared buoy
 * they are one segment, fitted beside the controls, and rose into the selector
 * row -- while the rip level, which had not moved, dropped to a line of its
 * own. The bar reshaped itself according to whether a buoy existed, which is
 * the case on fifteen of the eighteen areas.
 *
 * So the property is structural: the readings and the judgement share a
 * container, the controls share a different one, and neither contains the
 * other. jsdom applies no stylesheets (ADR-0001), so this cannot assert where
 * anything paints — but containment is exactly what was wrong, and containment
 * is assertable.
 */
function bar(container: HTMLElement) {
  const wordmark = screen.getByRole("heading", { level: 1 });
  const controls = screen
    .getByLabelText("Choose an area")
    .closest("div")!.parentElement!;
  const readings = screen.getByText(/^measured for/).parentElement!;
  return { container, wordmark, controls, readings };
}

test("the readings and the judgement share a row, and the controls do not", () => {
  const { container } = render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const { controls, readings } = bar(container);

  // The judgement is on the readings' row, not the controls'.
  const judgement = screen.getByText(/^rip for/);
  expect(readings.contains(judgement)).toBe(true);
  expect(controls.contains(judgement)).toBe(false);

  // And the controls are not on the readings' row.
  expect(readings.contains(screen.getByLabelText("Choose an area"))).toBe(
    false,
  );
  expect(controls.contains(screen.getByLabelText("Choose an area"))).toBe(true);
});

/**
 * The same shape with one reading instead of two, which is the case the bug
 * actually appeared in: fifteen of the eighteen areas share no buoy, so the
 * readings are air alone and used to fit beside the controls.
 */
test("a reading with no sea beside it stays on its own row", () => {
  const { container } = render(
    <ConditionsSection areaSlug={DEFAULT_AREA} beachSlug={null} />,
  );

  const { controls, readings } = bar(container);

  expect(readings.contains(screen.getByText(/^rip for/))).toBe(true);
  expect(readings.contains(screen.getByLabelText("Choose an area"))).toBe(
    false,
  );
  expect(controls.contains(screen.getByText(/^measured for/))).toBe(false);
});

/**
 * And the rows are in reading order: what this is, then where, then what is
 * true there. A row that stated a figure before saying which place it described
 * would be stating it of nothing.
 */
test("the bar reads name, then place, then readings", () => {
  const { container } = render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const { wordmark, controls, readings } = bar(container);
  const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

  expect(wordmark.compareDocumentPosition(controls) & FOLLOWING).toBeTruthy();
  expect(controls.compareDocumentPosition(readings) & FOLLOWING).toBeTruthy();

  // The notice closes the bar, outside all three rows.
  const notice = screen.getByText(/Instrument readings, not a safety/);
  expect(readings.contains(notice)).toBe(false);
  expect(readings.compareDocumentPosition(notice) & FOLLOWING).toBeTruthy();
});

/**
 * An area of one beach still gets all three rows, with one control in the
 * middle one. The beach control is the only item in the bar that can be absent,
 * so this is the shape six of the eighteen areas render, and a row built around
 * two controls can break in ways a row with one does not show.
 */
test("an area of one beach keeps its rows with a single control", () => {
  const { container } = render(
    <ConditionsSection areaSlug="sunset-cliffs" beachSlug={null} />,
  );

  const { controls, readings } = bar(container);

  expect(controls.contains(screen.getByLabelText("Choose an area"))).toBe(true);
  expect(screen.queryByLabelText("Choose a beach")).toBeNull();
  expect(readings.contains(screen.getByText(/^rip for/))).toBe(true);
});

test("the page titles itself with a wordmark, not a headline", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const title = screen.getByRole("heading", { level: 1 });
  expect(title.textContent).toBe("Conditions");
  expect(title.className).toContain(TOOL_WORDMARK);

  // The sentence it replaced is gone rather than moved somewhere quieter.
  expect(screen.queryByText(/Check conditions first/)).toBeNull();
});

/**
 * And it does not take the liability sentence down with it.
 *
 * The prototype this layout came from rendered the notice at `--text-2xs`
 * alongside the shrunken title, which would have made the one sentence the site
 * asserts on its own behalf the smallest type in the system. ADR-0009 is what
 * that sentence discharges; ADR-0058 records that it keeps `--text-base`.
 */
test("the standing notice keeps body size when the title loses it", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const notice = screen.getByText(
    /Instrument readings, not a safety assessment/,
  );
  expect(notice.className).toContain("text-base");
  expect(notice.className).not.toContain("text-2xs");
});

test("the page says these are instruments and not a safety assessment", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  expect(
    screen.getByText(/Instrument readings, not a safety assessment/),
  ).toBeDefined();
  expect(
    screen.getByText(/signs posted at the beach are the authority on the day/),
  ).toBeDefined();
});

/**
 * The introduction came off, and this is what may not come off with it.
 *
 * The eyebrow and the lead paragraph described the page to a reader who had
 * already clicked "Conditions" to reach it, and the three of them together with
 * a 56px headline put the first measurement off a 639px window. Removing them
 * is the point of the slice; removing either half of the notice beside them
 * would make a shipped ADR untrue, and the two edits look identical in a diff
 * that is mostly deletions.
 *
 * The lead copy is asserted gone here and asserted present in
 * `src/app/conditions/page.test.tsx`, which checks the metadata description. It
 * is one sentence with two jobs, and only one of them was ever done on the page
 * itself.
 */
test("the self-description is gone and the standing notice is not", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  expect(screen.queryByText(/Surf · Tide · Wind · Visibility/)).toBeNull();
  expect(screen.queryByText(/built by a local/)).toBeNull();
  expect(screen.queryByText(/Know before you go/)).toBeNull();

  expect(screen.getByText(/not a safety assessment/)).toBeDefined();
});

/**
 * Said once. The notes block carried "None of it is a safety assessment" as the
 * fourth of four entries under "How to read these numbers", where it was
 * neither prominent nor a note about how to read a number. It moved rather than
 * being duplicated, which is what this asserts end to end: the section renders
 * `ConditionsNotes` for real, so a regression there fails here.
 *
 * The test said "above the readings" until 2026-09-11 and never asserted it.
 * The notice sits under the bar now rather than beside the title, so the name
 * was describing an order that had moved; once-ness is what it actually checks
 * and is what it now claims.
 */
test("the safety framing is stated once, wherever it sits", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  expect(screen.queryByText(/None of it is a safety assessment/)).toBeNull();
  expect(screen.getAllByText(/not a safety assessment/)).toHaveLength(1);
});

/**
 * Issue #94 stood here. The air panel's loading line said "Reading the weather
 * station…", which was wrong twice over -- singular where the panel read two
 * stations, and using a word `CONTEXT.md`'s `Conditions` entry rejects. The
 * card is gone and so is its line; the rule it broke is checked below, across
 * every fallback this section still owns, and the measured block's own line is
 * checked in `DayPanel.test.tsx` where that boundary now lives.
 */

/**
 * The rule the line above broke, checked across every panel rather than only
 * the one that broke it. `CONTEXT.md`'s `Conditions` entry ends
 * `_Avoid_: weather, forecast, surf report`, and a loading line is the easiest
 * place on the page for one of those to reappear.
 *
 * It caught two more on the day panel, which is this check earning its keep on
 * a region added long after it was written. "Reading today's forecast wording"
 * broke it outright; "Reading what the National Weather Service says about the
 * sky" broke it too, because the agency's own name contains the first banned
 * word. That second catch is worth knowing about before writing a third line:
 * a loading line here cannot name the publisher, which is why the day's says
 * "the sky in words" and the measured block's says "the buoy and the air
 * station".
 */
test("no panel's loading line uses a word the glossary rejects", () => {
  const { container } = render(
    <ConditionsSection areaSlug={DEFAULT_AREA} beachSlug={SUSPEND} />,
  );

  const loading = [...container.querySelectorAll("p")]
    .map((node) => node.textContent ?? "")
    .filter((text) => text.startsWith("Reading "));

  // Four suspended regions: the rip level, the measured block, the week and the
  // day. It was two while the measured block sat inside the day panel, on a
  // boundary this check could not see from here -- so its line was asserted in
  // `DayPanel.test.tsx` instead, and moved back here with the block. Asserted
  // as a count so this cannot pass by finding none of them.
  expect(loading.length).toBe(4);
  for (const line of loading) {
    expect(line.toLowerCase()).not.toContain("weather");
    expect(line.toLowerCase()).not.toContain("forecast");
    expect(line.toLowerCase()).not.toContain("surf report");
  }
});

/**
 * Both routes resolve the slug against `areas.json` before rendering, so this
 * is unreachable from a URL. It throws rather than defaulting because a section
 * about an area that is not in the table has nothing true to say — and because
 * a silent default would render La Jolla's header over somebody else's beaches.
 */
test("it refuses an area that is not in the table", () => {
  expect(() =>
    render(<ConditionsSection areaSlug="atlantis" beachSlug={null} />),
  ).toThrow(/names no area in areas.json/);
});

/**
 * Six of the eighteen areas hold one beach, and those get no control at all: a
 * choice between one thing is not a choice. It was a list of links with a
 * heading over it until 2026-09-11, and the rule it was not drawn under is the
 * rule the control is not drawn under. See ADR-0060.
 */
test("an area of one beach offers no beach control", () => {
  render(<ConditionsSection areaSlug="sunset-cliffs" beachSlug={null} />);

  expect(screen.queryByLabelText("Choose a beach")).toBeNull();
});

/**
 * And an area of several keeps it on the beach page too, opened on the beach
 * being shown. That is what stops moving between two beaches in one area from
 * meaning a trip back up a level — the reason the list sat above the readings
 * on both pages rather than only on the area's.
 */
test("an area of several keeps its control, opened on the beach shown", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const control = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  expect(control.value).toBe(DEFAULT_BEACH_SLUG);
  expect(control.options[0].textContent).toBe("All of La Jolla");
});

/**
 * The week is handed the same pair the measured block is, and the allowlist is
 * here for the reason that one is: what a panel is given decides what it can
 * answer for, and an argument added quietly is how a region comes to answer for
 * something nobody chose.
 *
 * What it must never grow is a *chosen* member. "Read through any beach" is
 * only honest because a product is read only where every beach in the area
 * binds the same source, which `areas.test.ts` asserts over the whole table; a
 * representative passed deliberately would be the thing ADR-0048 rejects.
 */
test("the week is asked for a beach and the area it stands for", () => {
  render(<ConditionsSection areaSlug="la-jolla" beachSlug={null} />);

  const [props] = weekPanel.mock.calls[0] as [Record<string, unknown>];
  expect(Object.keys(props).sort()).toEqual(["area", "slug"]);

  const area = props.area as { name: string; beaches: readonly string[] };
  expect(area.name).toBe("La Jolla");
  expect(area.beaches).toHaveLength(10);
  expect(props.slug).toBe("la-jolla-shores-beach");
});

/** And on a beach page there is no scope at all, so nothing is withheld. */
test("on a beach page the week answers for that beach alone", () => {
  render(<ConditionsSection areaSlug="la-jolla" beachSlug="windansea-beach" />);

  const [props] = weekPanel.mock.calls[0] as [Record<string, unknown>];
  expect(props.slug).toBe("windansea-beach");
  expect(props.area).toBeUndefined();
});

/**
 * The week and the measured block read through the same member, which is what
 * stops one region answering for a different beach than the one beside it.
 * Asserted rather than assumed, because the two call sites composed the pair
 * separately until they were lifted into one.
 */
test("every region on an area page reads through the same member", () => {
  render(<ConditionsSection areaSlug="la-jolla" beachSlug={null} />);

  const [measured] = measuredPanel.mock.calls[0] as [Record<string, unknown>];
  const [week] = weekPanel.mock.calls[0] as [Record<string, unknown>];

  const [day] = dayPanel.mock.calls[0] as [Record<string, unknown>];

  expect(week.slug).toBe(measured.slug);
  expect(day.slug).toBe(measured.slug);
  expect(week.area).toEqual(measured.area);
  expect(day.area).toEqual(measured.area);
});

/**
 * The rip current risk is on an area page, and it is the one product that
 * reaches it without the area's beaches agreeing about a source: the National
 * Weather Service issues one bulletin for a unit larger than any area here.
 * ADR-0050.
 *
 * Read through a member the forecast is issued for rather than the member
 * everything else is read through, which for Tijuana Estuary is a different
 * beach.
 */
test("an area page carries the rip current risk", () => {
  render(<ConditionsSection areaSlug="la-jolla" beachSlug={null} />);

  expect(screen.getByText(/rip for la-jolla-shores-beach/)).toBeDefined();
});

test("the bulletin is read through the member it is issued for", () => {
  render(<ConditionsSection areaSlug="tijuana-estuary" beachSlug={null} />);

  // Everything else reads through the area's first beach, which is the slough.
  const [week] = weekPanel.mock.calls[0] as [Record<string, unknown>];
  expect(week.slug).toBe("tijuana-slough-national-wildlife-refuge");
  // The bulletin does not.
  expect(screen.getByText(/rip for border-field-state-park/)).toBeDefined();
});

/**
 * The day chart takes the same pair, and the allowlist is here for the reason
 * the other two carry one: an argument added quietly is how a region comes to
 * answer for something nobody chose.
 */
test("the day chart is asked for a beach and the area it stands for", () => {
  render(<ConditionsSection areaSlug="la-jolla" beachSlug={null} />);

  const [props] = dayPanel.mock.calls[0] as [Record<string, unknown>];
  expect(Object.keys(props).sort()).toEqual(["area", "slug"]);

  const area = props.area as { name: string; beaches: readonly string[] };
  expect(area.name).toBe("La Jolla");
  expect(area.beaches).toHaveLength(10);
  expect(props.slug).toBe("la-jolla-shores-beach");
});

/**
 * All three regions answer for the area now, and the sentence that stood in for
 * two of them is gone. Asserted as an absence as well as a presence: the
 * placeholder is the thing a later change is most likely to leave behind.
 */
test("an area page carries every region, and no sentence standing in for one", () => {
  render(<ConditionsSection areaSlug="la-jolla" beachSlug={null} />);

  expect(screen.getByText(/measured for la-jolla-shores-beach/)).toBeDefined();
  expect(screen.getByText(/week for la-jolla-shores-beach/)).toBeDefined();
  expect(screen.getByText(/day for la-jolla-shores-beach/)).toBeDefined();
  expect(screen.queryByText(/one beach at a time/)).toBeNull();
});

/**
 * The tool's own `<section>` is a landmark named by its wordmark, so a reader
 * navigating by region hears "Conditions" and not an anonymous region holding
 * three named ones. It carried no name until 2026-09-17.
 */
test("the tool's section is a region named by its wordmark", () => {
  render(
    <ConditionsSection
      areaSlug={DEFAULT_AREA}
      beachSlug={DEFAULT_BEACH_SLUG}
    />,
  );

  const region = screen.getByRole("region", { name: "Conditions" });
  expect(region.tagName).toBe("SECTION");
  expect(region.contains(screen.getByRole("heading", { level: 1 }))).toBe(true);
});
