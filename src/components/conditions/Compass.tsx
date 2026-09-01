/**
 * Where the wind and the swell come from, read in the corner of the map they
 * arrive at.
 *
 * **A bearing means nothing on its own, and that has not changed.** 281 degrees
 * is a number; read in the same frame as a coastline a reader can see, it
 * becomes the thing they came for — whether the wind is coming off the land or
 * off the water. The design brief's third principle is still this component's
 * justification, and it is still why `ShoreMap` hosts this rather than the day
 * panel.
 *
 * **What changed is that the instrument stopped covering the picture.** This
 * was a dial: a ring 30 units across a 100-unit frame, two needles and two
 * labels, anchored on the beach's own stretch of coast — so the coastline the
 * needles were to be read against was underneath them, and on some beaches the
 * dial overflowed the edge. Reviewed on the built page it was distracting, and
 * it was covering its own subject. See ADR-0034.
 *
 * **The rows state one hour, and the wedge behind them states the day.** They
 * were a day aggregate while the chart beside them stated an hour, which is
 * issue #193: two regions saying different things about one day, a few
 * centimetres apart. ADR-0027 refused the obvious fix — a needle "whose meaning
 * changes depending on what was last clicked" — and ADR-0035 supersedes that
 * clause by removing the thing that changes, rather than by arguing with it.
 * There is no day mode to switch out of: the arrow is the wind at one hour
 * before any click as well as after every one, and the caption says which hour
 * that is. What the day keeps is the wedge, which is the reading ADR-0034 built
 * it for — a narrow one is a day that had a direction and a near-blob is a day
 * that did not.
 *
 * **The arrows still carry true bearings, and that is deliberate rather than
 * inherited.** The alternative considered was a corner block whose arrows are
 * decorative, with an animated field carrying direction instead. That field is
 * gated off under `prefers-reduced-motion`, so the map would say nothing
 * directional at all to a reader who turned motion off — and directional is the
 * one thing this map is for.
 *
 * **The arrow points the way the weather travels.** Every feed this page reads
 * publishes the direction weather comes *from*, so the tail sits at that
 * bearing and the head is opposite it. Drawn the other way it is the same line
 * saying the reverse, and a reader has no way to tell which convention a
 * drawing chose. This one is checkable against the map beside it: an arrow
 * whose tail is out over the shaded sea is onshore wind, which is the reading
 * the whole component exists to make possible.
 *
 * **The ring went and the arc became a wedge**, which is one change rather than
 * two. The ring's only stated justification was that "an arc with nothing to be
 * a portion of reads as a stray stroke rather than as a range" — so at corner
 * size, where a 40° arc and a 50° arc on a 9px ring are the same picture, the
 * arc it justified can no longer be judged and both go. A filled cone reads at
 * 16px, and a 190° day drawing a near-blob is correct: that day had no
 * direction. The wedge was rejected once, on the grounds that "a wedge covering
 * a fifth of the map on a settled day and half of it on an unsettled one would
 * hide the coast underneath". In a corner readout there is no coast underneath.
 *
 * **HTML, not SVG in plot units.** Plot-unit type was already at ADR-0024's
 * 10px floor — 3.2 units is 10.5px on the 328px map a phone draws — and these
 * rows carry four fields where the old label carried one word. The `<svg>` is
 * one `role="img"`, so nothing drawn inside it reaches the accessibility tree
 * at all; this block is in the tree, which is what makes it the text equivalent
 * rather than a picture needing one. And it costs no vertical height, in a
 * column already stacking a map, a coast credit, provenance rows and the
 * sightings slot, reviewed in a 555px-tall stop.
 *
 * **Presentational and pure**, like `ShoreMap` and `DaySpark`. It takes needles
 * and renders them; it reads no feed, resolves no station and words nothing
 * that is not arithmetic on what it was handed. The sentences are the caller's.
 */

import { compassWords } from "./bearing";
import { ProvenanceLine, type ProvenanceFacts } from "./ProvenanceLine";

/** Which source a needle stands for. The list is closed on purpose. */
export type CompassNeedleKind = "wind" | "swell";

