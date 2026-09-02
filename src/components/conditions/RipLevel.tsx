/**
 * Today's rip current level, in one line, beside the beach chooser.
 *
 * **A summary, never the statement.** `SurfZone` in the day panel is the
 * statement: the level, the office's own gloss for it, the surf and water
 * ranges the level rests on, the period's name and the attribution. This is one
 * word from it, at the top of the page, so a reader who came to decide whether
 * to take children into the water gets the relayed judgement before they get
 * anything to interpret. Nothing here is reworded and nothing here is computed
 * -- the word is the office's, picked out of the same read.
 *
 * **It sits beside the chooser rather than inside the measured block, and that
 * is ADR-0009 as a layout.** The band under this row is what the instruments
 * read; this is a forecaster's judgement relayed. Putting a judgement inside a
 * block whose whole claim is "these are measurements" is the blur that ADR
 * exists to prevent -- and the standing notice one column over says in as many
 * words that the numbers are not a safety assessment, which only means anything
 * while the two are visibly different kinds of thing.
 *
 * **No colour by level, at any of the three.** ADR-0015: a surface on this page
 * is decoration and not a verdict, because ADR-0009 forbids this site the
 * verdict. A three-step palette here would be this site deciding what red means
 * on top of a scale the office already publishes in words. The level is set in
 * the same weight and size whether it says Low or High, and the test asserts
 * that the classes do not vary.
 *
 * **The absence wording is the part to be careful with, and it has a trap in
 * it.** `SurfZone`'s docstring records the trap and this line walks into it
 * harder, being shorter: the obvious value for a beach the bulletin does not
 * cover is "none forecast", and after a label reading RIP CURRENT RISK that
 * parses as *there is no rip current risk here* -- a safety judgement this site
 * is forbidden to make, and worst at exactly the beaches that reach it, because
 * a lagoon is calm until the day it is not.
 *
 * So the absent value says nothing about the water at all. It points at the
 * block that does the careful version, which is on the page in every one of
 * these states and words each of them properly. That keeps this line honest
 * without making it long, and it is why the value here is never a phrase about
 * risk.
 */

import { readDaylightWeek, readSurfZone } from "@/lib/conditions";

/** The label, and the value beside it. One line, `items-baseline`. */
function Line({ value }: { value: string }) {
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-2xs font-extrabold tracking-widest text-ocean uppercase">
        Rip current risk
      </span>
      {/*
        One class string for every value, which is ADR-0015 in the markup: the
        level is emphasised by weight and never by colour, so `High` and `Low`
        are set identically and the difference a reader sees is the word.
      */}
      <span className="text-base font-black text-dark">{value}</span>
    </p>
  );
}

export async function RipLevel({ slug }: { slug: string }) {
  // Both reads are `next.revalidate` fetches the day panel already makes, so
  // the Data Cache serves them and this costs no upstream request. The daylight
  // read is computed rather than fetched and cannot fail at all; it is here
  // because the bulletin dates its days and only that read knows which one is
  // today.
  const [surfZone, daylight] = await Promise.all([
    readSurfZone(slug),
    Promise.resolve(readDaylightWeek(slug)),
  ]);

  const today = daylight.days.find((day) => day.isToday)?.localDate;

  const level =
    surfZone.state.kind === "forecast" && today !== undefined
      ? (surfZone.state.days.find((day) => day.localDate === today)?.level ??
        null)
      : null;

  // See the docstring: not "none forecast", which reads as a verdict about the
  // water. The day panel's block is present in every state this reaches and
  // words each one properly, so the value points there rather than paraphrasing
  // it badly in three words.
  return <Line value={level ?? "See the day below"} />;
}
