import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { DayStrip, type DayChoice } from "./DayStrip";
import { SelectedDayProvider, useSelectedDay } from "./selectedDay";
import { TOUCH_TARGET } from "../ui/touchTarget";

const DAYS: DayChoice[] = [
  { localDate: "2026-09-02", dayName: "Today" },
  { localDate: "2026-09-03", dayName: "Thu, Sep 3" },
  { localDate: "2026-09-04", dayName: "Fri, Sep 4" },
];

/** Reports what the provider holds, so a click can be checked at the source. */
function Showing() {
  const { selected } = useSelectedDay();
  return <p>selected: {selected ?? "none"}</p>;
}

function strip(days: readonly DayChoice[] = DAYS) {
  return render(
    <SelectedDayProvider>
      <DayStrip days={days} />
      <Showing />
    </SelectedDayProvider>,
  );
}

function pill(name: string) {
  return screen.getByRole("button", { name });
}

test("every day on offer gets a pill, named as the heading names it", () => {
  strip();

  // The same strings the region heading and the week grid use. Three names for
  // one Thursday is how two regions start disagreeing about which day is which.
  expect(pill("Today")).toBeDefined();
  expect(pill("Thu, Sep 3")).toBeDefined();
  expect(pill("Fri, Sep 4")).toBeDefined();
});

test("choosing a day writes it to the provider the week grid also reads", () => {
  strip();

  fireEvent.click(pill("Fri, Sep 4"));

  // Asserted at the provider rather than at this component's own markup: the
  // point of the strip is that it and the grid cannot hold different answers,
  // and only the shared state shows that.
  expect(screen.getByText("selected: 2026-09-04")).toBeDefined();
});

test("the day being shown is the pressed one, and only that one", () => {
  strip();

  expect(pill("Today").getAttribute("aria-pressed")).toBe("true");
  expect(pill("Thu, Sep 3").getAttribute("aria-pressed")).toBe("false");

  fireEvent.click(pill("Thu, Sep 3"));

  expect(pill("Today").getAttribute("aria-pressed")).toBe("false");
  expect(pill("Thu, Sep 3").getAttribute("aria-pressed")).toBe("true");
});

/**
 * Nothing has been chosen yet, so the first day is the one showing —
 * `resolveSelected` is what both regions use to reach that answer, and it is
 * shared precisely so the grid and the strip cannot resolve the default
 * differently on a page nobody has clicked.
 */
test("before anything is chosen the first day is the pressed one", () => {
  strip();

  expect(screen.getByText("selected: none")).toBeDefined();
  expect(pill("Today").getAttribute("aria-pressed")).toBe("true");
});

/**
 * A reader without JavaScript is in this state, and `selectedDay.tsx` records
 * the decision it turns on: the context default is the null state rather than a
 * throw, so a region outside the provider shows its first day and offers no
 * working choice. Making it an error instead would turn a degraded page into a
 * blank one.
 */
test("outside the provider it renders and marks today rather than throwing", () => {
  render(<DayStrip days={DAYS} />);

  expect(pill("Today").getAttribute("aria-pressed")).toBe("true");
  // The click is inert rather than fatal.
  fireEvent.click(pill("Fri, Sep 4"));
  expect(pill("Today").getAttribute("aria-pressed")).toBe("true");
});

/**
 * ADR-0004. Every pill composes the standard rather than spelling a number, and
 * takes the `md:` opt-out a visible shape is allowed — the box growing is not
 * invisible here, so there is something to buy by restricting it above `md`.
 *
 * jsdom applies no stylesheets (ADR-0001), so this proves the floor is referred
 * to and a human confirms 44px renders.
 */
test("every pill composes the touch-target floor", () => {
  const { container } = strip();

  for (const button of container.querySelectorAll("button")) {
    expect(button.className).toContain(TOUCH_TARGET);
  }
});

/**
 * The row scrolls rather than wrapping, and `shrink-0` is the half of that
 * which is easy to leave out: flex items shrink before their container
 * overflows, so without it seven pills compress into seven slivers and the
 * scroller never engages at all.
 *
 * The ring is the other half. `globals.css` sets `outline-offset: 2px` on every
 * focusable thing, so a ring on the first or last pill draws outside the pill's
 * own box — an `overflow-hidden` scroller clips it, and `overflow-x-auto` with
 * vertical padding is what keeps it whole.
 */
test("the row scrolls sideways and does not clip a focus ring", () => {
  const { container } = strip();

  const group = container.querySelector('[role="group"]')!;
  expect(group.className).toContain("overflow-x-auto");
  expect(group.className).not.toContain("overflow-hidden");
  expect(group.className).not.toContain("flex-wrap");
  expect(group.className).toContain("py-1");

  for (const button of container.querySelectorAll("button")) {
    expect(button.className).toContain("shrink-0");
  }
});

/**
 * The selection is marked twice, which is the rule the week grid states for
 * itself one region up: a filled band is a colour, and a reader who does not
 * separate these two colours still has to be able to see which day is showing.
 */
test("the showing day is marked by more than its fill", () => {
  strip();

  expect(pill("Today").className).toContain("underline");
  expect(pill("Thu, Sep 3").className).not.toContain("underline");
});

/**
 * ADR-0027: a control mounts only once it can work. In the server render these
 * pills would be seven dead buttons for a reader with a blocked script, and
 * unlike `BeachSelector` -- whose `noscript` list of links does the same job in
 * plain markup -- day selection exists on this page in no other form. So the
 * honest fallback is no affordance at all, and the region renders exactly as it
 * did before this control existed.
 *
 * `selectedDay.test.tsx` asserts the same contract across the whole pair of
 * regions; this is the unit half, so a change here fails at the component that
 * caused it rather than three files away.
 */
test("nothing is rendered before the page can respond to a click", () => {
  const markup = renderToStaticMarkup(
    <SelectedDayProvider>
      <DayStrip days={DAYS} />
    </SelectedDayProvider>,
  );

  expect(markup).not.toContain("<button");
  expect(markup).not.toContain("data-day-pill");
  expect(markup).not.toContain("Choose a day");
});
