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
 * **Every beach in the county has a coast to draw.** A quarter of them did not:
 * 23 of 51 are in Mission Bay or San Diego Bay, and `mop-lines.json` traced the
 * open coast only, so they got a frame with a chord across it and a sentence
 * saying the traced coast did not reach them. ADR-0037 replaced that line with
 * CDFW's ecoregion boundary, which has the bays cut out of it and therefore
 * follows their shores; ADR-0039 stopped withholding it. What is left is one
 * beach on an island the committed mainland ring does not hold, and its two
 * ends are a single point, so it has no frame either and says so.
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
import { seaWash } from "./wash";

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
   * reads as a second, wrong coastline. Where no coast is drawn it is those two
   * ends after all, because nothing else on the picture says where the beach
   * is — which since ADR-0039 is no beach in the committed inventory.
   * `shore.ts` makes that choice.
   */
  segment: readonly Position[] | null;
  /**
   * A mark per beach this map is about, drawn across the coast at each.
   *
   * Empty on a beach map, which has one subject and draws it as a heavy run
   * instead. `shore.ts` decides where they go; the length, the direction and
   * the weight are decided here, because they are answers in plot units.
   *
   * **Marks and never targets.** The plan measured what making them tappable
   * would cost: four of La Jolla's midpoints fall within 549 m of one another,
   * so four marks at ADR-0004's 44px floor would need the map 2,634px wide.
   * The list of beaches above the map is the control; these are for orientation.
   */
  ticks?: readonly Position[];
  /** The spoken equivalent of the whole picture. */
  description: string;
  /** What to say instead of a map when there is no box at all. */
  absence: string;
  /**
   * What to say when the traced coast does not reach this beach.
   *
   * No committed beach is in that state since ADR-0039 — the bays have their
   * own shoreline and the island has no frame at all, so it takes `absence`
   * instead. The prop stays because this component is pure and is handed a
   * coast rather than resolving one: an empty coast has to render as a sentence
   * rather than as an empty square, which on a page about the sea reads as open
   * water.
   */
  noCoast: string;
  /**
   * What the drawn shore was traced from, said once under the picture.
   *
   * ADR-0010's rule applied to the largest thing on the map, which is now the
   * only thing on it. It matters more here than for an ordinary figure: nothing
   * about looking at a line down a coast says what traced it, so these words are
   * the only place a reader can learn it.
   *
   * Under ADR-0030 what they had to disclose was that the line was not a shore
   * at all — CDIP's model line, a few hundred metres out. ADR-0037 made it a
   * shore, and the disclosure did not go away, it changed: the line is county
   * linework with no published tide datum, so it says where the land is mapped
   * and not where today's water reaches.
   */
  coastCredit: string;
  /**
   * The weather readout, already rendered, printed under the picture.
   *
   * A slot rather than data, because the readout changes with the day a reader
   * picks and this picture does not: the map is built once on the server and
   * this is the one part of it that varies. `DayCompass` is what fills it.
   *
   * **Under the frame rather than over it or in it**, which is ADR-0038
   * reversing the placement half of ADR-0034. It was once translated into the
   * map's own drawing space, anchored on the beach's stretch of coast, where it
   * covered the one thing the picture exists to show; ADR-0034 lifted it out
   * into an overlay in whichever corner the geometry left free. That corner
   * stopped existing when the traced coast reached the bays — a bay shore
   * surrounds the frame — so it comes out of the picture altogether, and gets
   * the width of the column instead of 46 percent of a square.
   *
   * **Rendered on every beach.** The dial was once withheld wherever no
   * shoreline was drawn, on the rule that a bearing read against nothing is the
   * bare gauge the brief's anti-references open with — which meant nearly half
   * the inventory printed no wind figure anywhere on the picture. That rule was
   * about a needle over an empty frame; a labelled readout with units, a word
   * for the direction and a provenance line beneath is not that thing.
   * ADR-0034. The 23 frames it was about are no longer empty either.
   */
  readout?: ReactNode;
  /**
   * Where the readout's figures came from, printed beneath the picture.
   *
   * Two slots and not one, because attribution belongs under the picture rather
   * than on it: the map is already the densest thing in this column, and
   * `ShoreMap`'s own coast credit sits in the same place for the same reason.
   *
   * **Both halves go together.** A readout with its sources missing is an
   * unattributed figure, and sources printed under a map with no readout name a
   * bearing nobody can see. Neither is now tied to the coast: they arrive
   * together on all 51 beaches, or not at all on a day no feed gave a bearing
   * for, which is the caller's decision rather than this component's.
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
 * How long a beach's mark is, in plot units, so it is the same size on screen
 * whatever ground the frame covers.
 *
 * Four units of a hundred, which at the map column's measured 472px is about
 * 19px -- long enough to read as a mark across the coast at the review
 * viewport, short enough that La Jolla's tightest pair, 1.2 units apart, reads
 * as a cluster rather than as a single thick smudge. That crowding is accepted
 * rather than solved, and the plan measured why: those four beaches really do
 * sit within 549 m of one another.
 */
const TICK_UNITS = 4;

