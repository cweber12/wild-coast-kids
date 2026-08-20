/**
 * The date to stamp on a data file, for the seeding scripts next door.
 *
 * One date function and nothing else. It lives on its own because two scripts
 * write a `generated` field now -- the beach inventory and the station probe --
 * and a date filed under either of them would be copied by whoever was writing
 * the other. That copy is what this file exists to prevent: `seed-beaches.mjs`
 * stamped UTC for months while `probe-observation-stations.mjs` stamped
 * Pacific, so the sibling tables disagreed by a day (issue #85).
 *
 * `src/lib/pacific-time.ts` is the same idea for the site, and is deliberately
 * not imported here: these scripts run under node unbuilt, so they cannot read
 * TypeScript. The zone is spelled the same in both places on purpose.
 */

/** The zone the data files describe, and declare in their own `time_zone`. */
const DATA_TIME_ZONE = "America/Los_Angeles";

/**
 * The calendar date an instant falls on where the beaches are, as `YYYY-MM-DD`.
 *
 * `new Date().toISOString().slice(0, 10)` gives the UTC date, so any run after
 * 5pm Pacific stamps tomorrow: the file claims to have been generated on a day
 * that has not started in the county it describes.
 *
 * `en-CA` is used for its format rather than its locale -- it yields
 * ISO-ordered parts, so nothing has to be reassembled and no month/day
 * ambiguity can creep in. `Intl` carries the daylight-saving rules, which is
 * the part nobody should hand-roll.
 *
 * @param {Date} now
 * @returns {string}
 */
export function generatedDate(now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DATA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
