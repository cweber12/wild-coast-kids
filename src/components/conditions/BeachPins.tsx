/**
 * The beaches an area holds, named and clickable, laid over its map.
 *
 * **HTML over the SVG, not text inside it**, and that is the finding the whole
 * component rests on. `ShoreMap`'s viewBox is `0 0 100 100` and scales to
 * whatever width its column has, so anything drawn inside it scales with the
 * picture: a label would be a different size on every breakpoint and a tap
 * target could not be expressed in CSS pixels at all. Positioned anchors give
 * real pixels, real focus rings and real hit areas — and because the plot
 * coordinates are already 0–100, they are percentages for free.
 *
 * **Two placements, one object.** A pin is an emoji and a name, and where that
 * pair can sit beside the beach it does. Where an area's beaches are too close
 * for their labels to share the frame, the pair moves out to a column at the
 * edge and a leader line joins it to a dot on the coast. `inlineFits` decides
 * which, per area, from the geometry rather than from a guess about the area.
 *
 * **The placement is per area and never per beach.** A picture with some names
 * beside their beaches and others carried out to the side reads as two
 * conventions at once, and a reader has to work out which applies to the mark
 * they are looking at. One frame, one convention. Which *side* of its pin a
 * name sits on is a different question, and is answered per pin — see
 * `Inline`.
 *
 * See ADR-0053, which supersedes ADR-0052's ticks and carries the measurements.
 */

import type { CSSProperties } from "react";

import type { PlotPoint } from "@/lib/coastline";

/** One beach to draw, already projected into the map's own 0–100 plot units. */
export type PinnedBeach = {
  name: string;
  href: string;
  at: PlotPoint;
};

/**
 * The glyph every pin carries.
 *
 * **It renders in the visitor's own font, not in one this repo ships**, so a
 * screenshot only ever proves what one operating system does with it. That is
 * a property of every emoji on this site and is why the pin is never the only
 * thing saying which beach this is: the name is beside it in both placements.
 */
const PIN = "🏖️";

/**
 * The room one label needs, in plot units, and therefore the gap two marks need
 * before both can be labelled where they stand.
 *
 * **Derived from the narrowest map rather than from the review viewport.** A
 * label is `text-2xs` on `leading-tight`, about 13px tall, and the map column
 * measures 472px at 1536×639 but **342px on a 390px phone**. The same label is
 * 2.75 plot units of the first and 3.80 of the second, so a threshold chosen on
 * a desktop would let labels overlap on a phone. This is the phone's figure,
 * rounded up.
 *
 * **The partition it produces has a wide margin either side of it.** Measured
 * over the twelve areas holding more than one beach, the tightest vertical gap
 * between two marks is 0.28, 0.38 and 0.47 units on Mission Bay – North,
 * Mission Bay – West and La Jolla, and 6.38 units on the next area after them.
 * Any threshold between about 0.5 and 6.3 sorts them the same way, so this
 * number is not balanced on a knife edge — it earns its place by meaning
 * something rather than by being tuned.
 */
const LABEL_ROW_UNITS = 4;

/**
 * How far apart the column's rows sit, in plot units.
 *
 * A second number rather than a reuse of `LABEL_ROW_UNITS`, because it measures
 * a second thing. That one is the height of a *label*, which is what decides
 * whether two names can share a picture. This is the height of a whole
 * **anchor** — 24px, because it holds the glyph — and the column stacks
 * anchors, not labels. Deriving it from the label was the first attempt and it
 * put the rows 5.5 units apart, which is 26px on the review viewport and looked
 * right there: measured on a phone the same rows were 18.8px apart around a
 * 24px anchor, so every pair in the column **overlapped by 5.2px**, and at 320px
 * by 9px. Overlapping anchors are the one failure this whole placement exists
 * to prevent.
 *
 * So it is taken at the narrowest map the site supports rather than at the
 * widest. WCAG 1.4.10 puts that at a 320px viewport, where the map column is
 * 272px and a 24px anchor is 8.8 units. 9.5 leaves air at that width and still
 * seats the largest area's ten rows: the last sits at 90.5 and ends at 95.
 */
const COLUMN_PITCH_UNITS = 9.5;

/** How far the column's anchors sit from the frame's side, in plot units. */
const COLUMN_INSET_UNITS = 2;

/**
 * Whether every label can sit beside its own beach.
 *
 * **The test is vertical separation, not distance.** A label is a horizontal
 * box on its pin's own row, so two labels collide when their marks share a row
 * however far apart they are across the frame — which is exactly the case the
 * bays produce. Mission Bay – North's closest pair is 31px apart on screen and
 * would pass any distance test; its marks sit 0.28 units apart vertically,
 * because they are on opposite shores of the same water at the same latitude.
 *
 * Exported for its test, which runs it over the committed areas.
 */
