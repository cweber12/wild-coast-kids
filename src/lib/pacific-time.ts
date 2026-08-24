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
 *
 * Which day it is, then what that day is called: the second half is
 * `localDayLabel`, so a caller holding a date rather than an instant names it
 * the same way rather than growing a second format beside this one.
 */
export function localDayOf(
  atMs: number,
  timeZone: string = SITE_TIME_ZONE,
): string {
  return localDayLabel(localDateOf(atMs, timeZone));
}

/** A local calendar date. Deliberately not an instant: it carries no zone. */
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The year, month and day of a `YYYY-MM-DD` string.
 *
 * Throws rather than coercing. These strings are produced by `localDateOf` a
 * few lines up, so a malformed one is a caller's bug, and `Date.parse` on a
 * near-miss would return a plausible instant for the wrong day instead.
 */
function partsOf(localDate: string): [number, number, number] {
  const match = LOCAL_DATE.exec(localDate);
  if (match === null) {
    throw new Error(
      `pacific-time: "${localDate}" is not a YYYY-MM-DD local date.`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * The calendar date `days` after `localDate`, as `YYYY-MM-DD`.
 *
 * The arithmetic happens in UTC on purpose. Adding twenty-four hours to an
 * instant is not the same as adding a day to a date — twice a year on this
 * coast it is twenty-three hours or twenty-five — so a week assembled by adding
 * milliseconds to a clock can repeat a date or skip one, and it does it near
 * local midnight where nobody is looking. UTC has no such transitions and a
 * date carries no zone, so moving the calendar there and reading it straight
 * back is exact.
 */
export function addLocalDays(localDate: string, days: number): string {
  const [year, month, day] = partsOf(localDate);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/**
 * A local date named for a reader, as `Mon, Aug 17`.
 *
 * Formatted in UTC, which is the one zone that cannot move it. A date string
 * read as an instant is midnight UTC, and rendering that midnight anywhere
 * behind Greenwich — this coast included — names the day before. So the
 * calendar value is put back exactly where it was parsed from.
 */
export function localDayLabel(localDate: string): string {
  const [year, month, day] = partsOf(localDate);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