export function ShoreMap({
  coast,
  bounds,
  segment,
  ticks = [],
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

  /*
    The wash is built from the drawn coast and the frame, and from nothing else.

    It used to be closed on a normal taken across the run's two ends, which is
    exact on a straight shore and approximate on a bent one -- and ADR-0039 gave
    the bays a shoreline that turns through more than a right angle inside one
    frame. `seaWash` closes on the frame's own edges instead, so which side is
    water is read from the walk rather than from a direction anything here has
    to get right. ADR-0041.
  */
  const sea = seaWash(drawn, { width: WIDTH, height: HEIGHT });

  const drawnSegment =
    segment === null || segment.length < 2
      ? []
      : segment.map((point) => project(point.lat, point.lon));

  /*
    **The coast is not a condition on the readout**, which is the change
    ADR-0034's last clause records and this one keeps. It was one: a bearing
    read against no shoreline was held to be the bare gauge the brief opens its
    anti-references with, so the 23 beaches in Mission Bay and San Diego Bay
    printed no wind figure anywhere on the picture. That objection was about a
    needle drawn over an empty frame, and this is a labelled block with units
    and a publisher under it.

    What the drawn geometry no longer decides is *where the block goes*. It
    used to pick a corner, measured against the windowed coast and the beach's
    own stretch. See ADR-0038.
  */
  /*
    Both halves go together, which is the coupling the corner used to carry by
    accident: the overlay was gated on a corner having been chosen, and the
    sources were gated on the same thing. With no corner to gate on, it is
    stated.

    A readout with its sources missing is an unattributed figure, and sources
    printed under a map with no readout name a bearing nobody can see.
  */
  /*
    Each mark, as a short line across the coast rather than a dot on it.

    **Perpendicular to the coast where it is, not to the frame.** The direction
    comes from the two drawn points either side of the mark, so a tick on a bay
    shore that turns through a right angle inside one frame still crosses the
    line rather than lying along it. It is the same reading ADR-0041 gave the
    wash: take the direction from the walk rather than from a normal computed
    once for the whole picture.

    **A fixed length in plot units, so every mark is the same size on screen**
    whatever ground the frame covers. An area is 1.7 km of coast at Ocean Beach
    and 8.9 km at San Diego Bay - Central, and a mark measured in metres would
    be five times bigger on one than the other.

    A mark whose beach has no drawn coast near it -- the island in Mission Bay -
    West, about 400 m off the traced shore -- takes the direction of the nearest
    drawn point anyway. It lies off the line, which is where that beach is.
  */
  const marks = ticks.map((at) => {
    const point = project(at.lat, at.lon);
    if (drawn.length < 2) return { from: point, to: point };

    let nearest = 0;
    for (let index = 1; index < drawn.length; index += 1) {
      if (
        Math.hypot(drawn[index].x - point.x, drawn[index].y - point.y) <
        Math.hypot(drawn[nearest].x - point.x, drawn[nearest].y - point.y)
      ) {
        nearest = index;
      }
    }

    const before = drawn[Math.max(0, nearest - 1)];
    const after = drawn[Math.min(drawn.length - 1, nearest + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = TICK_UNITS / 2;

    return {
      from: {
        x: point.x - (-dy / length) * half,
        y: point.y - (dx / length) * half,
      },
      to: {
        x: point.x + (-dy / length) * half,
        y: point.y + (dx / length) * half,
      },
    };
  });

  const hasReadout = readout !== null && readout !== undefined;

  return (
    <div>
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
            d={`${sea
              .map(
                (at, index) =>
                  `${index === 0 ? "M" : "L"}${at.x.toFixed(2)} ${at.y.toFixed(2)}`,
              )
              .join(" ")} Z`}
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

        {marks.map((mark, index) => (
          <line
            key={index}
            x1={mark.from.x.toFixed(2)}
            y1={mark.from.y.toFixed(2)}
            x2={mark.to.x.toFixed(2)}
            y2={mark.to.y.toFixed(2)}
            className="stroke-purple-deep"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            data-tick=""
          />
        ))}

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
        Under the picture rather than over it, which is ADR-0038 reversing
        ADR-0034's placement.

        The corner it used to stand in was chosen by measuring which corner the
        drawn geometry left free, and that measurement stopped having an answer:
        with the traced coast reaching the bays, a bay shore surrounds the frame
        and `fiesta-island` and `mission-bay-sea-world` have no clear corner at
        any box size. Narrowing the block does not help -- the widest box that
        fits every beach is four units of a hundred.

        It is wider here, not narrower. The overlay was capped at 46 units --
        46 percent of a square that is itself a third of the row at `xl` -- and
        below the map it has the whole column. The cap existed only to keep the
        block off the picture.
      */}
      {hasReadout && (
        <div className="mt-3" data-readout="">
          {readout}
        </div>
      )}

      {hasCoast ? (
        <p className="text-2xs text-fog mt-2 italic">{coastCredit}</p>
      ) : (
        <p className="text-2xs text-fog mt-2 italic">{noCoast}</p>
      )}

      {hasReadout && readoutSources}
    </div>
  );
}
