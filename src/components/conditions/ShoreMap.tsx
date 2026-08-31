/**
 * This beach's own stretch of coast, and which side of it the water is on.
 *
 * **A picture of a place, not a picture of an inventory.** It drew the four
 * sources every figure on the page comes from, each at its real distance —
 * ADR-0010 answered by drawing rather than by writing. Reviewed on the built
 * page that was the wrong picture: four glyphs of four shapes, two of them
 * overlapping wherever a tide gauge is bolted to the pier an air station
 * stands on, and a frame stretched to hold a station nobody was asking about.
 * ADR-0010 is satisfied by the words it always named — a provenance line under
 * every group, naming the station and its distance — and those are unchanged.
 *
 * **So the frame is sized by the beach and the line off it.** Not by the
 * county's instruments: a frame sized by things that are not drawn is a rule
 * nobody can see from the page, and it left `pacific-beach` framed on a
 * station 7.4 km inland. The bound MOP line stays in that arithmetic because
 * it is where the drawn coastline *is*, 117 to 930 m out, so a window without
 * it crops the shoreline off the edge.
 *
 * **A quarter of the county has no coast to draw, and gets the map anyway.**
 * 23 of 51 beaches are in Mission Bay or San Diego Bay, between 2.6 and 5.4 km
 * from the nearest MOP line, because `mop-lines.json` traces the open coast
 * only. Widening their frames until the ocean appears was measured and
 * rejected: what arrives is a shoreline 5 km away that is not this beach's
 * shore. They get their own stretch drawn as a chord — the one thing that says
 * where the beach is — and the map says plainly that the traced coast does not
 * reach them.
 *
 * **Presentational and pure**, like `DaySpark`. It takes a window, a box and a
 * stretch, and renders them; it resolves no station and reads no file. The
 * words are the caller's, which is this repo's rule about who owns the copy on
 * this page.
 *
 * **Hand-rolled SVG**, per ADR-0025, and for the same three reasons: the
 * runtime dependency budget is guarded, the largest thing drawn here is a few
 * hundred points, and it has to render on the server.
 *
 * **The quiet register.** The brief puts the loud half of this site in the
 * chrome and asks the data to be drawn like a chart in a field guide. So: thin
 * strokes, one flat wash for the sea, no gridlines, no depth, no hazard and no
 * verdict about whether the water is safe. ADR-0009's line is easiest to cross
 * with a picture, because a shaded sea is one adjective away from a warning.
 */

import type { ReactNode } from "react";
import type { Bounds, Position, ShorePoint } from "@/lib/coastline";
import { projectionFor } from "@/lib/coastline";
import { cornerFor, READOUT_BOX, readoutStyle } from "./corner";

export type ShoreMapProps = {
  /** The windowed coast in walk order. Empty draws no shoreline and says so. */
  coast: readonly ShorePoint[];
  /** The box the map covers, or null when there is nothing to frame. */
  bounds: Bounds | null;
  /**
   * Where this beach is, drawn heavier than anything around it.
   *
   * A run of `coast` wherever a coast is drawn, because a chord between the two
   * ends `beaches.json` carries lands beside the shore at an angle to it and
   * reads as a second, wrong coastline. On the 23 beaches with no coast in
   * frame it is those two ends after all, because nothing else on the picture
   * says where the beach is. `shore.ts` makes that choice.
   */
  segment: readonly Position[] | null;
  /** The spoken equivalent of the whole picture. */
  description: string;
  /** What to say instead of a map when there is no box at all. */
  absence: string;
  /** What to say when the traced coast does not reach this beach. */
  noCoast: string;
  /**
   * What the drawn shore was traced from, said once under the picture.
   *
   * ADR-0010's rule applied to the largest thing on the map, which is now the
   * only thing on it. It matters more here than for an ordinary figure: nothing
   * about looking at a line down a coast says it is a model line computed a few
   * hundred metres offshore rather than the shore itself, so these words are the
   * only place a reader can learn it.
   */
  coastCredit: string;
  /**
   * The weather readout, already rendered, laid over a corner of the picture.
   *
   * A slot rather than data, because the readout changes with the day a reader
   * picks and this picture does not: the map is built once on the server and
   * this is the one part of it that varies. `DayCompass` is what fills it.
   *
   * **HTML over the frame rather than a group inside it**, which is the change
   * ADR-0034 records. It used to be translated into the map's own drawing space
   * and anchored on the beach's stretch of coast, where it covered the one
   * thing the picture exists to show. It is now positioned in CSS against the
   * map's box, and which corner it lands in is measured rather than fixed —
   * see `corner.ts`.
   *
   * Withheld along with everything else when there is no coast to read a
   * bearing against. See `readoutSources`.
   */
  readout?: ReactNode;
  /**
   * Where the readout's figures came from, printed beneath the picture.
   *
   * Two slots and not one, because attribution belongs under the picture rather
   * than on it: the map is already the densest thing in this column, and
   * `ShoreMap`'s own coast credit sits in the same place for the same reason.
   *
   * **Both halves go together, and go together with the coast.** A readout with
   * its sources missing is an unattributed figure; sources printed under a map
   * with no readout name a bearing nobody can see. On the 23 beaches the traced
   * coast does not reach, neither is rendered.
   */
  readoutSources?: ReactNode;
};

