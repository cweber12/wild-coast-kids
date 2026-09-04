import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { projectionFor } from "@/lib/coastline";
import { beachesByArea } from "@/lib/areas";
import { shoreViewForArea } from "./shore";
import { BeachPins, inlineFits, type PinnedBeach } from "./BeachPins";

/** A beach at a given row of the plot, which is all either placement reads. */
function at(y: number, name = `Beach at ${y}`): PinnedBeach {
  return { name, href: `/conditions/here/${y}`, at: { x: 60, y } };
}

/* =========================================================================
 * Which placement an area gets
 * ========================================================================= */

test("labels sit beside their beaches when every pair clears a label row", () => {
  expect(inlineFits([at(10), at(30), at(60)])).toBe(true);
});

test("one pair sharing a row sends the whole area to the column", () => {
  // Two of the three are 0.4 units apart -- far below the ~4 a label needs --
  // and it is the picture that changes placement, not those two beaches. A
  // frame drawn half one way and half the other is two conventions at once.
  expect(inlineFits([at(10), at(30), at(30.4)])).toBe(false);
});

test("a lone beach and an empty area both fit trivially", () => {
  expect(inlineFits([at(50)])).toBe(true);
  expect(inlineFits([])).toBe(true);
});

/**
 * The threshold is a label's own height on the narrowest map, so the boundary
 * is worth pinning either side of: at 3.9 units two labels would touch on a
 * phone, and at 4.1 they clear.
 */
test("the boundary sits at one label row, not at some rounder number", () => {
  expect(inlineFits([at(10), at(13.9)])).toBe(false);
  expect(inlineFits([at(10), at(14.1)])).toBe(true);
});

/* =========================================================================
 * The committed areas, which are what the threshold was chosen against
 * ========================================================================= */

/** Every area's marks, projected into its own frame exactly as `ShoreMap` does. */
function placedAreas() {
  return beachesByArea()
    .map(({ area }) => {
      const view = shoreViewForArea(area);
      if (view.bounds === null || view.marks.length < 2) return null;
      const project = projectionFor(view.bounds, { width: 100, height: 100 });
      const marks: PinnedBeach[] = view.marks.map((mark) => ({
        name: mark.name,
        href: `/conditions/${area.slug}/${mark.slug}`,
        at: project(mark.at.lat, mark.at.lon),
      }));
      const rows = marks.map((mark) => mark.at.y).sort((a, b) => a - b);
      const gaps = rows.slice(1).map((row, index) => row - rows[index]);
      return { slug: area.slug, marks, tightest: Math.min(...gaps) };
    })
    .filter((area) => area !== null);
}

/**
 * Which real areas need the column, asserted as an outcome rather than
 * recomputed from the rule the code already applies.
 *
 * **Three, and they are the bays and La Jolla.** Mission Bay – North and – West
 * are the surprise: their closest marks are 31px and 41px apart on screen and
 * would pass any distance test. That separation is almost all horizontal —
 * they are beaches on opposite shores of the same water at the same latitude —
 * so their labels want the same row and collide however far apart the pins are.
 */
test("three of the twelve areas carry their names out to a column", () => {
  const needColumn = placedAreas()
    .filter((area) => !inlineFits(area.marks))
    .map((area) => area.slug)
    .sort();

  expect(needColumn).toEqual([
    "la-jolla",
    "mission-bay-north",
    "mission-bay-west",
  ]);
});

/**
 * And the partition is not balanced on the threshold, which is what makes the
 * number defensible rather than tuned.
 *
 * The probe is that both classes are populated and the band between them is
 * wide: nothing in the inventory sits near the boundary, so a beach shifting a
 * few metres cannot flip a picture from one convention to the other.
 */
test("no area sits near the threshold, either side of it", () => {
  const areas = placedAreas();
  const crowded = areas.filter((area) => !inlineFits(area.marks));
  const roomy = areas.filter((area) => inlineFits(area.marks));

  expect(crowded.length).toBeGreaterThan(0);
  expect(roomy.length).toBeGreaterThan(0);

  // The worst crowded area is far below a label row; the tightest roomy one is
  // comfortably above it. Measured today: 0.47 and 6.38.
  expect(Math.max(...crowded.map((area) => area.tightest))).toBeLessThan(2);
  expect(Math.min(...roomy.map((area) => area.tightest))).toBeGreaterThan(6);
});

/* =========================================================================
 * What each placement draws
 * ========================================================================= */

test("a beach map hands no marks and gets no layer at all", () => {
  const { container } = render(<BeachPins marks={[]} />);
  expect(container.innerHTML).toBe("");
});

