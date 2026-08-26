type ReservedSlotProps = {
  /** Sets the mood of the slot; hidden from assistive tech. */
  emoji: string;
  /** Names what is coming, e.g. "Online booking coming soon." */
  headline: string;
  /** One sentence on what will land here when it does. */
  detail: string;
  /** `ocean` for slots sitting on the ocean-blue section; `light` elsewhere. */
  tone?: "light" | "ocean";
  /** How much room the slot holds open. The list is closed on purpose. */
  density?: "section" | "row";
};

const TONES = {
  light: {
    frame: "border-lavender bg-white/60",
    text: "text-fog",
  },
  ocean: {
    frame: "border-white/20 bg-white/7",
    text: "text-white/45",
  },
};

/**
 * How much vertical room a slot takes, which follows from what it stands in
 * for rather than from a style preference.
 *
 * `section` is the original and stays the default. `px-8 py-12` with a 48px
 * glyph is right for a slot holding open a whole section — a schedule, a
 * scheduler embed, the conditions tool — and it is what five of the six call
 * sites want, so none of them changes.
 *
 * `row` is for a slot standing in for one row of a grid that already exists
 * around it. At section density the week's three reserved forecasts measured
 * 244px against 128px of live week above them: three dashed boxes physically
 * larger than the seven days they annotate, and 21% of the page given to
 * products that do not exist yet. Nothing about the copy or the frame was
 * wrong. The padding and the glyph were sized for a different job, and reusing
 * them unchanged in a small space is the one place this component's reuse cost
 * something.
 */
const DENSITIES = {
  section: { room: "px-8 py-12", glyph: "mb-3.5 text-5xl" },
  row: { room: "px-5 py-5", glyph: "mb-2 text-2xl" },
};

/**
 * A labeled stand-in for content that is decided but not yet built — a
 * schedule, a scheduler embed, the conditions tool.
 *
 * The copy arrives as props rather than children on purpose: the blank line
 * between the headline and the detail is part of the shape, and it is
 * exactly what drifted while six call sites each wrote their own.
 *
 * Two closed lists and no third axis. Tone picks the surface; density picks
 * how much room the slot holds open. Neither takes a className, for the reason
 * `PillLink` gives about its own tones: an escape hatch puts geometry back in
 * the interface, which is what left the call sites writing their own in the
 * first place.
 */
export function ReservedSlot({
  emoji,
  headline,
  detail,
  tone = "light",
  density = "section",
}: ReservedSlotProps) {
  const { frame, text } = TONES[tone];
  const { room, glyph } = DENSITIES[density];

  return (
    <div
      className={`rounded-box border-2 border-dashed text-center ${room} ${frame}`}
    >
      <span aria-hidden="true" className={`block ${glyph}`}>
        {emoji}
      </span>
      <p className={`leading-normal text-sm ${text}`}>
        {headline}
        <br />
        <br />
        {detail}
      </p>
    </div>
  );
}
