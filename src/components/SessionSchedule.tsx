/**
 * A program's upcoming sessions, or the reserved slot that stood there before
 * any existed.
 *
 * Presentational and pure. The fetching happens in the page; this component is
 * handed a result and decides only how it reads. That is what lets both the
 * populated and the empty states be asserted without a database.
 *
 * **Emptiness and failure look the same here, deliberately.** A reader can act
 * on neither, and "coming soon" is true in both cases. The distinction is owed
 * to the operator instead, and the page logs it. This is the one place where
 * this module departs from the conditions panels next door, which must say in
 * words why they cannot answer — a blank tide reading looks like calm water,
 * and a missing schedule looks like a missing schedule.
 */

import { ReservedSlot } from "./ReservedSlot";
import { localDayOf, localTimeOf } from "@/lib/pacific-time";
import type { Program, ScheduleResult, Session } from "@/lib/sessions";

type SessionScheduleProps = {
  result: ScheduleResult;
  /** Decides the accent and the heading's id; the two cannot disagree. */
  program: Program;
  /** The reserved slot to fall back to, in the page's own words. */
  emoji: string;
  headline: string;
  detail: string;
};

/** Each program's own colour, the one its card and its page already use. */
const ACCENTS: Record<Program, string> = {
  art: "text-purple",
  coop: "text-ocean",
};

/**
 * Whole dollars when the price is whole, cents when it is not. `0` is free and
 * says so; `null` means the session is not priced here, which is different, and
 * renders nothing at all.
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/**
 * `Tue, Sep 8 · 10:00 AM – 1:00 PM`, in the site's zone.
 *
 * One line rather than two fields, because a parent reads "when" as a single
 * fact. The end time carries no date even when a session crosses midnight —
 * none does, and inventing a case nobody has costs the common one its brevity.
 */
function when(session: Session): string {
  const startsMs = Date.parse(session.startsAt);
  const endsMs = Date.parse(session.endsAt);
  return `${localDayOf(startsMs)} · ${localTimeOf(startsMs)} – ${localTimeOf(endsMs)}`;
}

export function SessionSchedule({
  result,
  program,
  emoji,
  headline,
  detail,
}: SessionScheduleProps) {
  if (result.kind === "unavailable" || result.sessions.length === 0)
    return <ReservedSlot emoji={emoji} headline={headline} detail={detail} />;

  // The list gets a heading and the reserved slot does not, which is why the
  // two branches differ in shape. Session titles are h3, so without an h2 here
  // the page would step from its h1 straight past a level.
  const headingId = `${program}-schedule-heading`;

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className={`text-2xs mb-3 font-extrabold tracking-widest uppercase ${ACCENTS[program]}`}
      >
        Upcoming sessions
      </h2>
      <ul className="grid gap-3">
        {result.sessions.map((session) => (
          <li
            key={session.id}
            className="rounded-tile border-[1.5px] border-lavender bg-white/60 p-5"
          >
            <p
              className={`text-2xs mb-1.5 font-extrabold tracking-widest uppercase ${ACCENTS[program]}`}
            >
              {when(session)}
            </p>
            <h3 className="leading-display text-lg font-black italic">
              {session.title}
            </h3>
            {session.summary && (
              <p className="leading-relaxed mt-1.5 text-sm text-fog">
                {session.summary}
              </p>
            )}
            {(session.locationName || session.priceCents !== null) && (
              <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fog">
                {session.locationName &&
                  (session.locationUrl ? (
                    <a
                      href={session.locationUrl}
                      className="underline decoration-lavender underline-offset-2 transition-colors duration-fast hover:text-dark"
                      // The row is written by hand in Supabase Studio and can point
                      // anywhere, so the tab it opens gets no handle on this one.
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {session.locationName}
                    </a>
                  ) : (
                    <span>{session.locationName}</span>
                  ))}
                {session.priceCents !== null && (
                  <span className="font-bold">
                    {formatPrice(session.priceCents)}
                  </span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
