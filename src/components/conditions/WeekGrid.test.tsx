import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { REGION_HEADING } from "./headingRank";
import { WeekGrid, type WeekDay, type WeekRow } from "./WeekGrid";

const DAYS: WeekDay[] = [
  {
    localDate: "2026-08-17",
    dayLabel: "Mon, Aug 17",
    dateLabel: "Aug 17",
    isToday: true,
  },
  {
    localDate: "2026-08-18",
    dayLabel: "Tue, Aug 18",
    dateLabel: "Aug 18",
    isToday: false,
  },
  {
    localDate: "2026-08-19",
    dayLabel: "Wed, Aug 19",
    dateLabel: "Aug 19",
    isToday: false,
  },
];

/** Deliberately ragged: the 19th is missing, which is a row this product cannot fill that far out. */
const TIDE_ROW: WeekRow = {
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
  // Today's column reads its date without a weekday, because the chip beside
  // it already says which day this is -- and dropping that token is what lets
  // the chip sit on the date's line instead of reserving a line above it in all
  // seven columns. The space before "Today" is a real text node: two elements
  // with nothing between them read aloud as "Aug 17Today", the concatenation
  // `ReadingCard` records hitting in the accessible-name algorithm.
  expect(headings).toEqual(["Aug 17 Today", "Tue, Aug 18", "Wed, Aug 19"]);
});

