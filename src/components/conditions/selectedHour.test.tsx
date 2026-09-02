/**
 * The hour the page is showing, asserted at the seam that owns it.
 *
 * Neither component owns this behaviour. The chart offers the choice, the
 * default comes from a read neither of them makes, and the readout on the map
 * answers the same fact in a second region. `selectedDay.test.tsx` made the
 * same argument for the day and this follows it: render the real components
 * inside the real provider, rather than testing each half against a mock of
 * the other and proving nothing about the pair.
 *
 * **The day is here too, because the two selections interact.** A chosen hour
 * has to survive a change of day, and that is a claim about both providers
 * nested the way `DayPanel` nests them.
 */

import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { localMidnightOf } from "@/lib/pacific-time";
import { ChosenDay, type DayView } from "./ChosenDay";
import { DayCompass, type CompassDay } from "./DayCompass";
import { SelectedDayProvider } from "./selectedDay";
import { hourOfDay } from "./dayFrame";
import { SelectedHourProvider, resolveHour } from "./selectedHour";
import { WeekGrid, type WeekDay, type WeekRow } from "./WeekGrid";
import type { SparkPoint } from "./DaySpark";

const HOUR = 3_600_000;
const DATES = ["2026-08-17", "2026-08-18", "2026-08-19"];

const DAYS: WeekDay[] = DATES.map((localDate, index) => ({
  localDate,
  dayLabel: ["Mon, Aug 17", "Tue, Aug 18", "Wed, Aug 19"][index],
  dateLabel: ["Aug 17", "Aug 18", "Aug 19"][index],
  isToday: index === 0,
}));

const TIDE_ROW: WeekRow = {
  label: "Lowest tide",
  cells: Object.fromEntries(DATES.map((date) => [date, "6:41 PM"])),
};

/**
 * A curve whose value encodes the day and the hour it belongs to.
 *
 * The readout prints the value, so an assertion on the readout's text is an
 * assertion about *which day's* hour is drawn -- which is the thing that can go
 * wrong when one value is resolved against seven frames.
 */
function points(dayIndex: number, hours = 24): SparkPoint[] {
  return Array.from({ length: hours }, (_, hour) => ({
    atMs: localMidnightOf(DATES[dayIndex]) + hour * HOUR,
    value: dayIndex * 100 + hour,
    published: true,
  }));
}

function dayView(index: number, tideHours = 24): DayView {
  const localDate = DATES[index];
  const isToday = index === 0;
  const startMs = localMidnightOf(localDate);
  return {
    localDate,
    dayName: isToday ? "Today" : DAYS[index].dayLabel,
    chartWhen: isToday ? "today" : `on ${DAYS[index].dayLabel}`,
    startMs,
    endMs: startMs + 24 * HOUR,
    sunriseMs: startMs + 6 * HOUR,
    sunsetMs: startMs + 19 * HOUR,
    nowMs: isToday ? startMs + 14 * HOUR : null,
    cloud: [],
    series: [
      {
        key: "tide",
        label: "Tide",
        unitLabel: "ft",
        decimals: 1,
        points: points(index, tideHours),
        description: `Tide on ${localDate}`,
        absence: "No tide series.",
        provenance: null,
      },
      {
        key: "swell",
        label: "Swell",
        unitLabel: "ft",
        decimals: 1,
        points: points(index),
        description: `Swell on ${localDate}`,
        absence: "No swell series.",
        provenance: null,
      },
    ],
    wording: <p>Words for {localDate}</p>,
    // A stand-in: what these tests assert is the day selection, not this block.
    surfZone: <p>Rip current risk on {localDate}</p>,
    measured: <p>Measured on {localDate}</p>,
  };
}

/**
 * The readout on the map, for the two hours these tests move between.
 *
 * Its bearings encode the hour rather than the day, which is the opposite of
 * `selectedDay.test.tsx`'s fixture and for the mirrored reason: what can go
 * wrong here is the map answering a different hour than the chart.
 */
