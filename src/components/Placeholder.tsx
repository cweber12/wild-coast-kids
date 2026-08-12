type PlaceholderProps = {
  /** Describes the future image; doubles as the accessible name. */
  label: string;
  /** Background fills drop the dashed frame and the visible label. */
  background?: boolean;
  className?: string;
  labelClassName?: string;
};

/**
 * Labeled stand-in for every image slot (logo, hero photo, card backgrounds,
 * gallery strip). Real photography replaces these in a later content pass —
 * swapping one for an <img> keeps the same accessible name.
 */
export function Placeholder({
  label,
  background = false,
  className = "",
  labelClassName = "",
}: PlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`bg-[linear-gradient(135deg,rgb(107_95_170/0.12),rgb(26_78_138/0.1))] ${
        background ? "" : "border-[1.5px] border-dashed border-purple/38"
      } ${className}`}
    >
      {!background && (
        <span
          aria-hidden="true"
          className={`flex size-full min-h-12 items-center justify-center p-3 text-center text-2xs font-extrabold tracking-[0.08em] uppercase text-dark/50 ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