test("a day's values follow that day, so the reading order is day then value", () => {
  const { container } = renderGrid();

  // The whole reason the DOM is day-major rather than product-major: a
  // non-visual reader hears "Tuesday, lowest tide, 7:10 AM" rather than every
  // day's tide followed by every day's waves.
  // `[\s\S]*` rather than `.*` with the dotAll flag, which this TypeScript
  // target does not compile.
  expect(container.textContent).toMatch(
    /Aug 17 Today[\s\S]*Lowest tide[\s\S]*6:41 PM[\s\S]*Tue, Aug 18[\s\S]*Lowest tide[\s\S]*7:10 AM/,
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
  const { container } = renderGrid();

  // Three things mark today -- an ocean edge, an ocean header band, a yellow
  // chip -- and the word is what survives if a reader sees none of them.
  const heading = container.querySelector("ol > li h3")!;
  expect(heading.textContent).toBe("Aug 17 Today");
  expect(screen.getByText("Today").className).toContain("bg-yellow");
});

/**
 * ADR-0015. The rows carried 🐚 and 🌅 at the 10px these labels are set in,
 * where a full-colour emoji is not a mark -- the shell rendered as a grey
 * smudge on the pale cell, fourteen times over. A glyph marks a panel on this
 * page now; a row inside one is named in words, which is what a screen reader
 * was hearing all along.
 */
test("a row is named in words, with no glyph beside it", () => {
  const { container } = renderGrid({ reserved: RESERVED });

  expect(screen.getAllByText("Lowest tide").length).toBeGreaterThan(0);

  // The reserved band below still carries one, so this cannot pass by the grid
  // having rendered nothing at all.
  const glyphs = [...container.querySelectorAll('[aria-hidden="true"]')].map(
    (node) => node.textContent,
  );
  expect(glyphs).toEqual(["🏄"]);
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
  expect(grid?.className).toContain("md:grid-cols-2");
  expect(grid?.className).toContain("lg:grid-cols-4");
  expect(grid?.className).toContain("xl:grid-cols-7");
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

  // `lg` is where the days above first go wider than two. Three slots side by
  // side from 640px gave roughly 26 characters over five ragged lines at 768,
  // while the live week was still stacked full-width -- the page's own
  // responsive logic disagreeing with itself in adjacent bands of one section.
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

/**
 * The property the cell's own comment claims and nothing asserted: today is
 * marked by the colour of its edge, not by a thicker one. A `border-2` on the
 * marked day alone would make it two pixels narrower inside than the six beside
 * it, which is the kind of misalignment nobody finds by reading the diff.
 */
test("today is marked by the colour of its edge, never by a wider one", () => {
  const { container } = renderGrid();

  const cells = [...container.querySelectorAll("ol > li")];
  expect(cells.length).toBe(3);

  const widths = new Set(
    cells.map((c) => (c.className.match(/border-\[[^\]]+\]/) ?? [""])[0]),
  );
  expect(widths.size).toBe(1);

  expect(cells[0].className).toContain("border-ocean");
  expect(cells[1].className).toContain("border-lavender");
  expect(cells[2].className).toContain("border-lavender");
});

/**
 * `rounded-tile`, not the 24px `rounded-card` a 520px hero card takes. On a
 * 159x148 cell that radius is 15% of the width and the corner stops reading as
 * a corner — see this component's own comment, and finding 1 of the 2026-08-25
 * review.
 */
test("a day cell takes the radius of a box its own size", () => {
  const { container } = renderGrid();

  const cell = container.querySelector("ol > li");
  expect(cell?.className).toContain("rounded-tile");
  expect(cell?.className).not.toContain("rounded-card");
});

/**
 * Regression. `TODAY · THU, AUG 27` is 151px against 125px of cell at 1280, so
 * the marked day wraps where the other six do not and every row beneath it
 * sits a line lower than the same row beside it. The reserve buys that back.
 *
 * Scoped to `xl` because that is where seven columns start. Below it there are
 * at most four, the header fits on one line, and an unscoped reserve was 35px
 * a day across seven days — 242px of extra scroll on a phone, on a grid an
 * earlier review had already called too tall there.
 */
/**
 * Regression. The chip had a reserved line above it, because
 * `TODAY · THU, AUG 28` is 151px against 133px of band at 1280 and wrapped on
 * the marked day alone. Reserving fixed the alignment and cost 22px of empty
 * band at the top of the other six columns, which is what a reader saw.
 *
 * `dateLabel` is what replaced it: `AUG 28` is 51px and the chip 54px, so the
 * pair comes to 111px and fits. Nothing is reserved anywhere now, and the six
 * days without a chip must not carry a slot for one.
 */
test("no column reserves a line for a chip it does not have", () => {
  const { container } = renderGrid();

  const headings = [...container.querySelectorAll("ol > li h3")];
  for (const heading of headings) {
    expect(heading.className).not.toContain("min-h");
    for (const span of heading.querySelectorAll("span")) {
      expect(span.className).not.toContain("min-h");
    }
  }

  // Only today has a child element in its heading at all: the chip.
  expect(headings[0].querySelectorAll("span")).toHaveLength(1);
  expect(headings[1].querySelectorAll("span")).toHaveLength(0);
});

test("the chip follows the date rather than sitting above it", () => {
  const { container } = renderGrid();

  const heading = container.querySelector("ol > li h3")!;
  const chip = screen.getByText("Today");
  expect(
    chip.compareDocumentPosition(heading.firstChild!) &
      Node.DOCUMENT_POSITION_PRECEDING,
  ).toBeTruthy();
});

/**
 * The measurement the breakpoint step exists for. Seven columns at 1024 give a
 * cell 120px wide and 88px of content — narrower than `THU, AUG 27` renders at
 * 89px — which is what forced every hard-coded line break the four cell
 * components used to carry. jsdom applies no stylesheets (ADR-0001), so what
 * is assertable here is that seven columns wait for `xl` and that the widths
 * between are filled rather than jumping straight from one.
 */
test("seven columns wait for the width that can hold them", () => {
  const { container } = renderGrid();

  const grid = container.querySelector("ol")!;
  expect(grid.className).not.toContain("lg:grid-cols-7");
  expect(grid.className).not.toContain("sm:grid-cols");
});

/* =========================================================================
 * Provenance: once beneath the grid, never inside a day
 * ========================================================================= */

/** A row whose source appears nowhere else on the page, so it names itself. */
const WAVE_ROW: WeekRow = {
  label: "Biggest swell",
  cells: {
    "2026-08-17": "2.6 ft 13 s",
    "2026-08-18": "3.4 ft 17 s",
  },
  provenance: {
    source: "MOP line D0498",
    network: "CDIP, Scripps Institution of Oceanography",
    distanceKm: "0.3",
    note: "a model of the swell at 10 m depth, not a measurement",
  },
};

test("a row's source is printed once, not once per day", () => {
  // A feed's identity is one fact about a feed, not seven facts about seven
  // days -- the same argument the notes prop above is built on.
  renderGrid({ rows: [TIDE_ROW, WAVE_ROW] });

  expect(screen.getAllByText(/MOP line D0498/)).toHaveLength(1);
});

test("the source sits under the days, not inside them", () => {
  const { container } = renderGrid({ rows: [TIDE_ROW, WAVE_ROW] });

  const line = screen.getByText(/MOP line D0498/);
  expect(container.querySelector("ol")!.contains(line)).toBe(false);
  // And after them in reading order, so it qualifies figures already read.
  expect(
    container.querySelector("ol")!.compareDocumentPosition(line) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("the source is labelled with its row, since a grid may carry several", () => {
  renderGrid({ rows: [TIDE_ROW, WAVE_ROW] });

  const line = screen.getByText(/MOP line D0498/);
  expect(line.textContent).toContain("Biggest swell");
  expect(line.textContent).toContain("about 0.3 km from this beach");
  expect(line.textContent).toContain("not a measurement");
});

test("a row with no source prints no line at all", () => {
  // Most rows do not need one: the tide's station is named on the card that
  // shares its request, and daylight is computed here from coordinates.
  const { container } = renderGrid({ rows: [TIDE_ROW] });

  expect(container.querySelectorAll("p").length).toBe(0);
});

/* =========================================================================
 * The daylight window: the day's header, not a row inside it
 * ========================================================================= */

/** The same three days, each carrying the window its figures are selected in. */
const DAYS_WITH_DAYLIGHT: WeekDay[] = DAYS.map((day, i) => ({
  ...day,
  daylight: <p>{`6:2${i} AM to 7:2${i} PM`}</p>,
}));

test("the daylight window sits in the header, above every pair in the day", () => {
  // Not a `WeekRow`: a row states a figure, and this states the scope the
  // figures are selected within. That is what lets the labels below be "Low
  // tide" rather than "Lowest daylight tide" -- see the plan.
  const { container } = renderGrid({ days: DAYS_WITH_DAYLIGHT });

  const window = screen.getByText("6:20 AM to 7:20 PM");
  const day = container.querySelector("ol > li")!;
  expect(day.contains(window)).toBe(true);
  expect(day.querySelector("dl")!.contains(window)).toBe(false);

  const heading = day.querySelector("h3")!;
  expect(
    heading.compareDocumentPosition(window) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("every day carries its own window, since sunset moves across the week", () => {
  renderGrid({ days: DAYS_WITH_DAYLIGHT });

  expect(screen.getByText("6:20 AM to 7:20 PM")).toBeDefined();
  expect(screen.getByText("6:21 AM to 7:21 PM")).toBeDefined();
  expect(screen.getByText("6:22 AM to 7:22 PM")).toBeDefined();
});

test("a day given no window renders a header of just its date", () => {
  // The grid must not draw a gap where a line would be: `WeekPanel` computes
  // daylight and cannot fail, but the grid is not the thing that knows that.
  const { container } = renderGrid();

  const header = container.querySelector("ol > li > div")!;
  expect(header.textContent).toBe("Aug 17 Today");
});

/* =========================================================================
 * The band, the rules and the colour key
 * ========================================================================= */

/**
 * The header is a filled band rather than more text on the same white field,
 * which is what says "this is the day" without a word. Four labelled pairs run
 * together on one surface was the shape the 2026-08-27 review called
 * undifferentiated.
 *
 * jsdom applies no stylesheets (ADR-0001), so what is assertable is which
 * classes compose. That ocean at 8.5:1 and mist at 5.0:1 read as intended is a
 * human check at the review viewport -- the compromise ADR-0004 and ADR-0014
 * already record.
 */
test("the day header is a band, and today's is the saturated one", () => {
  const { container } = renderGrid();

  const bands = [...container.querySelectorAll("ol > li > div:first-child")];
  expect(bands).toHaveLength(3);

  expect(bands[0].className).toContain("bg-ocean");
  expect(bands[0].className).toContain("text-white/85");
  expect(bands[1].className).toContain("bg-mist");
  expect(bands[1].className).toContain("text-fog");

  // Every band carries the same border width, so the marked day is not
  // narrower inside than its neighbours -- the property the cell's own edge
  // has always held and the band now has to hold too.
  for (const band of bands) {
    expect(band.className).toContain("border-b-[1.5px]");
  }
});

test("the band is clipped by the tile's corner rather than squaring it off", () => {
  const { container } = renderGrid();

  const cell = container.querySelector("ol > li")!;
  expect(cell.className).toContain("rounded-tile");
  expect(cell.className).toContain("overflow-hidden");
});

test("a hairline separates the readings, and none sits above the first", () => {
  const { container } = renderGrid({ rows: [TIDE_ROW, WAVE_ROW] });

  const pairs = [...container.querySelectorAll("ol > li:first-child dl > div")];
  expect(pairs).toHaveLength(2);
  for (const pair of pairs) {
    expect(pair.className).toContain("border-t");
    expect(pair.className).toContain("border-lavender");
  }
  // `first:border-t-0` rather than a rule on all but the first, because rows
  // are ragged: which reading comes first differs by day.
  expect(pairs[0].className).toContain("first:border-t-0");
});

/**
 * Colour per product and constant across all seven days, which is what keeps
 * it clear of ADR-0009. A row that brings no tone keeps fog, the colour every
 * label in this grid had before there was a key -- so a caller that has not
 * thought about it cannot accidentally assert anything.
 */
test("a row's label takes the row's own colour, in every day", () => {
  const { container } = renderGrid({
    rows: [
      { ...TIDE_ROW, tone: "text-ocean" },
      { ...WAVE_ROW, tone: "text-purple" },
    ],
  });

  const tide = [...container.querySelectorAll("dt")].filter(
    (dt) => dt.textContent === "Lowest tide",
  );
  expect(tide).toHaveLength(2);
  for (const dt of tide) {
    expect(dt.className).toContain("text-ocean");
  }

  expect(
    [...container.querySelectorAll("dt")]
      .filter((dt) => dt.textContent === "Biggest swell")
      .every((dt) => dt.className.includes("text-purple")),
  ).toBe(true);
});

test("a row with no colour of its own stays fog", () => {
  const { container } = renderGrid();

  const label = container.querySelector("dt")!;
  expect(label.className).toContain("text-fog");
});

/**
 * A 10px label alone on a 303px line is most of the line wasted, and below
 * `lg` a day is a full-width block. `LOW TIDE` is 70px, so a 76px column holds
 * every label the grid has and leaves 217px at 375 — enough for the longest
 * value in the cell. Measured: a day goes 214px to 169px at 375.
 *
 * Not the `lg:block` the four cell components lost. Those forced a break
 * inside one value to keep seven narrow columns in step; this chooses where a
 * label sits relative to its value.
 */
test("the label sits beside its value until there are columns to stack in", () => {
  const { container } = renderGrid();

  const pair = container.querySelector("ol > li dl > div")!;
  expect(pair.className).toContain("flex");
  expect(pair.className).toContain("lg:block");

  const label = pair.querySelector("dt")!;
  expect(label.className).toContain("w-29");
  expect(label.className).toContain("shrink-0");
  expect(label.className).toContain("lg:w-auto");
});