const COMPASS_DAYS: CompassDay[] = DATES.map((localDate) => ({
  localDate,
  hours: [
    {
      hour: 9,
      caption: "9 AM",
      needles: [
        {
          kind: "wind",
          label: "Wind",
          fromDegT: 90,
          swing: { fromDegT: 90, spreadDeg: 20 },
          figure: "9.0 mph",
          provenance: {
            label: "Biggest wind in daylight, 14.0 mph at 6:00 PM",
            source: "this beach's own grid cell",
            network: "National Weather Service, San Diego",
          },
        },
      ],
    },
    {
      hour: 14,
      caption: "2 PM",
      needles: [
        {
          kind: "wind",
          label: "Wind",
          fromDegT: 270,
          swing: { fromDegT: 270, spreadDeg: 20 },
          figure: "14.0 mph",
          provenance: {
            label: "Biggest wind in daylight, 14.0 mph at 6:00 PM",
            source: "this beach's own grid cell",
            network: "National Weather Service, San Diego",
          },
        },
      ],
    },
  ],
}));

/** The two providers nested the way `DayPanel` nests them. */
function renderPage(
  currentHour: number | null,
  views = DATES.map((_, i) => dayView(i)),
  map: React.ReactNode = null,
) {
  return render(
    <SelectedDayProvider>
      <WeekGrid
        headingId="week-heading"
        title="The week ahead"
        days={DAYS}
        rows={[TIDE_ROW]}
      />
      <SelectedHourProvider currentHour={currentHour}>
        <ChosenDay days={views} map={map} />
      </SelectedHourProvider>
    </SelectedDayProvider>,
  );
}

/** What the map's readout says it is showing. */
function caption(container: HTMLElement): string {
  return (
    container.querySelector("[data-readout-caption]")?.textContent ?? "nothing"
  );
}

function readout(container: HTMLElement): string {
  return container.querySelector("[data-hour-readout]")?.textContent ?? "";
}

test("the page opens on the current hour rather than on nothing", () => {
  // The whole of the default. Before ADR-0035 the chart arrived with nothing
  // selected and the map beside it showed a day aggregate; it now arrives on an
  // hour, which is what lets one instrument mean one thing.
  const { container } = renderPage(14);

  expect(readout(container)).toContain("2 PM");
  expect(container.querySelector("[data-selected-mark]")).not.toBeNull();
});

test("the arriving hour is this day's, not an instant from another", () => {
  // The value encodes the day, so a chart resolving the hour against the wrong
  // frame prints a number from the wrong hundred.
  const { container } = renderPage(14);

  // Day 0, hour 14.
  expect(readout(container)).toContain("14.0 ft");
});

test("every day opens on the same clock hour, resolved against itself", () => {
  // Six of the seven days have no `nowMs` at all, so "the current hour" needs a
  // rule for Thursday, and this is it: the same clock hour on all seven. A rule
  // that showed the day aggregate on the other six would make the readout mean
  // two things depending on which day was chosen, which is the ambiguity
  // ADR-0027 refuses.
  const { container } = renderPage(14);

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[2]}"]`)!);

  expect(readout(container)).toContain("2 PM");
  // Day 2, hour 14 -- so it resolved against the new day rather than carrying
  // the old day's figure across.
  expect(readout(container)).toContain("214.0 ft");
});

test("a chosen hour survives a change of day", () => {
  // The reversal of `ChosenDay`'s old rule, and the reason for it: comparing one
  // hour across the week is what the week selector is for, and a selection that
  // cleared itself on every step made that impossible.
  const { container } = renderPage(14);

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);
  expect(readout(container)).toContain("9 AM");

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[1]}"]`)!);
  expect(readout(container)).toContain("9 AM");
  expect(readout(container)).toContain("109.0 ft");
});

test("a chosen hour survives a change of tab", () => {
  // The property the selection had when it was an instant, kept now that it is
  // an hour. An index would not have it: the two series need not be the same
  // length.
  const { container } = renderPage(14);

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);
  fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);

  expect(readout(container)).toContain("9 AM");
});