/**
 * The drawing space, in user units. Square-ish, because the brief asks for it
 * and because the compass that lands on this in #173's second half is round.
 *
 * The projection letterboxes inside this rather than stretching to fill, so a
 * tall thin window and a wide flat one both keep their shape.
 */
const WIDTH = 100;
const HEIGHT = 100;

/**
 * The same two numbers as a box, for the things that reason about the frame
 * rather than draw into it.
 *
 * One definition, passed to both, so the readout's footprint and the map's
 * viewBox cannot drift apart. `corner.ts` measures in these units and
 * `readoutStyle` converts them to percentages, which is exact because the frame
 * is square and the picture is drawn `w-full` at `h-auto`.
 */
const FRAME = { width: WIDTH, height: HEIGHT };

/**
 * Far enough that the sea polygon always leaves the frame.
 *
 * Twice the diagonal, so no window shape can leave a corner unshaded. The outer
 * `<svg>` clips to its own viewport, so the overshoot costs nothing.
 */
const OFF_FRAME = 2 * Math.hypot(WIDTH, HEIGHT);

/**
 * The sea, as a polygon closed off the edge of the frame.
 *
 * **Which side is seaward.** `sideOf` in `lib/coastline.ts` answers that
 * geographically and the `sea-side` gate row proves the answer is "left of the
 * walk" for every beach that can be asked. Converting to plot coordinates is
 * the one place the flip matters: `projectionFor` puts north at the top, so y
 * grows southward and the geographic left of a walk appears on the other hand
 * on screen. Left of geographic (dx, dy) is (-dy, dx); with y flipped, a plot
 * direction (px, py) has its seaward normal at (py, -px).
 *
 * **The polygon also runs on past both ends, and that is not decoration.**
 * Closing straight from the last point to seaward and back to the first leaves
 * a wedge of frame unshaded wherever the coast is not perpendicular to that
 * normal — a diagonal edge of missing sea in a corner, which reads as a drawing
 * error because it is one. Extending along the walk as well as out to sea puts
 * both closing corners outside the frame in both directions, so the whole
 * seaward half is covered whatever angle the shore runs at.
 *
 * Taken from the run's two ends rather than segment by segment: the polygon
 * only has to close on the right side of the frame, and a per-segment normal
 * would fold on itself at a bend.
 */
function seaPath(
  path: string,
  drawn: readonly { x: number; y: number }[],
): {
  d: string;
  from: { x: number; y: number };
  unit: { x: number; y: number };
} {
  const first = drawn[0];
  const last = drawn[drawn.length - 1];

  const px = last.x - first.x;
  const py = last.y - first.y;
  const length = Math.hypot(px, py) || 1;

  const unit = { x: py / length, y: -px / length };
  const walk = { x: (px / length) * OFF_FRAME, y: (py / length) * OFF_FRAME };
  const sea = { x: unit.x * OFF_FRAME, y: unit.y * OFF_FRAME };

  const beyondEnd = { x: last.x + walk.x + sea.x, y: last.y + walk.y + sea.y };
  const beforeStart = {
    x: first.x - walk.x + sea.x,
    y: first.y - walk.y + sea.y,
  };

  return {
    d:
      `${path} L${beyondEnd.x.toFixed(2)} ${beyondEnd.y.toFixed(2)}` +
      ` L${beforeStart.x.toFixed(2)} ${beforeStart.y.toFixed(2)} Z`,
    from: drawn[Math.floor(drawn.length / 2)],
    unit,
  };
}

