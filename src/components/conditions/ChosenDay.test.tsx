import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { localMidnightOf } from "@/lib/pacific-time";
import { ChosenDay, type DayView } from "./ChosenDay";

/**
 * This file is about the region's layout. Which day the region shows, and how
 * the strip and the grid agree on it, is `selectedDay.test.tsx`'s subject and
 * is not repeated here; one day with one quiet series is enough to lay the
 * three parts out.
 */
const HOUR = 3_600_000;
const DATE = "2026-08-17";

const VIEW: DayView = {
  localDate: DATE,
  dayName: "Today",
  chartWhen: "today",
  startMs: localMidnightOf(DATE),
  endMs: localMidnightOf(DATE) + 24 * HOUR,
  sunriseMs: localMidnightOf(DATE) + 6 * HOUR,
  sunsetMs: localMidnightOf(DATE) + 19 * HOUR,
  nowMs: null,
  cloud: [],
  series: [
    {
      key: "tide",
      label: "Tide",
      unitLabel: "ft",
      decimals: 1,
      points: [],
      description: "Tide today",
      absence: "No tide series.",
      provenance: null,
    },
  ],
  wording: <p>the sky in words</p>,
  surfZone: <p>the rip block</p>,
};

/**
 * From `xl` the region is a three-column grid: chart across two, the map in
 * the third spanning both rows, the rip block under the chart. Measured on
 * 2026-09-17 with the old two-column flex: the chart column ended about 300px
 * above the map column on every page, and the rip block sat below both,
 * leaving that much blank beside the map. DOM order is unchanged -- chart,
 * map, rip block -- so below `xl` the stack is what it was, and the reason
 * the rip block sits under the chart rather than above it (it is several
 * lines on some days and one on others, and the plot must not move as a
 * reader steps across the week) still holds.
 *
 * jsdom applies no stylesheets (ADR-0001): this asserts the placement is
 * asked for, and the PR carries the screenshot that shows it painted.
 */
test("from xl the map spans both rows and the rip block sits under the chart", () => {
  render(<ChosenDay days={[VIEW]} map={<p>the map</p>} />);

  const map = screen.getByText("the map").parentElement!;
  const rip = screen.getByText("the rip block").parentElement!;
  const grid = map.parentElement!;
  const chart = grid.firstElementChild!;

  expect(grid.className).toContain("xl:grid");
  expect(grid.className).toContain("xl:grid-cols-3");
  expect(chart.className).toContain("xl:col-span-2");
  expect(map.className).toContain("xl:col-start-3");
  expect(map.className).toContain("xl:row-span-2");
  expect(rip.parentElement).toBe(grid);
  expect(rip.className).toContain("xl:col-span-2");

  // Order in the markup is order in reading: chart, then map, then rip block.
  expect([...grid.children]).toEqual([chart, map, rip]);
});