/** One needle, worded and measured by the caller. */
export type CompassNeedle = {
  kind: CompassNeedleKind;
  /** The needle's word, and the product's name: "Wind", "Swell". */
  label: string;
  /** Degrees true it came *from* at the hour this row is for. */
  fromDegT: number;
  /**
   * The day's daylight arc: where it sat, and how far it swung getting there.
   *
   * **Its own bearing rather than the arrow's, because it is a different
   * statement.** The arrow is one hour and the wedge is the whole of that day's
   * daylight, so a wedge centred on the arrow would be a band of the day's
   * width drawn around an hour the day may never have averaged -- and it would
   * move on every click, which is the needle ADR-0027 refuses and ADR-0035
   * keeps refusing. Drawn from here, it is the same picture at every hour of
   * one day, and at a night hour the arrow can leave it: that hour's wind came
   * from a direction it never came from while the sun was up.
   *
   * `null` on a day with no published bearing inside daylight, which draws no
   * wedge. The row still states the hour it has.
   */
  swing: { fromDegT: number; spreadDeg: number } | null;
  /**
   * How much of it there was, worded and rounded by the caller: "11.5 mph",
   * "3.4 ft · 14 s".
   *
   * **A string rather than a number, because the rounding is a decision made
   * elsewhere and has to survive verbatim.** The swell's is `swellFigure` and
   * the wind's `windFigure`, which is where the precision issue #191 is about
   * is settled; a component that re-rounded either would be a second opinion
   * about a figure the page holds once. `ProvenanceLine.distanceKm` is a string
   * for the same reason.
   *
   * **The week grid and this block may now print different numbers for one
   * day**, and that reverses an invariant `DayPanel` used to state. The grid
   * states the day's biggest daylight step and this states the hour a reader is
   * looking at: two different facts, each named by its own caption and its own
   * provenance line, which is the condition ADR-0010 and ADR-0029 set rather
   * than an exception to them (ADR-0035).
   *
   * `null` where the source gave a direction and no magnitude, which is a
   * ragged forecast rather than a fault. The row then says what it knows.
   */
  figure: string | null;
  /**
   * Where this row's figures came from, ready for `ProvenanceLine`.
   *
   * The whole record rather than its three most-used fields, because the label
   * and the distance are load-bearing here: the label is what says which of two
   * lines is the wind, now that neither restates its bearing, and it is where
   * the superlative goes — `WaveWeek` records why "Swell" over a single figure
   * invites a reader to take it for the day's typical swell, "which is the one
   * thing it is not".
   */
  provenance: ProvenanceFacts;
};

/**
 * The glyph's own drawing space, in its own units.
 *
 * Its own frame rather than the map's: this is 16 CSS pixels of picture inside
 * a row of text, so it is sized like an icon and knows nothing about the
 * hundred-unit frame the coastline is drawn in. `ARM` leaves a margin inside
 * the box for the arrowhead's barbs, which reach across the shaft.
 */
const GLYPH_UNITS = 20;
const ARM = 8;

/**
 * The wedge reaches past the arrow's tail, and that is what makes a settled day
 * readable.
 *
 * Drawn at the arrow's own radius, a 30-degree spread is a sliver lying under
 * the shaft and is invisible at 16px -- looked at on the built page, the swell
 * row appeared to have no wedge at all rather than a narrow one. Reaching 1.5
 * units further out leaves a rim of it showing whatever the shaft covers, so
 * the difference between a settled day and an unsettled one is a difference in
 * the picture rather than between a picture and nothing.
 */
const WEDGE_RADIUS = 9.5;

/**
 * Plot coordinates for a bearing at a radius, with north up.
 *
 * The one conversion in this file and the one worth stating: bearings run
 * clockwise from north, and plot y grows southward, so north is a *negative*
 * y. Writing it the intuitive way puts every arrow upside down.
 */
