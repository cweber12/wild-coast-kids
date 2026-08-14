type ReservedSlotProps = {
  /** Sets the mood of the slot; hidden from assistive tech. */
  emoji: string;
  /** Names what is coming, e.g. "Online booking coming soon." */
  headline: string;
  /** One sentence on what will land here when it does. */
  detail: string;
  /** `ocean` for slots sitting on the ocean-blue section; `light` elsewhere. */
  tone?: "light" | "ocean";
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
 * A labeled stand-in for content that is decided but not yet built — a
 * schedule, a scheduler embed, the conditions tool.
 *
 * The copy arrives as props rather than children on purpose: the blank line
 * between the headline and the detail is part of the shape, and it is
 * exactly what drifted while six call sites each wrote their own.
 */
export function ReservedSlot({
  emoji,
  headline,
  detail,
  tone = "light",
}: ReservedSlotProps) {
  const { frame, text } = TONES[tone];

  return (
    <div
      className={`rounded-box border-2 border-dashed px-8 py-12 text-center ${frame}`}
    >
      <span aria-hidden="true" className="mb-3.5 block text-5xl">
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