test("a series that does not reach the hour selects nothing, not the nearest", () => {
  // Exact rather than nearest, which matters most on arrival: a swell forecast
  // that ran out at teatime must not be given 5 PM's figure under a heading a
  // reader never chose. The tide here stops at 10 AM and the current hour is
  // 2 PM.
  const views = [dayView(0, 10), dayView(1), dayView(2)];
  const { container } = renderPage(14, views);

  expect(readout(container)).toBe("Pick an hour to read it.");
  expect(container.querySelector("[data-selected-mark]")).toBeNull();

  // And the tab beside it, which does reach 2 PM, still shows it -- so this is
  // the series answering honestly rather than the hour being lost.
  fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);
  expect(readout(container)).toContain("2 PM");
});

test("no current hour selects nothing, which is what a failed read looks like", () => {
  // `weekOfDays` is built from the same instant the daylight read carries, so
  // exactly one of the seven days is today and this is unreachable. It is
  // answered with null rather than a made-up hour because selecting midnight
  // plausibly is worse than selecting nothing visibly.
  const { container } = renderPage(null);

  expect(readout(container)).toBe("Pick an hour to read it.");
  expect(container.querySelector("[data-selected-mark]")).toBeNull();
});

test("the server render carries the hour, and still carries no control", () => {
  // ADR-0027 mounts the controls only once they can work; ADR-0035 draws the
  // line that rule was always drawing, which is between a dead button and a
  // printed fact. The mark is the fact and it is not gated on hydration, so a
  // reader without a script arrives on an hour like everyone else.
  //
  // Asserted on the mark rather than on the hour's words: `hourLabelAt` writes
  // every axis label, so `toContain("2 PM")` is true of a chart with nothing
  // selected at all and would pass without this feature existing.
  const markup = renderToStaticMarkup(
    <SelectedDayProvider>
      <SelectedHourProvider currentHour={14}>
        <ChosenDay days={DATES.map((_, i) => dayView(i))} map={null} />
      </SelectedHourProvider>
    </SelectedDayProvider>,
  );

  expect(markup).toContain("data-selected-mark");
  expect(markup).toContain("data-selected-guide");
  expect(markup).not.toContain("data-hour-prev");
  expect(markup).not.toContain("data-hour-column");

  // And the sentence that says which hour the mark is, which is gated with the
  // facts rather than with the buttons. Read out of the readout element rather
  // than off the whole markup: `hourLabelAt` writes every axis label, so a bare
  // search for "2 PM" would pass on a chart with nothing selected at all.
  const sentence = markup
    .split("data-hour-readout")[1]
    ?.split("</p>")[0]
    .replace(/^[^>]*>/, "");
  expect(sentence).toContain("2 PM");
  expect(sentence).toContain("14.0 ft");
  expect(sentence).not.toContain("Pick an hour");
});

test("without a script the invitation to pick an hour is not offered", () => {
  // The fallback wording is a control's instruction, so it is gated like one.
  // Reached here because this day's tide stops at 10 AM and the page opens on
  // 2 PM -- a reader with a script is told to pick an hour and can; a reader
  // without one would be told to use a control that is not on the page.
  const markup = renderToStaticMarkup(
    <SelectedDayProvider>
      <SelectedHourProvider currentHour={14}>
        <ChosenDay days={[dayView(0, 10), dayView(1), dayView(2)]} map={null} />
      </SelectedHourProvider>
    </SelectedDayProvider>,
  );

  expect(markup).toContain("data-hour-readout");
  expect(markup).not.toContain("Pick an hour");

  // With a script, the same state does offer it.
  const { container } = renderPage(14, [
    dayView(0, 10),
    dayView(1),
    dayView(2),
  ]);
  expect(readout(container)).toBe("Pick an hour to read it.");
});

test("without a current hour the server render marks nothing", () => {
  // The control on the test above: it fails if the mark is drawn unconditionally
  // rather than because an hour was resolved.
  const markup = renderToStaticMarkup(
    <SelectedDayProvider>
      <SelectedHourProvider currentHour={null}>
        <ChosenDay days={DATES.map((_, i) => dayView(i))} map={null} />
      </SelectedHourProvider>
    </SelectedDayProvider>,
  );

  expect(markup).not.toContain("data-selected-mark");
});

