/**
 * The coupling between the two regions, asserted where it actually lives.
 *
 * Neither component owns this behaviour: the week grid raises a choice and the
 * day panel answers it, and the only place the two meet is the provider. So
 * these render both inside it, which is the seam, rather than testing each half
 * against a mock of the other and proving nothing about the pair.
 */

import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { localMidnightOf } from "@/lib/pacific-time";
import { ChosenDay, type DayView } from "./ChosenDay";
import { DayCompass, type CompassDay } from "./DayCompass";
import { SelectedDayProvider } from "./selectedDay";
import { SelectedHourProvider } from "./selectedHour";
import { WeekGrid, type WeekDay, type WeekRow } from "./WeekGrid";
import type { SparkPoint } from "./DaySpark";

const HOUR = 3_600_000;
const DATES = ["2026-08-17", "2026-08-18", "2026-08-19"];

const DAYS: WeekDay[] = [
  {
    localDate: DATES[0],
    dayLabel: "Mon, Aug 17",
    dateLabel: "Aug 17",
    isToday: true,
  },
  {
    localDate: DATES[1],
    dayLabel: "Tue, Aug 18",
    dateLabel: "Aug 18",
    isToday: false,
  },
  {
    localDate: DATES[2],
    dayLabel: "Wed, Aug 19",
    dateLabel: "Aug 19",
    isToday: false,
  },
];

const TIDE_ROW: WeekRow = {
  label: "Lowest tide",
  cells: {
    [DATES[0]]: "6:41 PM",
    [DATES[1]]: "7:10 AM",
    [DATES[2]]: "7:44 AM",
  },
};

/** A curve whose values differ per day, so a panel showing the wrong one is visible. */
function points(localDate: string, base: number): SparkPoint[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    atMs: localMidnightOf(localDate) + hour * HOUR,
    value: base + hour / 10,
    published: true,
  }));
}

function dayView(index: number): DayView {
  const localDate = DATES[index];
  const isToday = index === 0;
  return {
    localDate,
    dayName: isToday ? "Today" : DAYS[index].dayLabel,
    // The heading's form and the sentence's form, composed the way `DayPanel`
    // composes them. A fixture deriving one from the other would prove the two
    // agree here and nothing about whether they agree on the page.
    chartWhen: isToday ? "today" : `on ${DAYS[index].dayLabel}`,
    startMs: localMidnightOf(localDate),
    endMs: localMidnightOf(localDate) + 24 * HOUR,
    sunriseMs: localMidnightOf(localDate) + 6 * HOUR,
    sunsetMs: localMidnightOf(localDate) + 19 * HOUR,
    nowMs: isToday ? localMidnightOf(localDate) + 14 * HOUR : null,
    cloud: [],
    series: [
      {
        key: "tide",
        label: "Tide",
        unitLabel: "ft",
        points: points(localDate, index * 10),
        description: `Tide on ${localDate}`,
        absence: "No tide series.",
        // This file is about which day is shown, not about who published it.
        // Null keeps the fixture to the one fact under test.
        provenance: null,
      },
      {
        key: "swell",
        label: "Swell",
        unitLabel: "ft",
        points: points(localDate, index * 10 + 100),
        description: `Swell on ${localDate}`,
        absence: "No swell series.",
        provenance: null,
      },
    ],
    wording: <p>Words for {localDate}</p>,
    measured: <p>Measured on {localDate}</p>,
  };
}

const VIEWS = DATES.map((_, index) => dayView(index));

/**
 * One needle per day, each from a different quarter.
 *
 * The readout travels beside the map rather than inside `DayView`, because the map
 * is one picture for the whole week and the needles are not. That makes it a
 * second consumer of the same choice, which is what this file exists to assert.
 */
const COMPASS_DAYS: CompassDay[] = DATES.map((localDate, index) => ({
  localDate,
  needles: [
    {
      kind: "wind",
      label: "Wind",
      fromDegT: [90, 180, 270][index],
      spreadDeg: 20,
      figure: "11.5 mph",
      provenance: {
        label: "Biggest wind in daylight",
        source: "this beach's own grid cell",
        network: "National Weather Service, San Diego",
      },
    },
  ],
}));

function renderBoth(map: React.ReactNode = null) {
  return render(
    <SelectedDayProvider>
      <WeekGrid
        headingId="week-heading"
        title="The week ahead"
        days={DAYS}
        rows={[TIDE_ROW]}
      />
      {/*
        The hour provider inside the day one, which is the nesting `DayPanel`
        builds: the week does not need the hour, and the day region does. It is
        here rather than in the tests that use it because the day selection is
        no longer separable from it -- a chosen hour now has to survive a change
        of day, which is a fact about the pair.

        `currentHour` is null so these tests keep their premise that the page
        opens with no hour chosen. What the default does instead is
        `selectedHour.test.tsx`'s to assert.
      */}
      <SelectedHourProvider currentHour={null}>
        <ChosenDay days={VIEWS} map={map} />
      </SelectedHourProvider>
    </SelectedDayProvider>,
  );
}

