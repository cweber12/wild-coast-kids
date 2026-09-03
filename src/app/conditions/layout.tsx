import { SelectedDayProvider } from "@/components/conditions/selectedDay";

/**
 * Everything under `/conditions` shares one chosen day.
 *
 * The provider was inside `ConditionsSection` until the tool grew a second
 * route. A layout is the only thing App Router keeps mounted across a
 * navigation between sibling pages, so with it there the chosen day survived
 * exactly as long as the reader stayed on one URL — and moving from an area to
 * one of its beaches, which is now an ordinary thing to do, silently put them
 * back on today.
 *
 * ADR-0035's argument is that keeping a choice is how one hour is compared from
 * day to day. The same argument applies to comparing one day from beach to
 * beach, and this is where it has to live for that to be true.
 *
 * **The selected hour does not survive the same move, and that is not an
 * oversight.** `SelectedHourProvider` takes a `currentHour` computed from the
 * chosen beach's own daylight read, and `selectedHour.tsx` says in as many
 * words that the hour must come "from the read that knows which day is today,
 * never from a clock read here". A layout does not know which beach is being
 * rendered, so hoisting that provider here would mean either threading a
 * server value through a boundary that has no access to it, or putting a second
 * clock on the page — which is the thing that file forbids. So the hour resets
 * to now on a navigation, which is where it starts anyway. See ADR-0047.
 *
 * A layout and not a template: a template remounts per navigation, which is
 * precisely the behaviour this exists to stop.
 */
export default function ConditionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SelectedDayProvider>{children}</SelectedDayProvider>;
}