test("outside the provider the chart selects nothing, and its columns are inert", () => {
  // Worth pinning rather than leaving to fall out. The chart used to hold the
  // hour itself, so it worked alone; it no longer does, and the context's
  // default `choose` swallows the press. `WeekGrid` has had exactly this shape
  // since `selectedDay.tsx` -- a region outside its provider shows a default
  // and offers no choice -- and this follows it rather than inventing a second
  // mechanism for one problem.
  //
  // It is not a state the page reaches: `DayPanel` mounts the provider around
  // the same subtree it renders the chart into, so the two cannot come apart
  // without someone rewriting that file.
  const { container } = render(
    <ChosenDay days={DATES.map((_, i) => dayView(i))} map={null} />,
  );

  expect(readout(container)).toBe("Pick an hour to read it.");

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);

  expect(readout(container)).toBe("Pick an hour to read it.");
  expect(container.querySelector("[data-selected-mark]")).toBeNull();
});

test("the hour is an index into its own day, from one definition", () => {
  // The convention the chart and the readout share. It is asserted here rather
  // than left to the two components because the whole point of the module is
  // that there is one of it -- `dayFrame.ts` holds the night band for the same
  // reason.
  const startMs = localMidnightOf(DATES[0]);

  expect(hourOfDay(startMs, startMs)).toBe(0);
  expect(hourOfDay(startMs + 14 * HOUR, startMs)).toBe(14);
  // Half past still belongs to the hour it is inside.
  expect(hourOfDay(startMs + 14 * HOUR + 20 * 60_000, startMs)).toBe(14);
});

test("a chosen hour outranks the current one, and null falls back to it", () => {
  // One function rather than `selected ?? currentHour` in two components, for
  // `resolveSelected`'s reason: the two regions resolving the default
  // differently would show up only on a page nobody had clicked yet, and would
  // show up as them disagreeing about the hour -- which is the defect this
  // whole change is fixing.
  expect(resolveHour(9, 14)).toBe(9);
  expect(resolveHour(null, 14)).toBe(14);
  expect(resolveHour(null, null)).toBeNull();
  // Midnight is a real choice, not an absent one.
  expect(resolveHour(0, 14)).toBe(0);
});

test("the map's readout shows the hour the chart marks, before and after a click", () => {
  // **The pair this whole change is about.** A reader stepping through the
  // afternoon watched the chart's figures move while the wind and swell in the
  // map's corner sat on a day aggregate -- two regions stating different things
  // about one day, a few centimetres apart, which is issue #193.
  //
  // Both name the hour in the same words, because both print through
  // `hourLabelAt`. That is what a reader has to see it with: the caption over the
  // block and the sentence under the plot are the only visible statement that
  // the two regions are showing one hour.
  const { container } = renderPage(
    14,
    DATES.map((_, i) => dayView(i)),
    <DayCompass days={COMPASS_DAYS} />,
  );

  expect(caption(container)).toBe("2 PM");
  expect(readout(container)).toContain("2 PM");
  expect(screen.getByRole("img", { name: /^Wind at 2 PM/ })).toBeDefined();

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);

  expect(caption(container)).toBe("9 AM");
  expect(readout(container)).toContain("9 AM");
  expect(screen.getByRole("img", { name: /^Wind at 9 AM/ })).toBeDefined();
});

test("the readout follows a chosen hour across a change of day", () => {
  // The hour is shared, so this is the day selector moving one region and the
  // hour selection holding in the other. A readout that reverted to now on
  // every day change would undo the comparison the week selector exists for.
  const { container } = renderPage(
    14,
    DATES.map((_, i) => dayView(i)),
    <DayCompass days={COMPASS_DAYS} />,
  );

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);
  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[1]}"]`)!);

  expect(caption(container)).toBe("9 AM");
  expect(readout(container)).toContain("9 AM");
});
