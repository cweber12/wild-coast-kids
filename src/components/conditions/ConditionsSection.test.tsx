import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
vi.mock("@/components/conditions/DayPanel", () => ({
  DayPanel: ({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>day for {slug}</p>;
  },
}));
vi.mock("@/components/conditions/WeekPanel", () => ({
  WeekPanel: ({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>week for {slug}</p>;
  },
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
  measuredPanel.mockReset();
  measuredPanel.mockImplementation(({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>measured for {slug}</p>;
  });
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { ConditionsSection } = await import("./ConditionsSection");
const { inventoryCaveats, DEFAULT_BEACH_SLUG } = await import("@/lib/beaches");

test("the view carries the chooser, the two regions and the caveats", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(screen.getByLabelText("Choose a beach")).toBeDefined();
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
  const { container } = render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

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
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(measuredPanel).toHaveBeenCalledWith({ slug: DEFAULT_BEACH_SLUG });

  // Spelled out rather than left to `toHaveBeenCalledWith`'s exact match, so a
  // reader of this test can see which argument is the forbidden one.
  const [props] = measuredPanel.mock.calls[0] as [Record<string, unknown>];
  expect(Object.keys(props)).toEqual(["slug"]);
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
    },
  },
};

/**
 * The rank followed the block back up, and this is what says so.
 *
 * `ReadingCard` requires `headingLevel` rather than defaulting it, precisely so
 * that a component moving a card has to answer the question. #176 moved these
 * two into the day region and left `h2` behind, making them siblings-in-outline
 * of the heading that contained them. The move back to page level makes `h2`
 * right again -- they are siblings of the three region headings under the
 * `<h1>`, and `h3` here would skip a level with nothing in between.
 */
test("the measured cards rank as page regions, beside the week and the day", async () => {
  const { MeasuredToday } = await import("./MeasuredToday");
  measuredPanel.mockImplementation(() => <MeasuredToday readings={MEASURED} />);

  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  const ranks = screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
  expect(ranks).toContain("Waves and water");
  expect(ranks).toContain("Air");

  // And nothing dropped to a rank that would skip a level under the <h1>.
  expect(
    screen
      .queryAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent),
  ).not.toContain("Waves and water");
});

/**
 * The rank moved and the name did not. The accessible name is composed on the
 * `<section>` from the title and the beach -- `ReadingCard` records why it is an
 * `aria-label` rather than a hidden span -- so it is reachable from the tag and
 * must survive a change to it.
 */
test("a card is still called what it was called, at its new rank", async () => {
  const { MeasuredToday } = await import("./MeasuredToday");
  measuredPanel.mockImplementation(() => <MeasuredToday readings={MEASURED} />);

  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(
    screen.getByRole("region", {
      name: "Waves and water · La Jolla Shores Beach",
    }),
  ).toBeDefined();
  expect(screen.getByRole("heading", { name: "Waves and water" }).id).toBe(
    "waves-today-heading",
  );
});

test("every caveat the data files carry reaches this page", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

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
test("the page says these are instruments and not a safety assessment", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

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
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

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
 */
test("the safety framing is stated once, above the readings", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

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
  const { container } = render(<ConditionsSection slug={SUSPEND} />);

  const loading = [...container.querySelectorAll("p")]
    .map((node) => node.textContent ?? "")
    .filter((text) => text.startsWith("Reading "));

  // Three suspended regions: the measured block, the week and the day. It was
  // two while the measured block sat inside the day panel, on a boundary this
  // check could not see from here -- so its line was asserted in
  // `DayPanel.test.tsx` instead, and moved back here with the block. Asserted
  // as a count so this cannot pass by finding none of them.
  expect(loading.length).toBe(3);
  for (const line of loading) {
    expect(line.toLowerCase()).not.toContain("weather");
    expect(line.toLowerCase()).not.toContain("forecast");
    expect(line.toLowerCase()).not.toContain("surf report");
  }
});