export function inlineFits(marks: readonly PinnedBeach[]): boolean {
  const rows = marks.map((mark) => mark.at.y).sort((a, b) => a - b);

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index] - rows[index - 1] < LABEL_ROW_UNITS) return false;
  }
  return true;
}

/**
 * Which side of the frame has the room, from where the marks already are.
 *
 * Taken from the marks and not from `seawardFrom`. The frame is squared toward
 * the sea, so the slack is on the water's side and that direction is the right
 * answer — but `seawardFrom` reads a run's two ends, and on a bay, which is
 * where the column is needed, those two ends are a chord across the water and
 * the direction they give is about nothing. Where the marks are not is a fact
 * about the picture being drawn, and it is true on an open coast and in a bay
 * alike.
 */
function columnSide(marks: readonly PinnedBeach[]): "left" | "right" {
  const meanX =
    marks.reduce((total, mark) => total + mark.at.x, 0) / marks.length;
  return meanX > 50 ? "left" : "right";
}

/**
 * Where each anchor sits in the column, in plot units, top to bottom.
 *
 * **Three steps, and each earns its place by a case the one before it fails.**
 *
 * A row would rather sit at its own beach's height, so a reader can match the
 * column against the coast without following a line. So the first pass takes
 * each beach's own row and pushes it down only as far as clearing the one above
 * it requires.
 *
 * That can walk off the bottom, because a stack that starts low ends lower. So
 * the second lifts the whole block back up -- and lifts it, rather than
 * squeezing it, because even rows are what let the order be read at a glance.
 *
 * The lift is capped at what the top edge allows, which is the step the first
 * draft was missing: La Jolla's northernmost beach sits 20 units above the
 * cluster, so the stack spanned 95 units of an available 90 and the correction
 * carried `la-jolla-shores-beach` clean off the top of the frame. Where the
 * capped lift still leaves the last row low, the rows cannot all keep their own
 * heights, and the third step spaces them evenly across the frame instead --
 * which always fits, because an even pitch over the available height is at
 * least `COLUMN_PITCH_UNITS` for every area in the inventory.
 */
function columnRows(sorted: readonly PinnedBeach[]): number[] {
  // Rows are centred on their own y, so the first and last need half an anchor
  // of headroom or the stack is clipped by the frame it sits in.
  const half = COLUMN_PITCH_UNITS / 2;
  const top = half;
  const bottom = 100 - half;

  const rows: number[] = [];
  for (const [index, mark] of sorted.entries()) {
    const floor = index === 0 ? top : rows[index - 1] + COLUMN_PITCH_UNITS;
    rows.push(Math.max(mark.at.y, floor));
  }

  const last = rows[rows.length - 1];
  if (last <= bottom) return rows;

  const lift = Math.min(last - bottom, rows[0] - top);
  const lifted = rows.map((row) => row - lift);
  if (lifted[lifted.length - 1] <= bottom) return lifted;

  const pitch = (bottom - top) / Math.max(1, sorted.length - 1);
  return sorted.map((_, index) => top + index * pitch);
}

/**
 * The anchor itself: the glyph and the name, one control, in both placements.
 *
 * **`pill` decides how much of it is opaque, and that is a placement question
 * rather than a decorative one.** Beside its beach, only the name needs a
 * ground to be read against, and the glyph sits directly on the coastline it is
 * pointing at — a white box there would hide the one spot the pin exists to
 * indicate. Out in the column there is a leader line running in from the coast,
 * and the whole anchor is opaque so the line stops cleanly at its edge instead
 * of showing through the gaps in a glyph.
 */
function PinLink({
  beach,
  pill,
  className,
  style,
}: {
  beach: PinnedBeach;
  pill: boolean;
  className: string;
  style: CSSProperties;
}) {
  return (
    <a
      href={beach.href}
      data-pin=""
      className={`text-dark focus-visible:outline-ocean group absolute flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 ${pill ? "bg-white/90 pr-1" : ""} ${className}`}
      style={style}
    >
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center text-[15px] leading-none"
      >
        {PIN}
      </span>
      <span
        className={`text-2xs leading-tight font-semibold whitespace-nowrap underline-offset-2 group-hover:underline ${pill ? "" : "rounded bg-white/90 px-1"}`}
      >
        {beach.name}
      </span>
    </a>
  );
}

