/**
 * Where the wind and the swell come from, drawn on the beach they arrive at.
 *
 * **A bearing means nothing on its own, and that is why this is not a card.**
 * 281 degrees is a number. Drawn on the shore map, over a coastline a reader
 * can see, it becomes the thing they actually came for: whether the wind is
 * coming off the land or off the water. The design brief's third principle is
 * this component's whole justification -- "no dial floating beside a graph can
 * say which" -- and it is why `ShoreMap` hosts this rather than the day panel.
 *
 * **The needles point inward, at the beach.** Every feed this page reads
 * publishes the direction weather comes *from*, so the tail sits out at the
 * bearing and the head arrives at the sand. An arrow drawn the other way is the
 * same line saying the opposite thing, and a reader has no way to tell which
 * convention a drawing chose. This one is checkable against the map underneath
 * it: a needle whose tail is out over the shaded sea is onshore wind, which is
 * the reading the whole component exists to make possible.
 *
 * **The arc is the honesty.** A bare needle on a day the wind swung through 200
 * degrees would state a direction the day did not have. Measured across the
 * committed run, two days of seven have a daylight spread past 170 degrees and
 * four sit at 40 or less, so the two cases look completely different -- which is
 * the point. `bearing.ts` computes the arc; this draws it.
 *
 * **Presentational and pure**, like `ShoreMap` and `DaySpark`. It takes needles
 * and draws them; it reads no feed, resolves no station and words nothing. The
 * sentences are the caller's.
 *
 * **The ring is chrome, and it is the one piece here that is.** The day view's
 * review already named the cloud legend as the only element inside a frame that
 * is not data, and this is a second. It earns it: an arc with nothing to be a
 * portion of reads as a stray stroke rather than as a range, and the
 * alternative -- labelled tick marks at the cardinals -- is the boxed legend
 * the brief lists as an anti-reference. One faint circle is the smallest thing
 * that makes the arc mean what it means.
 */

import { compassWords } from "./bearing";
import { ProvenanceLine } from "./ProvenanceLine";

/** Which source a needle stands for. The list is closed on purpose. */
export type CompassNeedleKind = "wind" | "swell";

/** One needle, worded and measured by the caller. */
export type CompassNeedle = {
  kind: CompassNeedleKind;
  /** The needle's word, and the product's name: "Wind", "Swell". */
  label: string;
  /** Degrees true it comes *from*, weighted by how much there was. */
  fromDegT: number;
  /** The arc it swung through in daylight. Zero draws no arc. */
  spreadDeg: number;
  /** What the figure names its source, ready to print. */
  source: string;
  /** Who publishes it, or null where the binding does not know. */
  network: string | null;
  /** Why this source, when there is something to say. */
  note: string | null;
};

/**
 * How far out the needle's tail stands, in the map's own plot units.
 *
 * A quarter of the hundred-unit frame, so the dial reads as an instrument sat
 * on the beach rather than as a second picture covering the coast. Exported
 * because the tests check the tail lands on the bearing, and a test that
 * hard-coded the number would pass after somebody changed it here.
 */
export const DIAL_RADIUS = 26;

/** Where the head stops, short of the beach so the segment stays visible. */
const HEAD_RADIUS = 7;

/** The arc sits just outside the tails, where it crowds nothing. */
const ARC_RADIUS = DIAL_RADIUS + 4;

/**
 * Plot coordinates for a bearing at a radius, with north up.
 *
 * The one conversion in this file and the one worth stating: bearings run
 * clockwise from north, and plot y grows southward, so north is a *negative*
 * y. Writing it the intuitive way puts every needle upside down.
 */
