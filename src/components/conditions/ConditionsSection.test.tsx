import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/conditions/TidePanel", () => ({
  TidePanel: ({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>panel for {slug}</p>;
  },
}));
vi.mock("@/components/conditions/WavePanel", () => ({
  WavePanel: ({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>waves for {slug}</p>;
  },
}));
// A loading line only exists while its panel is unresolved, and these mocks
// resolve at once -- so rendering the fallbacks needs a way to hold the three
// Suspense boundaries open. Each panel mock throws a never-settling promise
// for one reserved slug and behaves normally for every other, which is what
// lets the tests below read what a waiting reader sees.
//
// Spelled literally inside each factory rather than referencing the constant:
// `vi.mock` is hoisted above every other statement in the file, so a `const`
// declared beside them is not initialised when the factory is defined.
const SUSPEND = "suspend-the-panels";
vi.mock("@/components/conditions/WindPanel", () => ({
  WindPanel: ({ slug }: { slug: string }) => {
    if (slug === "suspend-the-panels") throw new Promise(() => {});
    return <p>wind for {slug}</p>;
  },
}));
vi.mock("@/components/conditions/WeekPanel", () => ({
  WeekPanel: ({ slug }: { slug: string }) => <p>week for {slug}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { ConditionsSection } = await import("./ConditionsSection");
const { inventoryCaveats, DEFAULT_BEACH_SLUG } = await import("@/lib/beaches");

test("the view carries the chooser, the reading and the caveats", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(screen.getByLabelText("Choose a beach")).toBeDefined();
  expect(screen.getByText(`panel for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  expect(screen.getByText(`waves for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  // Reachable by a reader, not merely built: the three panels come from three
  // agencies and each is mounted on its own Suspense boundary, so a section
  // that dropped one would still render and still pass every other assertion.
  expect(screen.getByText(`wind for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  // The week is the second half of what this page is for — planning rather
  // than now — and it mounts on its own boundary, so a section that dropped it
  // would still render every card above it.
  expect(screen.getByText(`week for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  expect(
    screen.getByText("What we are unsure about in this data"),
  ).toBeDefined();
  // The reach is part of what this view owes a reader: the chooser offers 41
  // beaches and the county lists 73, and nothing else on the page says so.
  expect(
    screen.getByText(/answers for \d+ of the \d+ beaches San Diego County/),
  ).toBeDefined();
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
 * Issue #94. The air panel's loading line said "Reading the weather station…",
 * which was wrong twice over. It is singular where the panel reads two — air
 * for temperature and wind, sky for cloud and visibility, usually a different
 * station and much further away, which is the whole of ADR-0010. And "weather"
 * is on the `Conditions` glossary's avoid list in `CONTEXT.md`, so it was
 * rendered copy using a word the domain model had already rejected.
 *
 * Asserted through the rendered fallback rather than against a string constant,
 * because what matters is that a reader waiting on the panel sees it.
 */
test("the air panel's loading line names both stations it is reading", () => {
  render(<ConditionsSection slug={SUSPEND} />);

  const loading = screen.getByText(/^Reading the .*stations…$/);
  expect(loading.textContent).toContain("air");
  expect(loading.textContent).toContain("sky");
});

/**
 * The rule the line above broke, checked across all three panels rather than
 * only the one that broke it. `CONTEXT.md`'s `Conditions` entry ends
 * `_Avoid_: weather, forecast, surf report`, and a loading line is the easiest
 * place on the page for one of those to reappear.
 */
test("no panel's loading line uses a word the glossary rejects", () => {
  const { container } = render(<ConditionsSection slug={SUSPEND} />);

  const loading = [...container.querySelectorAll("p")]
    .map((node) => node.textContent ?? "")
    .filter((text) => text.startsWith("Reading "));

  // All three panels are suspended, so all three loading lines are on the
  // page. Asserted so this cannot pass by finding none of them.
  expect(loading.length).toBe(3);
  for (const line of loading) {
    expect(line.toLowerCase()).not.toContain("weather");
    expect(line.toLowerCase()).not.toContain("forecast");
    expect(line.toLowerCase()).not.toContain("surf report");
  }
});
