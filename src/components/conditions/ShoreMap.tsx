/**
 * This beach's own stretch of coast, with the four places its figures come
 * from plotted at their real distances.
 *
 * **ADR-0010's requirement drawn instead of written.** That decision ends on
 * "no figure is ever shown without the reader being able to see where it came
 * from", and the page has answered it in words ever since — a provenance line
 * under each group, a distance in kilometres. A reader who wants to know
 * whether the air temperature came from somewhere near the sand has been asked
 * to hold "1.4 km" in their head and imagine it. This draws it.
 *
 * **So the frame is sized by the sources, not by the beach.** Mission Beach's
 * map is 20 km tall because one of its stations is 9 km away, and the beach
 * being a fifth of that frame is the message rather than a defect. A map
 * comfortably framed on the sand would understate exactly the distance
 * ADR-0010 exists to disclose.
 *
 * **A quarter of the county has no coast to draw, and gets the map anyway.**
 * 23 of 51 beaches are in Mission Bay or San Diego Bay, between 2.6 and 5.4 km
 * from the nearest MOP line, because `mop-lines.json` traces the open coast
 * only. Widening their frames until the ocean appears was measured and
 * rejected: `mission-bay-vacation-isle` needs roughly five times the margin to
 * reach it, and what arrives is a shoreline 5 km away that is not this beach's
 * shore. They keep the markers — which are the part ADR-0010 asked for and the
 * part that works without a coastline — and the map says plainly that the
 * traced coast does not reach them.
 *
 * **Presentational and pure**, like `DaySpark`. It takes a window, a box and a
 * list of markers, and renders them; it resolves no station, reads no file and
 * knows nothing about what a buoy is. The words are the caller's, which is this
 * repo's rule about who owns the copy on this page.
 *
 * **Hand-rolled SVG**, per ADR-0025, and for the same three reasons: the
 * runtime dependency budget is guarded, the largest thing drawn here is a few
 * hundred points, and it has to render on the server.
 *
 * **The quiet register.** The brief puts the loud half of this site in the
 * chrome and asks the data to be drawn like a chart in a field guide. So: thin
 * strokes, one wash for the sea, no gridlines, no compass rose of our own, no
 * depth, no hazard and no verdict about whether the water is safe. ADR-0009's
 * line is easiest to cross with a picture, because a shaded sea is one
 * adjective away from a warning.
 */

import type { Bounds, ShorePoint } from "@/lib/coastline";
import { projectionFor } from "@/lib/coastline";
import { ProvenanceLine } from "./ProvenanceLine";

/** Which source a marker stands for. The list is closed on purpose. */
export type ShoreMarkerKind =
  "mop-line" | "wave-buoy" | "tide-station" | "air-station";

/**
 * One plotted source, named and measured by the caller.
 *
 * The three text fields are `ProvenanceLine`'s own, passed through rather than
 * reworded. That component is this repo's single owner of how "how far away" is
 * said, and a map that spelled "about 1.4 km from this beach" itself would be
 * a fifth place for that phrasing to drift — which is the whole reason it was
 * made one component. The brief's inventory says as much: `ProvenanceLine`,
 * reuse, unchanged, "used per needle, per series and per map marker".
 */
export type ShoreMarker = {
  kind: ShoreMarkerKind;
  /** What the figure names it, ready to print. Never a callsign turned into prose. */
  source: string;
  /** Who publishes it, or null where the binding genuinely does not know. */
  network?: string | null;
  /** Kilometres, already rounded by the caller's own threshold, or null. */
  distanceKm?: string | null;
  lat: number;
  lon: number;
};

export type ShoreMapProps = {
  /** The windowed coast in walk order. Empty draws no shoreline and says so. */
  coast: readonly ShorePoint[];
  /** The box the map covers, or null when there is nothing to frame. */
  bounds: Bounds | null;
  /**
   * The run of `coast` this beach occupies, drawn heavier than the rest.
   *
   * A run and never the beach's two ends joined: `beaches.json` carries a
   * bounding extent whose corners are not points on the MOP line, so a chord
   * between them lands beside the shore at an angle to it and reads as a
   * second, wrong coastline. `shore.ts` picks the run.
   */
  segment: readonly ShorePoint[] | null;
  markers: readonly ShoreMarker[];
  /** The spoken equivalent of the whole picture. */
  description: string;
  /** What to say instead of a map when there is no box at all. */
  absence: string;
  /** What to say when the traced coast does not reach this beach. */
  noCoast: string;
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
 * Far enough that the sea polygon always leaves the frame.
 *
 * Twice the diagonal, so no window shape can leave a corner unshaded. The outer
 * `<svg>` clips to its own viewport, so the overshoot costs nothing.
 */
const OFF_FRAME = 2 * Math.hypot(WIDTH, HEIGHT);

/**
 * A different shape per source, so colour is never the only thing telling two
 * markers apart.
 *
 * The brief's accessibility rule, and the one a map breaks most easily: four
 * dots in four hues is a legend waiting to happen, which is also an
 * anti-reference. A reader who cannot separate the hues still sees a square, a
 * triangle, a diamond and a ring.
 */
const MARKS: Record<
  ShoreMarkerKind,
  "square" | "triangle" | "diamond" | "ring"
> = {
  "mop-line": "square",
  "wave-buoy": "triangle",
  "tide-station": "diamond",
  "air-station": "ring",
};

/**
 * Every marker is outlined in the page's own ground.
 *
 * Two of the four sources are frequently the same place — at La Jolla the tide
 * gauge is bolted to the pier the air station is on, 200 m apart in a 3.9 km
 * frame — and two filled shapes at one point drew a single black smudge. A
 * halo in the ground colour separates them, so a reader sees two markers on top
 * of each other rather than one shape they cannot name. It is also the honest
 * picture: those stations really are in the same place.
 */
const HALO = "stroke-cream";

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
): string {
  const first = drawn[0];
  const last = drawn[drawn.length - 1];

  const px = last.x - first.x;
  const py = last.y - first.y;
  const length = Math.hypot(px, py) || 1;

  const walk = { x: (px / length) * OFF_FRAME, y: (py / length) * OFF_FRAME };
  const sea = { x: (py / length) * OFF_FRAME, y: (-px / length) * OFF_FRAME };

  const beyondEnd = { x: last.x + walk.x + sea.x, y: last.y + walk.y + sea.y };
  const beforeStart = {
    x: first.x - walk.x + sea.x,
    y: first.y - walk.y + sea.y,
  };

  return (
    `${path} L${beyondEnd.x.toFixed(2)} ${beyondEnd.y.toFixed(2)}` +
    ` L${beforeStart.x.toFixed(2)} ${beforeStart.y.toFixed(2)} Z`
  );
}