export function ShoreMap({
  coast,
  bounds,
  segment,
  description,
  absence,
  noCoast,
  coastCredit,
  readout = null,
  readoutSources = null,
}: ShoreMapProps) {
  if (bounds === null) {
    return <p className="text-2xs text-fog italic">{absence}</p>;
  }

  const project = projectionFor(bounds, { width: WIDTH, height: HEIGHT });
  const drawn = coast.map((point) => project(point.lat, point.lon));
  const hasCoast = drawn.length > 1;

  const path = drawn
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");

  const sea = hasCoast ? seaPath(path, drawn) : null;

  const drawnSegment =
    segment === null || segment.length < 2
      ? []
      : segment.map((point) => project(point.lat, point.lon));

  /*
    Which corner the readout stands in, or null when there is nothing to read a
    bearing against.

    The condition is the coast, not the readout's size: on the 23 beaches the
    traced coastline does not reach, a bearing has no shoreline to be read
    against and is the bare gauge the brief's anti-references open with.

    The corner is measured against everything the map draws -- the windowed
    coast and this beach's own stretch -- rather than against the segment alone.
    The plan asked only for the segment; measured, an adaptive corner clears
    both on every beach in the inventory, so there was no reason but arithmetic
    to leave the coastline out and the arithmetic did not charge for it.
  */
  const corner =
    readout === null || !hasCoast || drawnSegment.length === 0
      ? null
      : cornerFor([...drawn, ...drawnSegment], READOUT_BOX, FRAME);

  const rightHanded = corner === "top-right" || corner === "bottom-right";

  return (
    <div>
      {/*
        The wrapper the readout is positioned against, and it wraps the picture
        alone. The coast credit below must stay outside it: an overlay measured
        against a box that included a line of prose would be measured against a
        box that is not square, and the readout's footprint is in the map's own
        units precisely because those two agree.
      */}
      <div className="relative">
        <svg
          role="img"
          aria-label={description}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="rounded-tile border-[1.5px] border-ocean block h-auto w-full bg-white/60"
        >
          {/*
            One wash, no gradient and no depth. The sea is the only filled
            region on this map, so a reader can tell water from land at a glance
            without a legend -- and it is a flat tint rather than a shaded one,
            because shading implies depth and depth here would be invented.
          */}
          {sea !== null && (
            <path
              d={sea.d}
              className="fill-ocean"
              fillOpacity={0.16}
              data-sea=""
            />
          )}

          {hasCoast && (
            <path
              d={path}
              fill="none"
              className="stroke-ocean"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              data-coast=""
            />
          )}

          {/*
            This beach's own stretch, heavier than the coast it sits on. Weight
            rather than only hue: the two are the same ocean, so a reader who
            sees no colour still sees which part of the shore they chose.
          */}
          {drawnSegment.length > 0 && (
            <path
              d={drawnSegment
                .map(
                  (at, index) =>
                    `${index === 0 ? "M" : "L"}${at.x.toFixed(2)} ${at.y.toFixed(2)}`,
                )
                .join(" ")}
              fill="none"
              className="stroke-purple-deep"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              data-segment=""
            />
          )}
        </svg>

        {/*
          Over the picture rather than in it, in the corner the geometry left
          free. The box is set from `READOUT_BOX` rather than from the content,
          so what the overlay occupies and what `cornerFor` was asked to keep
          clear are one number: a block that grew past its footprint would make
          the inventory-wide check a claim about a box nothing draws.
        */}
        {corner !== null && (
          <div
            className={`absolute flex p-1.5 ${rightHanded ? "justify-end" : "justify-start"}`}
            style={readoutStyle(corner, READOUT_BOX, FRAME)}
            data-readout-corner={corner}
          >
            {readout}
          </div>
        )}
      </div>

      {hasCoast ? (
        <p className="text-2xs text-fog mt-2 italic">{coastCredit}</p>
      ) : (
        <p className="text-2xs text-fog mt-2 italic">{noCoast}</p>
      )}

      {corner !== null && readoutSources}
    </div>
  );
}