function at(degreesTrue: number, radius: number): { x: number; y: number } {
  const radians = (degreesTrue * Math.PI) / 180;
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

/**
 * The two rows differ in shape and in weight, never in colour alone.
 *
 * The brief's rule, kept even though each arrow now sits beside its own word
 * and could lean on that. A 16px glyph is exactly the size at which two hues
 * are the weakest thing to tell two marks apart, and the pair is read as a pair
 * — one above the other — so a reader who cannot separate the colours would
 * otherwise be comparing two identical arrows.
 *
 * **Open against solid, and thin against heavy.** The wind is a light shaft
 * under a hollow chevron, the swell a heavy one under a filled blade. Both
 * survive greyscale, which is the test that matters; colour reinforces the pair
 * and carries none of it. It also reads as what each is — air is the lighter
 * mark and water the heavier one.
 *
 * The lengths no longer differ. On the map the two needles ran on separate
 * tracks so a day whose wind and swell came from one quarter could not draw
 * them on top of each other — found by looking at the built page, and an
 * ordinary day at La Jolla rather than an edge case. Two arrows in two labelled
 * rows cannot overlap, so the tracks are gone with the dial that needed them.
 */
const GLYPHS: Record<
  CompassNeedleKind,
  {
    stroke: string;
    fill: string;
    /** How solid the wedge is. Faint: it is a range behind a reading. */
    wedgeOpacity: number;
    width: number;
    /** Half the arrowhead's span across the shaft. */
    barb: number;
    solid: boolean;
  }
> = {
  wind: {
    stroke: "stroke-ocean",
    fill: "fill-ocean",
    wedgeOpacity: 0.3,
    width: 1.5,
    barb: 1.9,
    solid: false,
  },
  swell: {
    stroke: "stroke-purple-deep",
    fill: "fill-purple-deep",
    wedgeOpacity: 0.35,
    width: 2,
    barb: 2.6,
    solid: true,
  },
};

/** The glyphs' geometry, exported so tests read it rather than repeat it. */
export const NEEDLE_GLYPHS = GLYPHS;

/**
 * Beyond this, the eight-point word for a needle stops describing its own
 * range.
 *
 * Not a threshold picked to suit the data: one compass point is exactly the
 * width the words have, so a swing wider than one is a swing the words cannot
 * describe and a reader is owed the number instead. It happens to separate the
 * committed run cleanly — four days at 40 or 50, two past 170 — which is a check
 * on the rule rather than the reason for it.
 */
const WIDE_SWING_DEG = 45;

/**
 * What one row says to a reader who is not looking at it.
 *
 * The visible row is abbreviated — a glyph, a word, a bearing — and this is the
 * unabbreviated form. `role="img"` with a label is how `DaylightWeek` and
 * `Placeholder` name a thing whose visible content is not its name; this repo
 * does not use `sr-only`, and `ReadingCard` records why: the accessible-name
 * algorithm joins inline text nodes with no separator, so a visually-hidden
 * connective concatenates with its neighbours rather than reading as a phrase.
 *
 * **Each row names the hour, even though the caption above them has just said
 * it.** `role="img"` takes a row out of the reading order as a single named
 * thing, so a sentence that leaned on the line above it would be a sentence
 * about no particular time wherever it is met on its own. The repetition is the
 * price of rows that are their own spoken equivalent, which is what this block
 * is instead of a picture with a description.
 *
 * **The figure is no longer "at its biggest".** It was the day's largest in
 * daylight and it is now this hour's own, so the superlative would be a claim
 * the row has stopped making. It moved to the wind's provenance label, where
 * `windPeakLabel` states it with the hour it happened at (ADR-0035). The swing
 * clause keeps "in daylight", because the wedge behind the arrow is still the
 * day's daylight swing and does not follow the selection.
 */
export function needleSentence(needle: CompassNeedle, at: string): string {
  const swing =
    needle.swing !== null && needle.swing.spreadDeg > WIDE_SWING_DEG
      ? `, swinging through ${Math.round(needle.swing.spreadDeg)}° in daylight`
      : "";
  const figure = needle.figure === null ? "" : `, ${needle.figure}`;
  return (
    `${needle.label} at ${at}, from the ${compassWords(needle.fromDegT)}, ` +
    `${Math.round(needle.fromDegT)}°${swing}${figure}`
  );
}

/**
 * The readout, printed under the map by its caller.
 *
 * It renders the rows and nothing about where they stand. That used to be a
 * question about the coastline underneath — which corner of the picture was
 * safe to cover — and this component could not see it, so `ShoreMap` measured
 * and positioned. ADR-0038 ended the question by taking the block off the
 * picture; `ShoreMap` now just places it below.
 */
export function Compass({
  needles,
  caption,
}: {
  needles: readonly CompassNeedle[];
  /** The hour these rows are for, worded by the caller: "3 PM". */
  caption: string;
}) {
  if (needles.length === 0) return null;

  /*
    The rows wrap rather than run on, which is ADR-0004's own resolution of the
    same squeeze: content that no longer fits grows its container instead of
    being clipped, because a taller block is a visible degradation and a line
    running off the picture is an invisible one.

    It binds at 320 CSS px, which that ADR commits this site to.

    **The figures that used to be here were measured against the overlay and
    have expired.** They read: `SWELL south-west 270°` is 147.6px at 10px
    against the 151.5px this box leaves inside a 327px map and the 124px it
    leaves inside a 272px one -- so the bearing drops under its own label at
    the narrow end. That was the block at 46 percent of a square map column.

    ADR-0038 took it out of the picture and gave it the column, so it is about
    twice as wide at every breakpoint and the wrap those numbers describe no
    longer binds where they said it did. The rule is kept because it is the
    right behaviour under squeeze, not because the squeeze is still there.
    Restating it with new figures needs the rendered page rather than this
    file, and it is not restated here on a guess.
  */
  /*
    The caption is the hour, and it is above the rows rather than after them
    because a figure is read against what it is for. It is always here: a block
    that changed its numbers with nothing visible saying what they now mean is
    the failure this page is least entitled to ship, and one that grew a line on
    the first click would move the rows under a reader's eye.

    Not `aria-live`. The chart's own readout is, and it announces the same
    change; two live regions firing on one arrow-press means a keyboard reader
    hears it twice (ADR-0035).
  */
  return (
    <div className="flex flex-col gap-1" data-readout="">
      <p
        className="text-2xs text-ink leading-none font-extrabold tracking-wide tabular-nums"
        data-readout-caption=""
      >
        {caption}
      </p>
      {needles.map((needle) => (
        <Row key={needle.kind} needle={needle} at={caption} />
      ))}
    </div>
  );
}

function Row({ needle, at }: { needle: CompassNeedle; at: string }) {
  return (
    <p
      role="img"
      aria-label={needleSentence(needle, at)}
      className="text-2xs text-ink flex flex-wrap items-center gap-x-1 leading-none font-bold tabular-nums"
      data-readout-row={needle.kind}
    >
      <Glyph needle={needle} />
      <span className="uppercase" data-readout-label={needle.kind}>
        {needle.label}
      </span>{" "}
      <span className="whitespace-nowrap" data-readout-bearing={needle.kind}>
        {compassWords(needle.fromDegT)} {Math.round(needle.fromDegT)}°
      </span>{" "}
      {needle.figure !== null && (
        <span className="whitespace-nowrap" data-readout-figure={needle.kind}>
          {needle.figure}
        </span>
      )}
    </p>
  );
}

/**
 * One arrow and the band the direction moved through while the sun was up.
 *
 * A bare arrow on a day the wind swung through 200 degrees would state a
 * direction the day did not have. Measured across the committed run, two days
 * of seven have a daylight spread past 170 degrees and four sit at 40 or less,
 * so the two cases look completely different — which is the point.
 * `bearing.ts` computes the spread; this draws it.
 */
function Glyph({ needle }: { needle: CompassNeedle }) {
  const style = GLYPHS[needle.kind];
  const tail = at(needle.fromDegT, ARM);
  const head = at(needle.fromDegT + 180, ARM);

  /*
    The two barbs of the arrowhead, set back along the shaft and out to either
    side. Built from the same `at` conversion rather than from a rotation
    matrix, so there is one place in this file that knows which way north is.

    The head is two and a half times as long as it is wide across. Set back by
    less it draws an obtuse blob rather than an arrow, which is what the swell's
    needle did once its shaft was shortened -- reviewed on the built page and
    called tacky, correctly. A long, narrow head reads as a direction; a squat
    one reads as a shape.
  */
  const barbBack = at(needle.fromDegT + 180, ARM - style.barb * 2.2);
  const across = {
    x: (tail.y - head.y) / (2 * ARM),
    y: (head.x - tail.x) / (2 * ARM),
  };
  const point = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
  const barbs = [
    point(
      barbBack.x + across.x * style.barb,
      barbBack.y + across.y * style.barb,
    ),
    point(head.x, head.y),
    point(
      barbBack.x - across.x * style.barb,
      barbBack.y - across.y * style.barb,
    ),
  ].join(" ");

  const half = GLYPH_UNITS / 2;

  return (
    <svg
      viewBox={`${-half} ${-half} ${GLYPH_UNITS} ${GLYPH_UNITS}`}
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
      data-readout-glyph={needle.kind}
    >
      {needle.swing !== null && needle.swing.spreadDeg > 0 && (
        <Wedge kind={needle.kind} swing={needle.swing} />
      )}

      <line
        x1={Number(tail.x.toFixed(2))}
        y1={Number(tail.y.toFixed(2))}
        x2={Number(head.x.toFixed(2))}
        y2={Number(head.y.toFixed(2))}
        className={style.stroke}
        strokeWidth={style.width}
        strokeLinecap="round"
        data-arrow={needle.kind}
      />

      {style.solid ? (
        <polygon
          points={barbs}
          className={style.fill}
          data-arrow-head={needle.kind}
        />
      ) : (
        <polyline
          points={barbs}
          fill="none"
          className={style.stroke}
          strokeWidth={style.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-arrow-head={needle.kind}
        />
      )}
    </svg>
  );
}

/**
 * The band the direction moved through while the sun was up, as a filled cone.
 *
 * Behind the arrow's tail rather than around the whole glyph, because the
 * spread is a range of directions the weather came *from* and the tail is where
 * that is read. A settled day draws a splinter and an unsettled one draws most
 * of a disc, and the difference is legible at 16px in a way an arc on a ring is
 * not.
 */
function Wedge({
  kind,
  swing,
}: {
  kind: CompassNeedleKind;
  swing: { fromDegT: number; spreadDeg: number };
}) {
  const { fill, wedgeOpacity } = GLYPHS[kind];
  const half = swing.spreadDeg / 2;
  const from = at(swing.fromDegT - half, WEDGE_RADIUS);
  const to = at(swing.fromDegT + half, WEDGE_RADIUS);

  /*
    Which of the two arcs between the endpoints is meant. Without the flag a
    200-degree swing draws as the 160-degree one on the other side of the
    glyph, which is not merely wrong but the opposite claim.

    The sweep flag is 1 because bearings increase clockwise and, in a space
    where y grows downward, a positive sweep is clockwise on screen.
  */
  const largeArc = swing.spreadDeg > 180 ? 1 : 0;

  return (
    <path
      d={
        `M0 0 L${from.x.toFixed(2)} ${from.y.toFixed(2)} ` +
        `A ${WEDGE_RADIUS} ${WEDGE_RADIUS} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)} Z`
      }
      className={fill}
      fillOpacity={wedgeOpacity}
      data-wedge={kind}
    />
  );
}

/**
 * Where each row's figures came from, printed beneath the picture.
 *
 * **Attribution and nothing else, which is what the readout being HTML buys.**
 * This block used to restate both bearings in words and degrees, because the
 * `<svg>` is one `role="img"` and nothing drawn inside it reaches the
 * accessibility tree, so the dial needed a text equivalent and this was it. The
 * readout is in that tree and is its own equivalent, so the sentence was a
 * second statement of a figure the page already made — and one place saying the
 * numbers and one saying where they came from is the arrangement that leaves.
 *
 * **The label is doing the work the sentence used to.** Two provenance lines
 * under one picture have to say which is which, and that is what
 * `ProvenanceLine.label` is for. It also carries the superlative, which
 * `WaveWeek` records is not optional: a single figure under the bare word
 * "Swell" invites a reader to take it for the day's typical swell, "which is
 * the one thing it is not". Both are the caller's words.
 *
 * One provenance line per needle, which is `WeekGrid`'s resolution rather than
 * `StatGroup`'s contract: one instrument carrying two publishers is a
 * deliberate break of one-group-one-source, answered by attributing each row
 * (ADR-0032).
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
          <ProvenanceLine {...needle.provenance} surface="page" />
        </li>
      ))}
    </ul>
  );
}