export function ShoreMap({
  coast,
  bounds,
  segment,
  markers,
  description,
  absence,
  noCoast,
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

  const missing = MISSING_SOURCES.filter(
    ([kind]) => !markers.some((marker) => marker.kind === kind),
  );

  return (
    <div>
      <svg
        role="img"
        aria-label={description}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="rounded-tile border-[1.5px] border-ocean block h-auto w-full bg-white/60"
      >
        {/*
          One wash, no gradient and no depth. The sea is the only filled region
          on this map, so a reader can tell water from land at a glance without
          a legend -- and it is a flat tint rather than a shaded one, because
          shading implies depth and depth here would be invented.
        */}
        {sea !== null && <path d={sea} className="fill-ocean/12" data-sea="" />}

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
          rather than only hue: the two are the same ocean, so a reader who sees
          no colour still sees which part of the shore they chose.
        */}
        {segment !== null && segment.length > 1 && (
          <path
            d={segment
              .map((point, index) => {
                const at = project(point.lat, point.lon);
                return `${index === 0 ? "M" : "L"}${at.x.toFixed(2)} ${at.y.toFixed(2)}`;
              })
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

        {markers.map((marker) => (
          <Mark key={marker.kind} marker={marker} project={project} />
        ))}
      </svg>

      {!hasCoast && <p className="text-2xs text-fog mt-2 italic">{noCoast}</p>}

      {/*
        The names live beside the picture rather than on it. A label per marker
        inside a 100-unit frame either overlaps its neighbour or shrinks under
        the 10px floor ADR-0024 refused to go below, and both are worse than a
        list. This is also what carries the marker names to a reader who is not
        looking at the shapes.
      */}
      <ul className="mt-2 flex flex-col gap-1">
        {markers.map((marker) => (
          <li key={marker.kind} className="flex items-baseline gap-1.5">
            <span aria-hidden="true" className="text-2xs">
              {GLYPHS[marker.kind]}
            </span>
            <ProvenanceLine
              source={marker.source}
              network={marker.network ?? null}
              distanceKm={marker.distanceKm ?? null}
              surface="page"
            />
          </li>
        ))}
        {missing.map(([kind, sentence]) => (
          <li key={kind} className="text-2xs text-fog leading-normal italic">
            {sentence}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What is said when a source is not bound, rather than leaving a gap.
 *
 * A map missing a marker reads as a map of a beach whose buoy is off-frame,
 * which is a different and wrong claim. 26 of 51 beaches bind no MOP line and
 * 36 bind no wave buoy, so this is the common case rather than the edge one.
 * No issue numbers and no promises: what is absent is absent.
 */
const MISSING_SOURCES: readonly (readonly [ShoreMarkerKind, string])[] = [
  ["mop-line", "No swell model is computed for this beach."],
  ["wave-buoy", "No wave buoy is bound to this beach."],
];

/** Drawn beside each name, and hidden from assistive tech: the list says it. */
const GLYPHS: Record<ShoreMarkerKind, string> = {
  "mop-line": "◼",
  "wave-buoy": "▲",
  "tide-station": "◆",
  "air-station": "◯",
};

function Mark({
  marker,
  project,
}: {
  marker: ShoreMarker;
  project: (lat: number, lon: number) => { x: number; y: number };
}) {
  const at = project(marker.lat, marker.lon);
  const shape = MARKS[marker.kind];
  const size = 2.4;
  const common = {
    "data-marker": marker.kind,
    "data-shape": shape,
    vectorEffect: "non-scaling-stroke" as const,
  };

  if (shape === "square") {
    return (
      <rect
        x={at.x - size / 2}
        y={at.y - size / 2}
        width={size}
        height={size}
        className={`fill-ink ${HALO}`}
        strokeWidth={1.2}
        {...common}
      />
    );
  }

  if (shape === "triangle") {
    return (
      <polygon
        points={`${at.x},${at.y - size} ${at.x - size},${at.y + size * 0.72} ${at.x + size},${at.y + size * 0.72}`}
        className={`fill-ink ${HALO}`}
        strokeWidth={1.2}
        {...common}
      />
    );
  }

  if (shape === "diamond") {
    return (
      <polygon
        points={`${at.x},${at.y - size} ${at.x + size},${at.y} ${at.x},${at.y + size} ${at.x - size},${at.y}`}
        className={`fill-ink ${HALO}`}
        strokeWidth={1.2}
        {...common}
      />
    );
  }

  return (
    <circle
      cx={at.x}
      cy={at.y}
      r={size * 0.85}
      fill="none"
      className="stroke-ink"
      strokeWidth={1.6}
      {...common}
    />
  );
}
