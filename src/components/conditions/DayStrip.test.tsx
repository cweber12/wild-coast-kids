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

/**
 * `aria-current="date"`, which is the week grid's word for the same fact one
 * region up. It was `aria-pressed` here until 2026-09-17: two controls writing
 * one provider and announcing the choice two different ways, one as a toggle
 * that is on and the other as the current item in a set. The set is right --
 * seven days, one showing -- and the attribute is absent rather than "false"
 * on the others, which is how `aria-current` is specified.
 */
test("the day being shown is the current one, and only that one", () => {
  strip();

  expect(pill("Today").getAttribute("aria-current")).toBe("date");
  expect(pill("Thu, Sep 3").hasAttribute("aria-current")).toBe(false);

  fireEvent.click(pill("Thu, Sep 3"));

  expect(pill("Today").hasAttribute("aria-current")).toBe(false);
  expect(pill("Thu, Sep 3").getAttribute("aria-current")).toBe("date");
});

/**
 * One tab stop for the strip rather than seven, the way the chart's tab bar
 * and its hour columns already behave: Tab lands on the showing pill, the
 * arrow keys walk the week, and focus moves with the selection -- the half of
 * a roving tabindex the chart was missing until the same day this was added.
 */
test("one tab stop for the strip, and the arrow keys walk it with focus", () => {
  const { container } = strip();

  const stops = [...container.querySelectorAll("button")].filter(
    (button) => button.getAttribute("tabindex") === "0",
  );
  expect(stops).toEqual([pill("Today")]);

  pill("Today").focus();
  fireEvent.keyDown(pill("Today"), { key: "ArrowRight" });
  expect(screen.getByText("selected: 2026-09-03")).toBeDefined();
  expect(document.activeElement).toBe(pill("Thu, Sep 3"));
  expect(pill("Thu, Sep 3").getAttribute("tabindex")).toBe("0");

  // Stops rather than wrapping, which is the rule the chart's controls follow.
  fireEvent.keyDown(pill("Thu, Sep 3"), { key: "End" });
  expect(document.activeElement).toBe(pill("Fri, Sep 4"));
  fireEvent.keyDown(pill("Fri, Sep 4"), { key: "ArrowRight" });
  expect(document.activeElement).toBe(pill("Fri, Sep 4"));
  fireEvent.keyDown(pill("Fri, Sep 4"), { key: "Home" });
  expect(document.activeElement).toBe(pill("Today"));
});

/**
 * Nothing has been chosen yet, so the first day is the one showing —
 * `resolveSelected` is what both regions use to reach that answer, and it is
 * shared precisely so the grid and the strip cannot resolve the default
 * differently on a page nobody has clicked.
 */
test("before anything is chosen the first day is the current one", () => {
  strip();

  expect(screen.getByText("selected: none")).toBeDefined();
  expect(pill("Today").getAttribute("aria-current")).toBe("date");
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

  expect(pill("Today").getAttribute("aria-current")).toBe("date");
  // The click is inert rather than fatal.
  fireEvent.click(pill("Fri, Sep 4"));
  expect(pill("Today").getAttribute("aria-current")).toBe("date");
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
 * The site's ring is `currentColor`, which on the filled pill is white -- and
 * `outline-offset: 2px` draws it outside the pill, on cream. White on cream
 * paints about 1.05:1, so Tab landed on this pill and showed nothing, measured
 * on 2026-09-17 and visible in nothing. The selected pill names its ring
 * colour instead, the way `BeachPins` does; an unselected pill is `text-ocean`
 * already and inherits the right one.
 */
/**
 * A pointer over a pill it could choose sees it tint, the way the chart's
 * tabs already answer a hover. Audited 2026-09-17: the cursor changed and the
 * pill did not. The showing pill is filled already and answers nothing.
 */
test("a pill a reader could choose answers a hover, and the showing one does not", () => {
  strip();

  expect(pill("Thu, Sep 3").className).toContain("hover:bg-lavender");
  expect(pill("Today").className).not.toContain("hover:");
});

test("the showing pill's focus ring is not the colour of the ground", () => {
  strip();

  expect(pill("Today").className).toContain("focus-visible:outline-ocean");
  expect(pill("Thu, Sep 3").className).not.toContain(
    "focus-visible:outline-ocean",
  );
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