/** The plot's own accessible name, which says which day it drew. */
function drawnDay(container: HTMLElement): string | null {
  return (
    container.querySelector("svg[aria-label]")?.getAttribute("aria-label") ??
    null
  );
}

test("the panel opens on today, without anything having read a clock", () => {
  // The provider's state starts as null and each region resolves it against
  // its own first column. Both build from `weekOfDays`, so both first columns
  // are today -- which is how the default is reached without a component
  // asking what time it is.
  const { container } = renderBoth();

  expect(container.querySelector("#day-panel-heading")?.textContent).toBe(
    "Today, hour by hour",
  );
  expect(drawnDay(container)).toBe(`Tide on ${DATES[0]}`);
});

test("choosing a day in the week redraws the panel below", () => {
  // THE POINT OF THIS SLICE. Two regions in two suspense boundaries, one
  // choice.
  const { container } = renderBoth();

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[2]}"]`)!);

  expect(container.querySelector("#day-panel-heading")?.textContent).toBe(
    "Wed, Aug 19, hour by hour",
  );
  expect(drawnDay(container)).toBe(`Tide on ${DATES[2]}`);
  expect(screen.getByText(`Words for ${DATES[2]}`)).toBeDefined();
  // The measured block moves with the rest of the panel. It is the one region
  // whose content differs in *kind* between today and the other six -- two
  // cards against one sentence -- so a block left behind would be the most
  // visible way for the panel to disagree with its own heading.
  expect(screen.getByText(`Measured on ${DATES[2]}`)).toBeDefined();
  expect(screen.queryByText(`Measured on ${DATES[0]}`)).toBeNull();
});

/**
 * The sentence under the plot, which is the axis in words.
 *
 * Found by its own opening rather than by a test hook, because what is being
 * asserted is the sentence a reader gets. A `data-` attribute would let the
 * markup move and the words stay wrong.
 */
function summary(container: HTMLElement): string {
  return (
    [...container.querySelectorAll("p")].find((each) =>
      each.textContent?.startsWith("Low "),
    )?.textContent ?? ""
  );
}

/** The heading's own name for the day, without the phrase that follows it. */
function headingDay(container: HTMLElement): string {
  return (
    container
      .querySelector("#day-panel-heading")
      ?.textContent?.replace(", hour by hour", "") ?? ""
  );
}

test("the summary names the day the heading names, not today", () => {
  // The rule `WORDS` records: "Every sentence names the day, because the region
  // is no longer always today." Every absence sentence in the region takes a
  // `when` for this reason and so does the measured block; this one does not,
  // so the page names the day correctly twice and falsely once inside about
  // sixty pixels. It mis-states a figure and not only a date -- Wednesday's
  // range called today's attributes Wednesday's tide to a reader standing in
  // Monday.
  const { container } = renderBoth();

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[2]}"]`)!);

  expect(headingDay(container)).toBe("Wed, Aug 19");
  expect(summary(container)).toContain("Wed, Aug 19");
  expect(summary(container)).not.toContain("today");
});

test("and it still says today on today, rather than a date for every day", () => {
  // The other direction, because the cheap fix for the above is to print the
  // label unconditionally -- which would put "Mon, Aug 17" under a heading
  // reading "Today" and lose the one day the word is true of.
  const { container } = renderBoth();

  expect(headingDay(container)).toBe("Today");
  expect(summary(container)).toContain("today");
});

test("switching costs no request, because every day was already here", () => {
  // The whole week ships from the first render. Nothing fetches on a click,
  // and the way to assert that without mocking the network is that the markup
  // for another day is already in hand before anything is clicked.
  const { container } = renderBoth();

  // Three days of series were handed over; one is drawn.
  expect(VIEWS).toHaveLength(3);
  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[1]}"]`)!);
  expect(drawnDay(container)).toBe(`Tide on ${DATES[1]}`);
});

test("the chosen day is marked by more than colour", () => {
  // The filled band is the loud half and it is a colour. The underline is the
  // other channel, and `aria-current` is the third -- for a reader who sees
  // neither.
  const { container } = renderBoth();

  const today = container.querySelector(`[data-day-choice="${DATES[0]}"]`)!;
  const wednesday = container.querySelector(`[data-day-choice="${DATES[2]}"]`)!;

  expect(today.className).toContain("underline");
  expect(today.getAttribute("aria-current")).toBe("date");
  expect(wednesday.className).not.toContain("underline");
  expect(wednesday.getAttribute("aria-current")).toBeNull();

  fireEvent.click(wednesday);

  expect(wednesday.className).toContain("underline");
  expect(wednesday.getAttribute("aria-current")).toBe("date");
  expect(today.className).not.toContain("underline");
});