function at(degreesTrue: number, radius: number): { x: number; y: number } {
  const radians = (degreesTrue * Math.PI) / 180;
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

/**
 * The two needles differ in shape and in weight, never in colour alone.
 *
 * The brief's rule, and the one a small graphic breaks most easily: the whole
 * dial is a few dozen pixels, and a reader who cannot separate two hues would
 * be left with two identical strokes. The wind is a thin line with an open
 * head; the swell is a heavier tapered blade. Colour reinforces the pair and
 * carries none of it.
 */
const NEEDLES: Record<
  CompassNeedleKind,
  { stroke: string; fill: string; width: number; head: number }
> = {
  wind: { stroke: "stroke-ocean", fill: "fill-ocean", width: 1.4, head: 2.6 },
  swell: {
    stroke: "stroke-purple-deep",
    fill: "fill-purple-deep",
    width: 3,
    head: 4,
  },
};

/**
 * The dial, drawn around whatever origin its parent translated it to.
 *
 * `ShoreMap` puts that origin on the beach's own stretch of coast rather than
 * at the middle of the frame, because the frame is sized by the sources: at
 * `mission-beach` a station nine kilometres away puts the frame's centre out in
 * the county somewhere, and a needle pointing at that would be pointing at
 * nothing.
 */
export function Compass({ needles }: { needles: readonly CompassNeedle[] }) {
  if (needles.length === 0) return null;

  return (
    <g data-compass-dial="">
      <circle
        cx={0}
        cy={0}
        r={ARC_RADIUS}
        fill="none"
        className="stroke-fog"
        strokeWidth={0.6}
        strokeOpacity={0.45}
        vectorEffect="non-scaling-stroke"
      />

      {needles.map((needle) => (
        <Needle key={needle.kind} needle={needle} />
      ))}
    </g>
  );
}

function Needle({ needle }: { needle: CompassNeedle }) {
  const style = NEEDLES[needle.kind];
  const tail = at(needle.fromDegT, DIAL_RADIUS);
  const head = at(needle.fromDegT, HEAD_RADIUS);

  /*
    The two barbs of the arrowhead, set back along the shaft and out to either
    side. Built from the same `at` conversion rather than from a rotation
    matrix, so there is one place in this file that knows which way north is.
  */
  const barbBack = at(needle.fromDegT, HEAD_RADIUS + style.head * 1.6);
  const across = {
    x: (tail.y - head.y) / DIAL_RADIUS,
    y: (head.x - tail.x) / DIAL_RADIUS,
  };
  const barbs = [
    `${(barbBack.x + across.x * style.head).toFixed(2)},${(barbBack.y + across.y * style.head).toFixed(2)}`,
    `${head.x.toFixed(2)},${head.y.toFixed(2)}`,
    `${(barbBack.x - across.x * style.head).toFixed(2)},${(barbBack.y - across.y * style.head).toFixed(2)}`,
  ].join(" ");

  return (
    <>
      {needle.spreadDeg > 0 && <Arc needle={needle} />}

      <line
        x1={Number(tail.x.toFixed(2))}
        y1={Number(tail.y.toFixed(2))}
        x2={Number(head.x.toFixed(2))}
        y2={Number(head.y.toFixed(2))}
        className={style.stroke}
        strokeWidth={style.width}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        data-needle={needle.kind}
      />

      <polygon
        points={barbs}
        className={style.fill}
        data-needle-head={needle.kind}
      />
    </>
  );
}

/**
 * The band the direction moved through while the sun was up.
 *
 * A stroked arc rather than a filled wedge from the centre. A wedge covering a
 * fifth of the map on a settled day and half of it on an unsettled one would
 * hide the coast underneath exactly when the reader most needs to compare the
 * two, and the arc says the same thing at the rim.
 */
function Arc({ needle }: { needle: CompassNeedle }) {
  const half = needle.spreadDeg / 2;
  const from = at(needle.fromDegT - half, ARC_RADIUS);
  const to = at(needle.fromDegT + half, ARC_RADIUS);

  /*
    Which of the two arcs between the endpoints is meant. Without the flag a
    200-degree swing draws as the 160-degree one on the other side of the dial,
    which is not merely wrong but the opposite claim.

    The sweep flag is 1 because bearings increase clockwise and, in a space
    where y grows downward, a positive sweep is clockwise on screen.
  */
  const largeArc = needle.spreadDeg > 180 ? 1 : 0;

  return (
    <path
      d={
        `M${from.x.toFixed(2)} ${from.y.toFixed(2)} ` +
        `A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
      }
      fill="none"
      className={NEEDLES[needle.kind].stroke}
      strokeWidth={4}
      strokeOpacity={0.65}
      strokeLinecap="butt"
      vectorEffect="non-scaling-stroke"
      data-arc={needle.kind}
    />
  );
}

/**
 * Beyond this, the eight-point word for the needle stops covering its own arc.
 *
 * Not a threshold picked to suit the data: one compass point is exactly the
 * width the words have, so a swing wider than one is a swing the words cannot
 * describe and a reader is owed the number instead. It happens to separate the
 * committed run cleanly -- four days at 40 or 50, two past 170 -- which is a
 * check on the rule rather than the reason for it.
 */
const WIDE_SWING_DEG = 45;

/**
 * What the dial says, for a reader who is not looking at it.
 *
 * **Beside the picture rather than on it**, which is `ShoreMap`'s own rule for
 * its markers and for the same two reasons: a label inside a hundred-unit frame
 * either overlaps its neighbour or shrinks under the ten-pixel floor ADR-0024
 * refused to go below, and the map is one `role="img"` whose contents are not
 * in the accessibility tree at all. This block is the dial's text equivalent,
 * so it states both bearings in words and in degrees.
 *
 * One provenance line per needle, which is `WeekGrid`'s resolution rather than
 * `StatGroup`'s contract: one dial carrying two publishers is a deliberate
 * break of one-group-one-source, answered by attributing each row.
 */
export function CompassSources({
  needles,
}: {
  needles: readonly CompassNeedle[];
}) {
  if (needles.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-col gap-1">
      {needles.map((needle) => (
        <li key={needle.kind}>
          <p className="text-2xs text-ink leading-normal">
            {needle.label}, from the {compassWords(needle.fromDegT)},{" "}
            {Math.round(needle.fromDegT)}°
            {needle.spreadDeg > WIDE_SWING_DEG
              ? ` — swinging through ${Math.round(needle.spreadDeg)}° in daylight`
              : ""}
          </p>
          <ProvenanceLine
            source={needle.source}
            network={needle.network}
            note={needle.note}
            surface="page"
          />
        </li>
      ))}
    </ul>
  );
}