/**
 * Every beach labelled where it stands, which is nine of the twelve areas.
 *
 * The anchor is the pin and the name together, so the whole object is the
 * target rather than the glyph alone, and it is centred on the beach so the
 * glyph sits where the beach is rather than beside it.
 *
 * **Each name takes whichever side of its own pin has more frame**, which is
 * the one thing here decided per beach rather than per picture. It is not a
 * second convention — the name is beside its pin either way — and the
 * alternative was measured rather than argued: one side for the whole picture
 * ran `coronado-north-beach` off the left edge, its name being about 200px of
 * a 472px frame with its pin a quarter of the way across. Growing into the
 * larger half cannot overflow while a name is shorter than half the frame,
 * which every name on an inline area is.
 */
function Inline({ marks }: { marks: readonly PinnedBeach[] }) {
  return (
    <>
      {marks.map((beach) => {
        const toLeft = beach.at.x > 50;
        return (
          <PinLink
            key={beach.href}
            beach={beach}
            pill={false}
            className={`-translate-y-1/2 ${toLeft ? "flex-row-reverse" : "flex-row"}`}
            style={{
              top: `${beach.at.y}%`,
              maxWidth: "50%",
              ...(toLeft
                ? { right: `${100 - beach.at.x}%`, marginRight: "-12px" }
                : { left: `${beach.at.x}%`, marginLeft: "-12px" }),
            }}
          />
        );
      })}
    </>
  );
}

/**
 * The names carried out to a column, which is the three crowded areas.
 *
 * **A dot on the coast rather than an emoji.** Ten glyphs at fifteen pixels
 * inside a cluster 15px tall is a smear that says less than one small mark
 * does, and the emoji is not lost — it travels with the name to the column,
 * where the pair is the same object it is on the other nine areas.
 *
 * **The dot is not a link, and that is the one place this design refuses the
 * obvious.** La Jolla's marks sit about 4.5px apart at the review viewport, so
 * overlapping targets there would not merely be small — a click would land on
 * whichever of two beaches happened to be painted on top, silently and
 * unpredictably. A control that navigates somewhere a reader did not choose is
 * worse than a mark that does not navigate at all, so the dot is drawn
 * `aria-hidden` and inert and the labelled anchor at the end of its leader line
 * is the control.
 */
function Column({ marks }: { marks: readonly PinnedBeach[] }) {
  const side = columnSide(marks);
  const sorted = [...marks].sort((a, b) => a.at.y - b.at.y);
  const rows = columnRows(sorted);
  const anchorX =
    side === "left" ? COLUMN_INSET_UNITS : 100 - COLUMN_INSET_UNITS;

  return (
    <>
      {/*
        The leaders and the dots, under the anchors rather than over them.

        Each line runs from its beach's dot to the column's own inset, which is
        exactly where that beach's anchor begins — and the anchor is opaque
        there, so the line arrives at its edge and stops. Ending it any later
        would mean knowing how wide the name is, and the names running from 76
        to 199px makes that a question only the browser can answer.
      */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {sorted.map((beach, index) => (
          <line
            key={beach.href}
            x1={beach.at.x}
            y1={beach.at.y}
            x2={anchorX}
            y2={rows[index]}
            className="stroke-purple-deep/40"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            data-leader=""
          />
        ))}
        {sorted.map((beach) => (
          <circle
            key={beach.href}
            cx={beach.at.x}
            cy={beach.at.y}
            r={1}
            className="fill-purple-deep"
            data-dot=""
          />
        ))}
      </svg>

      {sorted.map((beach, index) => (
        <PinLink
          key={beach.href}
          beach={beach}
          pill
          className={
            side === "left"
              ? "-translate-y-1/2 flex-row"
              : "-translate-y-1/2 flex-row-reverse"
          }
          style={{
            top: `${rows[index]}%`,
            maxWidth: "46%",
            ...(side === "left"
              ? { left: `${COLUMN_INSET_UNITS}%` }
              : { right: `${COLUMN_INSET_UNITS}%` }),
          }}
        />
      ))}
    </>
  );
}

/**
 * The layer itself, which renders nothing at all on a beach map.
 *
 * A beach page has one subject and draws it as a heavy run, so it hands this no
 * marks and gets no pins — the same condition `ShoreMap` has always applied to
 * the marks it used to draw itself.
 */
export function BeachPins({ marks }: { marks: readonly PinnedBeach[] }) {
  if (marks.length === 0) return null;

  return inlineFits(marks) ? (
    <Inline marks={marks} />
  ) : (
    <Column marks={marks} />
  );
}
