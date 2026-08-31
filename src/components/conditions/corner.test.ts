import { expect, test } from "vitest";
import { allBeaches } from "@/lib/beaches";
import { projectionFor } from "@/lib/coastline";
import {
  clearanceAt,
  cornerFor,
  READOUT_BOX,
  readoutStyle,
  type Box,
  type Corner,
  type PlotPoint,
} from "./corner";
import { shoreViewFor } from "./shore";

const FRAME: Box = { width: 100, height: 100 };

/**
 * The rectangle a corner's box occupies, worked out here rather than read off
 * the module under test.
 *
 * The inventory check below has to be able to fail when `clearanceAt` is wrong,
 * and asserting through `clearanceAt` -- which is what `cornerFor` decides with
 * -- could only ever agree with itself.
 */
function rectFor(corner: Corner, box: Box, frame: Box) {
  const top = corner === "top-left" || corner === "top-right";
  const left = corner === "top-left" || corner === "bottom-left";
  return {
    x0: left ? 0 : frame.width - box.width,
    x1: left ? box.width : frame.width,
    y0: top ? 0 : frame.height - box.height,
    y1: top ? box.height : frame.height,
  };
}

function covered(corner: Corner, box: Box, frame: Box, points: PlotPoint[]) {
  const rect = rectFor(corner, box, frame);
  return points.filter(
    (point) =>
      point.x > rect.x0 &&
      point.x < rect.x1 &&
      point.y > rect.y0 &&
      point.y < rect.y1,
  );
}

/** Everything one beach's map draws, in the map's own units. */
function drawnPoints(beach: Parameters<typeof shoreViewFor>[0]): PlotPoint[] {
  const view = shoreViewFor(beach);
  if (view.bounds === null) return [];
  const project = projectionFor(view.bounds, FRAME);
  return [...view.coast, ...(view.segment ?? [])].map((point) =>
    project(point.lat, point.lon),
  );
}

test("the readout's corner covers nothing the map draws, on every beach", () => {
  // The check the plan asked for, widened while it was being written. It walks
  // the whole inventory rather than asserting something about one beach that
  // happened to look right, and it measures against the windowed coastline as
  // well as this beach's own stretch -- the plan asked only for the stretch,
  // and measurement said the coastline was free.
  const offenders = allBeaches()
    .map((beach) => {
      const points = drawnPoints(beach);
      if (points.length === 0) return null;
      const corner = cornerFor(points, READOUT_BOX, FRAME);
      const hits = covered(corner, READOUT_BOX, FRAME, points);
      return hits.length === 0 ? null : `${beach.slug} (${corner})`;
    })
    .filter((offender): offender is string => offender !== null);

  expect(offenders).toEqual([]);
});

test("a fixed top-left corner could not have passed that check", () => {
  // The decision this module exists for, held by the gate rather than by the
  // addendum that argued it. `map-weather-readout.md` fixed the block at the
  // top-left; run before the block was built, the check above says the fixed
  // rule is false. Asserted as "at least one beach" rather than by naming
  // `childrens-pool` and its 8.3 units, so it stays true while the inventory
  // moves and fails only if the reason itself goes away.
  const blocked = allBeaches().filter((beach) => {
    const points = drawnPoints(beach);
    return (
      points.length > 0 &&
      covered("top-left", READOUT_BOX, FRAME, points).length > 0
    );
  });

  expect(blocked.length).toBeGreaterThan(0);
});

test("the top-left is kept wherever it is free", () => {
  // The price of an adaptive corner is that the block moves between beaches,
  // so it moves as little as the geometry allows: the reading order is the
  // preference order, and a clear top-left wins even when another corner is
  // roomier.
  const roomierElsewhere: PlotPoint[] = [
    // Nothing within the top-left box, and the whole right side empty.
    { x: 60, y: 60 },
  ];

  expect(cornerFor(roomierElsewhere, READOUT_BOX, FRAME)).toBe("top-left");
});

test("the block moves when its own corner is covered", () => {
  const acrossTheTopLeft: PlotPoint[] = [
    { x: 10, y: 10 },
    { x: 40, y: 5 },
  ];

  // The top band is not empty, so the top-left is gone; the same band leaves 60
  // units clear measured from the right, so the block takes the next corner in
  // reading order rather than dropping to the bottom of the picture.
  expect(cornerFor(acrossTheTopLeft, READOUT_BOX, FRAME)).toBe("top-right");
});

test("a chord corner to corner leaves the other diagonal", () => {
  // The shape that broke the fixed rule. Where no coast is traced, the beach's
  // own two ends are drawn as a chord between the frame's margin corners, so
  // one diagonal pair is always blocked and the other always free.
  const chord: PlotPoint[] = [
    { x: 8, y: 8 },
    { x: 50, y: 50 },
    { x: 92, y: 92 },
  ];

  expect(cornerFor(chord, READOUT_BOX, FRAME)).toBe("top-right");
});

test("no corner fits, and the roomiest one is taken rather than none", () => {
  // Unreachable through the committed inventory, which is what the first test
  // proves. It is covered here rather than left to a beach nobody has yet
  // added: a readout that vanished would be a silent failure, and a throw
  // would take the whole page with it.
  const everywhere: PlotPoint[] = [
    { x: 5, y: 5 },
    { x: 20, y: 5 },
    { x: 95, y: 5 },
    { x: 5, y: 95 },
    { x: 95, y: 95 },
  ];

  // The top-right band is blocked at 5 units in from the right, the top-left at
  // 5 from the left, and both bottom corners at 5 -- so nothing fits and the
  // widest of them is the answer.
  expect(cornerFor(everywhere, READOUT_BOX, FRAME)).toBe("top-left");
});

test("an empty band leaves the whole side clear", () => {
  expect(clearanceAt("top-left", [{ x: 1, y: 99 }], READOUT_BOX, FRAME)).toBe(
    FRAME.width,
  );
});

test("clearance is measured from the corner's own side", () => {
  const point: PlotPoint[] = [{ x: 30, y: 5 }];

  expect(clearanceAt("top-left", point, READOUT_BOX, FRAME)).toBe(30);
  expect(clearanceAt("top-right", point, READOUT_BOX, FRAME)).toBe(70);
});

test("the overlay is placed in percentages of the map's own box", () => {
  // The width the CSS reserves and the width `cornerFor` kept clear are one
  // number rather than two that have to be kept in step. That only works
  // because the frame is square and the map is drawn `w-full` at `h-auto`, so
  // one drawing unit is one percent on both axes.
  expect(readoutStyle("top-left", READOUT_BOX, FRAME)).toEqual({
    width: `${READOUT_BOX.width}%`,
    maxHeight: `${READOUT_BOX.height}%`,
    top: "0",
    left: "0",
  });

  expect(readoutStyle("bottom-right", READOUT_BOX, FRAME)).toEqual({
    width: `${READOUT_BOX.width}%`,
    maxHeight: `${READOUT_BOX.height}%`,
    bottom: "0",
    right: "0",
  });
});

test("the footprint stays inside what the inventory can hold", () => {
  // 50.5 units is the widest readout any placement rule survives on its worst
  // beach, measured across all 51. This is the ceiling written down where a
  // later slice adding a field to a row will run into it -- the rows have
  // vertical room to spend and none to spare across.
  expect(READOUT_BOX.width).toBeLessThanOrEqual(50);
});
