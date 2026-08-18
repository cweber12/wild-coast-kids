/**
 * Local time for the corridor this site covers.
 *
 * Every upstream product here publishes on some other clock -- NOAA CO-OPS is
 * asked for GMT precisely because its timestamps carry no offset, so a caller
 * that asked for local time and tagged the result UTC would age every reading by
 * seven or eight hours. Converting to a wall clock is therefore a display
 * concern, and it happens here, once, against a named zone rather than against
 * whatever zone the server happens to run in.
 *
 * `Intl` is the whole implementation on purpose. It carries the daylight-saving
 * rules, which is the part nobody should hand-roll.
 */

/** The zone every time on this site is displayed in. */
export const SITE_TIME_ZONE = "America/Los_Angeles";

/**
 * The calendar date an instant falls on, in `timeZone`, as `YYYY-MM-DD`.
 *
 * `en-CA` is used for its format rather than for its locale: it yields
 * ISO-ordered parts, so no reassembly is needed and no month/day ambiguity can
 * creep in.
 */
export function localDateOf(
  atMs: number,
  timeZone: string = SITE_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(atMs));
}

/**
 * The wall-clock time an instant falls on, in `timeZone`, as `6:24 AM`.
 *
 * Twelve-hour with a meridiem, because the reader is a parent deciding when to
 * leave the house rather than someone reading a tide table.
 */
export function localTimeOf(
  atMs: number,
  timeZone: string = SITE_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(atMs));
}

/**
 * The calendar day an instant falls on, in `timeZone`, as `Tue, Sep 8`.
 *
 * Weekday included because the co-op's whole identity is which day of the week
 * it meets, and a reader scanning a term of Tuesdays should be able to see one
 * that is not a Tuesday. No year: the schedule only ever lists sessions still
 * to come, so the year is either this one or obvious from context.
 */
export function localDayOf(
  atMs: number,
  timeZone: string = SITE_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(atMs));
}
