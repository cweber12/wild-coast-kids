import { expect, test, vi } from "vitest";
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
 * The slab is gone, and this is the assertion that it stays gone. Three cards
 * stood between the header and the week -- today's lowest tide, the buoy, the
 * air station -- and every figure on two of them moved into the day panel
 * while the third was already printed by the week grid's first column.
 *
 * Asserted as an absence of the components rather than of their text, because
 * their text is exactly what `MeasuredToday` still renders one region down. A
 * check for "2.6 ft" would pass whether the readings moved or were copied.
 */
test("no reading stands between the header and the week", () => {
  const { container } = render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(screen.queryByText(`panel for ${DEFAULT_BEACH_SLUG}`)).toBeNull();
  expect(screen.queryByText(`waves for ${DEFAULT_BEACH_SLUG}`)).toBeNull();
  expect(screen.queryByText(`wind for ${DEFAULT_BEACH_SLUG}`)).toBeNull();

  // And the week is the first thing under the header, which is the order the
  // brief asks for: header, week, day.
  const regions = [...container.querySelectorAll("p")]
    .map((node) => node.textContent ?? "")
    .filter(
      (text) => text.startsWith("week for ") || text.startsWith("day for "),
    );
  expect(regions).toEqual([
    `week for ${DEFAULT_BEACH_SLUG}`,
    `day for ${DEFAULT_BEACH_SLUG}`,
  ]);
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

/**
 * The sighting map is specified in #121 and deferred. The page says what lands
 * there rather than being silent about it, which is the whole point of a
 * reserved slot: a reader can tell the difference between a feature that is
 * coming and one that was never considered.
 */
test("the page names the sighting map as coming rather than staying silent", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(
    screen.getByText(/A map of what people have found here/),
  ).toBeDefined();
});

/**
 * The claim the map is allowed to make, fixed in the copy before the map
 * exists. iNaturalist records where people with phones went, not where animals
 * are, and a slot promising a density surface would commit the page to
 * something the data cannot support (#121).
 */
test("the slot promises a record of reports, never a survey", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(
    screen.getByText(/reported by naturalists, not surveyed by us/),
  ).toBeDefined();
});

/**
 * The tense is the claim. Named animals, a named window and a named place in
 * the past tense read as a report of what was found here, and no such report
 * exists — the map is deferred. On a page whose discipline is that every figure
 * names its station and nothing unmeasured is asserted, this was the one
 * sentence a skimming reader could come away believing.
 *
 * The three forecast slots in `WeekPanel` do not have the problem because each
 * describes a product shape — "Swell height and period for each day" — rather
 * than asserting something about the world. This slot has to read the same way.
 * The rolling week stays in the copy: a seven-day window is what the product
 * is (#121), and under "Will show" it describes the map rather than the coast.
 */
test("the slot says what the map will show, not what was found", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  const slot = screen.getByText(/A map of what people have found here/);

  expect(slot.textContent).toContain(
    "Will show octopus, nudibranchs, sea hares and leopard sharks logged " +
      "near this beach in the past week",
  );
});

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
    screen.getByText(/readings from public instruments, not a safety/),
  ).toBeDefined();
  expect(
    screen.getByText(/Lifeguards and the signs posted at the beach are the/),
  ).toBeDefined();
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

  // Two suspended regions, the week and the day. It was four while the three
  // cards stood here; the measured block's own line is one boundary further in
  // and is checked in `DayPanel.test.tsx`. Asserted so this cannot pass by
  // finding none of them.
  expect(loading.length).toBe(2);
  for (const line of loading) {
    expect(line.toLowerCase()).not.toContain("weather");
    expect(line.toLowerCase()).not.toContain("forecast");
    expect(line.toLowerCase()).not.toContain("surf report");
  }
});
