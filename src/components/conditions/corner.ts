/**
 * Which corner of the shore map the weather readout stands in.
 *
 * **The corner is chosen per beach, and that reverses what the plan wrote
 * down.** `map-weather-readout.md` fixed the block at the top-left on all 51
 * beaches, on the grounds that a control which moves between Del Mar and
 * Coronado is a control a reader has to find again, and put a test on it: walk
 * every beach through `shoreViewFor`, project, and fail if the readout's box
 * covers what the map draws. Run before the block was built rather than after,
 * that test says the fixed corner has nowhere to stand.
 *
 * Measured across the inventory, as the widest readout each rule survives on its
 * worst beach. **Re-measured after ADR-0036 moved every frame** — the first
 * three figures were taken against the old projection and two of them had gone
 * stale, which is what `MEASURED.md` would say if this repo kept one:
 *
 * | placement               | widest readout | worst beach                    |
 * | ----------------------- | -------------- | ------------------------------ |
 * | fixed top-left          | 1.0 unit       | `tijuana-slough…`              |
 * | top, side flips         | 43.3 at h=14   | `coronado-central-beach`       |
 * | any of the four corners | 50.5 units     | `mission-bay-visitor-s-center` |
 *
 * **The one that decides anything did not move**, and that is not luck: the
 * worst beach for the adaptive rule binds no coast, so ADR-0036's reframing
 * never touched it. 50.5 units still holds at every height from 14 to 50, which
 * is the "height is free and width is not" the readout's rows are budgeted
 * against. `corner.test.ts` now pins it rather than leaving it here to rot.
 *
 * The two that did move describe rejected alternatives, and both moved *away*
 * from viability: a fixed top-left now survives one unit rather than 8.3.
 * **The cause is structural rather than unlucky**: on the beaches with no
 * traced coast, `beachStretch` draws the beach's own two ends, so the segment
 * is a chord between the frame's margin corners and always blocks one diagonal
 * pair. The flip rule's figure now falls with height — 43.3 at 14, 16.0 at 35,
 * 8.3 at 40 — where the adaptive rule's does not, which is the clearest
 * statement of why the fourth corner is worth having.
 *
 * **The half of the plan's rejection that was wrong is the reason this file
 * exists.** It said an adaptive corner "becomes untestable in the useful
 * direction — you can assert it moved, not that it landed somewhere good". The
 * property is exactly as assertable either way, and it is the fixed rule that
 * cannot be verified, because it is false. `corner.test.ts` walks all 51.
 *
 * **Pure, and the seam.** It takes projected points and a box and answers with
 * a corner. It reads no file, resolves no beach and renders nothing, so the
 * inventory-wide check calls it directly rather than through a rendered map.
 */

/** Where the readout stands, named as a reader would describe it. */
export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** A footprint in the map's own drawing units. */
export interface Box {
  readonly width: number;
  readonly height: number;
}

/** A point in the map's own drawing units, as `projectionFor` returns them. */
export interface PlotPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The readout's footprint, in the map's drawing units.
 *
 * **50 is the ceiling the inventory sets, not a size that was liked.** The
 * worst beach leaves 50.5 units clear in its roomiest corner, so a wider block
 * would be one no placement rule can keep off the picture. The map's frame is
 * 100 units square and is drawn `w-full` at `h-auto`, so a unit is one percent
 * of the rendered box on both axes — which is what lets the overlay be sized in
 * CSS percentages and still be the same box this file reasons about.
 *
 * **The height is free and the width is not**, which is the measurement that
 * decides what the rows may say. The widest readout any corner allows is 50.5
 * units at a band 14 units deep, and *still* 50.5 at 20, 30, 35, 40 and 50.
 * What blocks a corner is a stroke crossing it diagonally, and a deeper band
 * meets the same stroke at nearly the same place.
 *
 * Re-measured after ADR-0036 reframed every map, and unchanged: the beach that
 * sets this ceiling binds no coast, so it was not one of the frames that moved.
 * `corner.test.ts` asserts the figure, so the next reframing says so here
 * rather than leaving a stale number to be believed.
 *
 * So the rows have vertical room to spend and none at all to spare across, and
 * that is why a row wraps rather than running on: at 10px, `SWELL south-west
 * 270° 3.4 ft · 14 s` is 210.1px against the 151.5px a 327px map leaves inside
 * this box, and the 124px a 320px viewport leaves -- a width ADR-0004 commits
 * this site to. At 124px that row is three lines, so two of them plus the
 * padding is 88px, which is 32.4 units of the 272px map a 320px viewport draws.
 *
 * **40 rather than 35, and the caption is what spent the difference.** The
 * block names the hour it is showing (ADR-0035), which is one more 10px line
 * and one more 4px gap above the rows. Measured on the built page at 320px,
 * with both rows forced to the longest thing they can say: 102px against the
 * 88px the two rows and their padding came to, which is 37.5 units of that same
 * 272px map. 35 units is 95.2px and would not hold it -- the ink would reach
 * past the footprint `cornerFor` was asked to keep clear, which is the one
 * failure nothing here draws an outline around.
 *
 * The cost is measured rather than assumed, because the height a box declares
 * decides how deep a band `cornerFor` searches: a taller box is a more cautious
 * one and moves the readout off the top-left more often than the ink requires.
 * Across the inventory, 35 chooses the same corner as 30 on all 50 beaches that
 * draw one, and 40 moves three of them -- `south-casa-beach-s-d` to the
 * bottom-right, `mission-bay-de-anza-cove` and `mission-bay-sea-world` to the
 * top-right. **One of those three is not the beach ADR-0035 named**, because
 * that list was measured before ADR-0036 reframed every map: it said
 * `pacific-beach`, which now stands in the bottom-left at 30, 35 and 40 alike
 * and so moves at no height at all, and `south-casa-beach-s-d` moves in its
 * place. The count is the same and so is the shape of the answer, which is the
 * half of a measurement that survives a reframing.
 */