test("the 'now' line follows today, and does not follow the choice", () => {
  // A vertical rule at an instant is a claim about the present. Choosing
  // Wednesday must not draw one there, or the page says a reader is standing
  // in a day that has not happened.
  const { container } = renderBoth();

  expect(container.querySelector("[data-now]")).not.toBeNull();

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[2]}"]`)!);

  expect(container.querySelector("[data-now]")).toBeNull();
});

test("the tab a reader chose survives a change of day", () => {
  // The comparison the tabs exist for is across days, so the chart is not keyed
  // on the day and stays mounted. The chosen hour survives with it -- see
  // `selectedHour.test.tsx`, which owns that half now.
  const { container } = renderBoth();

  fireEvent.click(container.querySelector('[data-series-tab="swell"]')!);
  expect(drawnDay(container)).toBe(`Swell on ${DATES[0]}`);

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[2]}"]`)!);
  expect(drawnDay(container)).toBe(`Swell on ${DATES[2]}`);
});

test("the chosen hour survives it too, resolved against the new day", () => {
  // The reversal ADR-0035 records, asserted where the day selection lives.
  // This used to assert the opposite -- that the hour cleared itself, because
  // the selection was an instant and an instant on Monday matches no point in
  // Tuesday. That was the accident being read as a feature: a reader who chose
  // 9 AM to compare it across the week got it taken away on every step.
  const { container } = renderBoth();

  fireEvent.click(container.querySelector('[data-hour-column="9"]')!);
  expect(container.querySelector("[data-hour-readout]")?.textContent).toContain(
    "9 AM",
  );

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[1]}"]`)!);
  expect(container.querySelector("[data-hour-readout]")?.textContent).toContain(
    "9 AM",
  );
  // And it is the new day's 9 AM rather than a stale reading: this fixture's
  // curves differ per day, so a chart still showing Monday's figure would say
  // so here.
  expect(drawnDay(container)).toBe(`Tide on ${DATES[1]}`);
});

test("without a script the week is whole and offers no control", () => {
  // This is what the day selection falls back *to*, and why it needs no
  // `noscript` list of its own the way `BeachSelector` does: the week grid is
  // already a complete, server-rendered week. What a reader loses is the
  // choosing, not the forecast -- and the panel below shows today, which is the
  // day it opens on with a script anyway.
  const markup = renderToStaticMarkup(
    <SelectedDayProvider>
      <WeekGrid
        headingId="week-heading"
        title="The week ahead"
        days={DAYS}
        rows={[TIDE_ROW]}
      />
      <ChosenDay days={VIEWS} map={null} />
    </SelectedDayProvider>,
  );

  // Every day, and every figure.
  for (const day of ["Aug 17", "Tue, Aug 18", "Wed, Aug 19"]) {
    expect(markup).toContain(day);
  }
  expect(markup).toContain("6:41 PM");
  expect(markup).toContain("7:44 AM");

  // And not one control that cannot work.
  expect(markup).not.toContain("data-day-choice");
  expect(markup).not.toContain("<button");

  // The panel still renders, on today.
  expect(markup).toContain("Today, hour by hour");
  expect(markup).toContain(`Tide on ${DATES[0]}`);
});

test("a region outside the provider shows its first day rather than failing", () => {
  // The context default is the null state rather than a throw. A region
  // rendered without a provider is the state a reader without JavaScript is
  // already in, and turning that into an error would make a degraded page a
  // blank one.
  const { container } = render(<ChosenDay days={VIEWS} map={null} />);

  expect(drawnDay(container)).toBe(`Tide on ${DATES[0]}`);
});

test("the readout on the map follows the chosen day, and the map does not", () => {
  // The second consumer of the one choice. The needles are per day and the
  // coast is not, so the picture stays exactly where it was while the bearing
  // under it changes -- which is the whole reason the compass is a client
  // island inside a server-rendered map rather than seven copies of one.
  const { container } = renderBoth(
    <>
      <p data-test-coast="">One coastline, drawn once</p>
      <DayCompass days={COMPASS_DAYS} />
    </>,
  );

  expect(screen.getByRole("img", { name: /from the east, 90°/ })).toBeDefined();

  fireEvent.click(container.querySelector(`[data-day-choice="${DATES[2]}"]`)!);

  expect(
    screen.getByRole("img", { name: /from the west, 270°/ }),
  ).toBeDefined();
  expect(screen.queryByRole("img", { name: /from the east, 90°/ })).toBeNull();
  expect(screen.getByText("One coastline, drawn once")).toBeDefined();
});
