import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { NowClock } from "./NowClock";

/** 2026-08-17, 11:13 AM Pacific. 18:13 UTC, so a runner clock would read 6:13 PM. */
const AT_MS = Date.UTC(2026, 7, 17, 18, 13);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AT_MS);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The whole reason this is a client component. The three conditions routes set
 * `revalidate = 900`, so a clock rendered on the server is the render time and
 * can be a quarter of an hour behind the reader -- a confidently wrong number
 * on a page whose discipline is refusing to print one. ADR-0054.
 */
test("nothing is rendered on the server", () => {
  expect(renderToStaticMarkup(<NowClock />)).toBe("");
});

/**
 * And the same markup is what a reader with a blocked script keeps. Nothing
 * false is shown: the observation time beside this in the band is a fact about
 * the past and survives on its own.
 */
test("the server render is empty rather than a placeholder", () => {
  const markup = renderToStaticMarkup(<NowClock />);
  expect(markup).not.toContain("--");
  expect(markup).not.toContain("span");
});

test("the client renders the time in Pacific, not the runner's zone", () => {
  render(<NowClock />);

  // 18:13 UTC is 11:13 AM in San Diego. A component using the ambient locale
  // would print 6:13 PM here, and would print something different again on CI.
  expect(screen.getByText(/11:13 AM/)).toBeDefined();
});

test("the date comes with it, because the band states both", () => {
  render(<NowClock />);

  expect(screen.getByText(/Mon, Aug 17/)).toBeDefined();
});

/**
 * A frozen clock is right on arrival and silently wrong after a tab has sat
 * open twenty minutes -- which is the same failure as the server-rendered one,
 * just later. The gap between this and the observation time beside it is the
 * only reason to print both, so it has to keep growing.
 */
test("it ticks, so the gap to the observation time stays honest", () => {
  render(<NowClock />);
  expect(screen.getByText(/11:13 AM/)).toBeDefined();

  act(() => {
    vi.advanceTimersByTime(3 * 60_000);
  });

  expect(screen.getByText(/11:16 AM/)).toBeDefined();
});

/**
 * A minute, not a second: the band prints `11:13 AM`, so a second-resolution
 * timer would re-render sixty times for every change a reader could see.
 */
test("it does not re-render within the minute", () => {
  render(<NowClock />);

  act(() => {
    vi.advanceTimersByTime(59_000);
  });

  expect(screen.getByText(/11:13 AM/)).toBeDefined();
});

/**
 * The bug the first draft shipped: with the interpunct on the bound's side, a
 * server render -- and every reader with a blocked script -- opened the line on
 * a stray ` · `. The separator belongs to the half that can vanish.
 */
test("the separator is not left behind when the clock is not rendered", () => {
  expect(renderToStaticMarkup(<NowClock trailing />)).toBe("");
});

test("the separator is carried by the clock when something follows it", () => {
  const { container } = render(<NowClock trailing />);
  expect(container.textContent).toBe("11:13 AM, Mon, Aug 17 · ");
});

test("and is absent when nothing does", () => {
  const { container } = render(<NowClock />);
  expect(container.textContent).toBe("11:13 AM, Mon, Aug 17");
});
