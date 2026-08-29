/**
 * Which day of the week the page is showing, shared between the two regions
 * that disagree about it otherwise.
 *
 * **Two server regions, one client fact.** `WeekPanel` and `DayPanel` are
 * separate async components in separate suspense boundaries, and they stay
 * that way: five agencies go quiet independently and none may hold up another.
 * What they now share is a choice, which is a client fact, so it lives in a
 * provider that wraps both of them as children. A server component passed as
 * `children` to a client component is still rendered on the server -- the
 * provider never sees the reads, only the markup they produced.
 *
 * **Null means "the first day", and nothing here reads a clock.** A default of
 * `todayDate` would need somebody to work out what today is, and the only
 * honest place to do that is `conditions.ts`, which both regions already ask.
 * So the state starts as null and each consumer resolves it against its own
 * first column. Both build their days from `weekOfDays`, so both first columns
 * are today, and the two cannot disagree even before anything is chosen. It
 * also means the server render and the first client render agree by
 * construction, which is what keeps hydration quiet.
 *
 * **The day never enters the URL, and that is a cost this design accepted.**
 * `docs/plans/conditions-day-view.md` rejected deep-linking a day on the
 * measurement: `searchParams` makes the route dynamic, which forfeits
 * `revalidate = 900` and the empty `generateStaticParams` that together keep
 * upstream load proportional to real readers rather than to builds. What is
 * lost is a shareable link to Tuesday; what is kept is a static page.
 */

"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SelectedDay = {
  /** `YYYY-MM-DD` in Pacific, or null for "whatever the first day is". */
  selected: string | null;
  choose: (localDate: string) => void;
};

/**
 * The default is the null state rather than a throw, deliberately.
 *
 * A region rendered outside the provider shows its first day and offers no
 * choice, which is exactly the state a reader without JavaScript is in. Making
 * it an error instead would turn a degraded page into a blank one.
 */
const SelectedDayContext = createContext<SelectedDay>({
  selected: null,
  choose: () => {},
});

export function SelectedDayProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <SelectedDayContext value={{ selected, choose: setSelected }}>
      {children}
    </SelectedDayContext>
  );
}

export function useSelectedDay(): SelectedDay {
  return useContext(SelectedDayContext);
}

/**
 * The chosen date, or the first of the days on offer.
 *
 * One function rather than `selected ?? days[0]` written twice, because the
 * two regions resolving the default differently is the exact failure this
 * whole file exists to prevent -- and it would only show up on the first render
 * of a page nobody had clicked yet.
 */
export function resolveSelected(
  selected: string | null,
  dates: readonly string[],
): string | undefined {
  if (selected !== null && dates.includes(selected)) return selected;
  return dates[0];
}