test("beside the beach, a pin is one link carrying the glyph and the name", () => {
  const marks = [at(10, "North Beach"), at(40, "South Beach")];
  const { container } = render(<BeachPins marks={marks} />);

  for (const mark of marks) {
    expect(
      screen.getByRole("link", { name: mark.name }).getAttribute("href"),
    ).toBe(mark.href);
  }
  // Nothing is carried anywhere, so there is nothing to lead the eye to.
  expect(container.querySelectorAll("[data-leader]")).toHaveLength(0);
  expect(container.querySelectorAll("[data-dot]")).toHaveLength(0);
});

test("in a column, every beach keeps a named link and gains a leader", () => {
  const marks = [at(30, "Shell Beach"), at(30.5, "Cove"), at(31, "Pool")];
  const { container } = render(<BeachPins marks={marks} />);

  for (const mark of marks) {
    expect(
      screen.getByRole("link", { name: mark.name }).getAttribute("href"),
    ).toBe(mark.href);
  }
  expect(container.querySelectorAll("[data-leader]")).toHaveLength(3);
  expect(container.querySelectorAll("[data-dot]")).toHaveLength(3);
});

/**
 * The dot on the coast is not a control, and that is deliberate.
 *
 * An area reaches the column only because its marks are within a few pixels of
 * one another — La Jolla's tightest pair is about 4.5px apart at the review
 * viewport. Overlapping targets there would not merely be small: a click would
 * land on whichever beach happened to be painted last, silently. A mark that
 * does nothing is better than a control that goes somewhere the reader did not
 * choose, so the labelled anchor at the end of the leader is the only way in.
 */
test("the dot on the coast is inert, so no click lands on the wrong beach", () => {
  const marks = [at(30, "Shell Beach"), at(30.5, "Cove")];
  const { container } = render(<BeachPins marks={marks} />);

  const dots = [...container.querySelectorAll("[data-dot]")];
  expect(dots).toHaveLength(2);
  for (const dot of dots) expect(dot.closest("a")).toBeNull();

  // One link per beach and no more, so the column is not a second copy of a
  // target that also exists on the coast.
  expect(screen.getAllByRole("link")).toHaveLength(2);
});

/**
 * A beach well clear of the cluster does not push the stack off the top.
 *
 * This is La Jolla's own shape and it was a real defect, found by rendering
 * rather than by arithmetic: `la-jolla-shores-beach` sits about 20 units north
 * of the other nine, so the rows spanned more of the frame than they had, and
 * the correction that pulled the last row back inside carried the first one
 * clean off the top edge. The lift is capped by the top now, and where that is
 * not enough the rows are spaced evenly instead.
 */
test("an outlier above a cluster does not push the first name off the top", () => {
  const marks = [
    at(24, "La Jolla Shores"),
    ...Array.from({ length: 9 }, (_, index) =>
      at(43 + index * 0.4, `Cluster ${index}`),
    ),
  ];
  const { container } = render(<BeachPins marks={marks} />);

  const pins = [...container.querySelectorAll("[data-pin]")];
  const tops = pins.map((pin) =>
    Number((pin as HTMLElement).style.top.replace("%", "")),
  );

  expect(tops).toHaveLength(10);
  // Half an anchor of headroom at each end, so nothing is cut off by the frame.
  expect(Math.min(...tops)).toBeGreaterThanOrEqual(4.7);
  expect(Math.max(...tops)).toBeLessThanOrEqual(95.3);
  // Still in order, so the column still reads north to south.
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
});

/**
 * The stack stays inside the frame however many names it has to hold.
 *
 * Ten rows at the column's pitch span 85.5 units of 100, so La Jolla fits
 * without compressing; a stack pushed past the bottom is lifted whole rather
 * than squeezed, which is what keeps the order of the names readable against
 * the order of the beaches.
 */
test("a full column is lifted rather than squeezed off the bottom", () => {
  const marks = Array.from({ length: 10 }, (_, index) =>
    at(80 + index * 0.3, `Beach ${index}`),
  );
  const { container } = render(<BeachPins marks={marks} />);

  const tops = [...container.querySelectorAll("[data-pin]")].map((pin) =>
    Number((pin as HTMLElement).style.top.replace("%", "")),
  );

  expect(tops).toHaveLength(10);
  expect(Math.min(...tops)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...tops)).toBeLessThanOrEqual(100);
  // Evenly pitched, which is the property lifting preserves and squeezing does
  // not: consecutive rows are the same distance apart all the way down.
  const pitches = tops.slice(1).map((top, index) => top - tops[index]);
  for (const pitch of pitches) expect(pitch).toBeCloseTo(pitches[0], 5);
});