export const READOUT_BOX: Box = { width: 50, height: 40 };

/**
 * The order corners are tried in, and it is the reader's rather than the
 * geometry's.
 *
 * Top-left first because that is where the plan wanted the block and where a
 * reader's eye starts, and it is clear on over half the inventory. The block
 * moves only when the beach underneath leaves it nowhere else to go, which is
 * the smallest amount of moving that answers the measurement.
 */
export const CORNER_ORDER: readonly Corner[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

/**
 * How wide a box of this height can be in this corner before it covers a point.
 *
 * The band is the strip of the frame the box's height reaches into; a point
 * outside that strip cannot be covered however wide the box is. Inside it, the
 * widest safe box stops at the nearest point, measured from the corner's own
 * side. `frame.width` when the strip is empty, which is the whole side.
 */
export function clearanceAt(
  corner: Corner,
  points: readonly PlotPoint[],
  box: Box,
  frame: Box,
): number {
  const top = corner === "top-left" || corner === "top-right";
  const left = corner === "top-left" || corner === "bottom-left";

  const inBand = points.filter((point) =>
    top ? point.y < box.height : point.y > frame.height - box.height,
  );
  if (inBand.length === 0) return frame.width;

  return Math.min(
    ...inBand.map((point) => (left ? point.x : frame.width - point.x)),
  );
}

/**
 * The corner this beach's readout stands in.
 *
 * **The first corner that fits, and the roomiest one when none does.** Falling
 * back rather than throwing is not a swallowed failure: the caller has a block
 * to draw either way, and a beach with no clear corner is a fact about the
 * inventory that belongs in a gate rather than in a runtime branch. The check
 * in `corner.test.ts` is what holds it, and it holds it for all 51 beaches at
 * once rather than for whichever one a reader happens to open.
 *
 * Deterministic, and computed from committed geometry alone, so a beach's
 * corner is the same on every visit and in every render.
 */
export function cornerFor(
  points: readonly PlotPoint[],
  box: Box,
  frame: Box,
): Corner {
  let roomiest: Corner = CORNER_ORDER[0];
  let mostRoom = -1;

  for (const corner of CORNER_ORDER) {
    const room = clearanceAt(corner, points, box, frame);
    if (room >= box.width) return corner;
    if (room > mostRoom) {
      mostRoom = room;
      roomiest = corner;
    }
  }

  return roomiest;
}

/**
 * Where the overlay sits inside the map's box, as CSS.
 *
 * Percentages rather than pixels, because the map is drawn `w-full` inside a
 * square frame: one drawing unit is one percent of the rendered box, so the
 * width declared here and the width `cornerFor` reasoned about are the same
 * number rather than two numbers that have to be kept in step.
 */
export function readoutStyle(
  corner: Corner,
  box: Box,
  frame: Box,
): {
  width: string;
  maxHeight: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
} {
  const width = `${(box.width / frame.width) * 100}%`;
  const maxHeight = `${(box.height / frame.height) * 100}%`;
  const vertical =
    corner === "top-left" || corner === "top-right"
      ? { top: "0" }
      : { bottom: "0" };
  const horizontal =
    corner === "top-left" || corner === "bottom-left"
      ? { left: "0" }
      : { right: "0" };

  return { width, maxHeight, ...vertical, ...horizontal };
}
