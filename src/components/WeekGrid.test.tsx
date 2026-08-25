import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { REGION_HEADING } from "./headingRank";
import { WeekGrid, type WeekDay, type WeekRow } from "./WeekGrid";

const DAYS: WeekDay[] = [
  { localDate: "2026-08-17", dayLabel: "Mon, Aug 17", isToday: true },
  { localDate: "2026-08-18", dayLabel: "Tue, Aug 18", isToday: false },
  { localDate: "2026-08-19", dayLabel: "Wed, Aug 19", isToday: false },
];

/** Deliberately ragged: the 19th is missing, which is a row this product cannot fill that far out. */
const TIDE_ROW: WeekRow = {
  emoji: "🌊",
  label: "Lowest tide",
  cells: {
    "2026-08-17": "6:41 PM",
    "2026-08-18": "7:10 AM",
  },
};

const RESERVED = [
  {
    emoji: "🏄",
    headline: "A wave forecast is coming.",
    detail: "CDIP's MOP model publishes an hourly forecast about ten days out.",
  },
];

function renderGrid(overrides: Partial<Parameters<typeof WeekGrid>[0]> = {}) {
  return render(
    <WeekGrid
      headingId="week-heading"
      title="The week ahead"
      days={DAYS}
      rows={[TIDE_ROW]}
      {...overrides}
    />,
  );
}

test("names every day it was given, in the order it was given them", () => {
  const { container } = renderGrid();

  const headings = [...container.querySelectorAll("h3")].map(
    (heading) => heading.textContent,
  );
  expect(headings).toEqual([
    "Today · Mon, Aug 17",
    "Tue, Aug 18",
    "Wed, Aug 19",
  ]);
});

test("a day's values follow that day, so the reading order is day then value", () => {
  const { container } = renderGrid();

  // The whole reason the DOM is day-major rather than product-major: a
  // non-visual reader hears "Tuesday, lowest tide, 7:10 AM" rather than every
  // day's tide followed by every day's waves.
  // `[\s\S]*` rather than `.*` with the dotAll flag, which this TypeScript
  // target does not compile.
  expect(container.textContent).toMatch(
    /Today · Mon, Aug 17[\s\S]*Lowest tide[\s\S]*6:41 PM[\s\S]*Tue, Aug 18[\s\S]*Lowest tide[\s\S]*7:10 AM/,
  );
});

test("a day this row cannot fill gets no pair at all, rather than an empty one", () => {
  renderGrid();

  // Absent, not blank. Three days, two of them with a tide, so the label is
  // printed exactly twice — a third "Lowest tide" over a gap would read as a
  // measurement that failed rather than a forecast that does not reach.
  expect(screen.getAllByText("Lowest tide")).toHaveLength(2);
});

test("today is named in words, not carried by a colour alone", () => {
  renderGrid();

  expect(screen.getByText(/Today · Mon, Aug 17/)).toBeDefined();
});

test("the glyph is decoration and never the only label a row has", () => {
  const { container } = renderGrid();

  const glyph = container.querySelector('[aria-hidden="true"]');
  expect(glyph?.textContent).toBe("🌊");
  // The text label is what a screen reader hears, per the brief's rule that
  // emoji mark categories and never carry them.
  expect(screen.getAllByText("Lowest tide").length).toBeGreaterThan(0);
});

test("label and value are a description list, so the pairing is structural", () => {
  const { container } = renderGrid();

  const pair = container.querySelector("dl > div");
  expect(pair?.querySelector("dt")?.textContent).toContain("Lowest tide");
  expect(pair?.querySelector("dd")?.textContent).toContain("6:41 PM");
});

test("each day is rendered once, full stop", () => {
  renderGrid();

  // ADR-0005 allows a breakpoint-divergent layout to render its content twice.
  // This one does not need that allowance and must not quietly start using it:
  // the DOM is identical at every width and only grid-template-columns moves.
  expect(screen.getAllByText("Tue, Aug 18")).toHaveLength(1);
});

test("the transpose is one property, so there is no hidden copy to keep in step", () => {
  const { container } = renderGrid();

  const grid = container.querySelector("ol");
  expect(grid?.className).toContain("lg:grid-cols-7");
  expect(container.innerHTML).not.toContain("lg:hidden");
});

test("a product that could not fill a row says so once, not seven times", () => {
  renderGrid({
    rows: [],
    notes: [
      "We could not get this week's tide predictions from NOAA just now.",
    ],
  });

  expect(
    screen.getAllByText(
      "We could not get this week's tide predictions from NOAA just now.",
    ),
  ).toHaveLength(1);
});

test("what is not built yet is named rather than left silent", () => {
  renderGrid({ reserved: RESERVED });

  expect(screen.getByText(/A wave forecast is coming/)).toBeDefined();
  expect(
    screen.getByText(/MOP model publishes an hourly forecast/),
  ).toBeDefined();
});

test("the week is a region a reader can navigate to by its heading", () => {
  const { container } = renderGrid();

  const section = container.querySelector("section");
  expect(section?.getAttribute("aria-labelledby")).toBe("week-heading");
  expect(screen.getByText("The week ahead").id).toBe("week-heading");
});

/** The slot's own box, reached through the copy the caller gave it. */
function reservedSlot() {
  return screen.getByText(/A wave forecast is coming/).closest("div");
}

test("the week's reserved slots take the row density, not the section one", () => {
  renderGrid({ reserved: RESERVED });

  // 244px of dashed box against 128px of live week was the finding.
  // `ReservedSlot` owns the numbers; what this asserts is that the grid asks
  // for the density sized to a row rather than reusing the section default.
  expect(reservedSlot()?.className).toContain("py-5");
  expect(reservedSlot()?.className).not.toContain("py-12");
});

test("the reserved band says it belongs to the week above it", () => {
  renderGrid({ reserved: RESERVED });

  // Without this the three dashed panels read as a separate thing sitting
  // below the table rather than as rows the week is waiting for. The band
  // stays where it is: a reserved product has no cells, so it cannot be a row
  // until it exists, and one inside the `<ol>` would print seven times.
  expect(
    screen.getByText(
      "Each of these will join the week above as a row of its own.",
    ),
  ).toBeDefined();
});

test("the reserved band steps at the same width the days do", () => {
  renderGrid({ reserved: RESERVED });

  // The day blocks are `lg:grid-cols-7`, so at `sm` the live week is stacked
  // full-width. Three slots side by side from 640px gave roughly 26 characters
  // over five ragged lines at 768 -- the page's own responsive logic
  // disagreeing with itself in adjacent bands of the same section.
  const band = reservedSlot()?.parentElement;
  expect(band?.className).toContain("lg:grid-cols-3");
  expect(band?.className).not.toContain("sm:grid-cols-3");
});

/**
 * ADR-0014, asserted where both ranks render inside one component. "The week
 * ahead" is a region and "Tue, Aug 18" is a day inside it, and the two were
 * `text-2xs font-extrabold tracking-widest text-ocean uppercase` apiece —
 * indistinguishable, on a page whose outline has four levels.
 */
test("the week's heading outranks the day headings inside it", () => {
  const { container } = renderGrid();

  const region = screen.getByRole("heading", { name: "The week ahead" });
  expect(region.className).toBe(REGION_HEADING);

  // The other half of the rank: the label register stays where it is. A day
  // heading moving with the region would restore the flat scale one level down.
  const day = container.querySelector("h3");
  expect(day?.className).toContain("text-2xs");
  expect(day?.className).not.toContain("text-quote");
});
