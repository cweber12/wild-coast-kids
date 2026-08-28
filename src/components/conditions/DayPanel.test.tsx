import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readSkyWording = vi.fn();
const readDaylightWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({ readSkyWording, readDaylightWeek }));

const { DayPanel } = await import("./DayPanel");

const CELL = { id: "SGX/54,21", elevationM: 0 };

/**
 * The daylight read, whose first day is today by construction -- `weekOfDays`
 * builds its array from today outward. It is mocked rather than stubbed loosely
 * because that ordering is the whole of how this panel knows which day it is.
 */
function daylight(dates: string[]) {
  readDaylightWeek.mockReturnValue({
    beachName: "La Jolla Shores Beach",
    days: dates.map((localDate, index) => ({
      localDate,
      dayLabel: "Mon, Aug 17",
      dateLabel: "Mon, Aug 17",
      isToday: index === 0,
      sunriseLabel: "6:14 AM",
      sunsetLabel: "7:32 PM",
      sunriseMs: 0,
      sunsetMs: 0,
    })),
  });
}

function week(
  days: { localDate: string; periodName: string; words: string }[],
) {
  readSkyWording.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    cell: CELL,
    state: {
      kind: "week",
      days: days.map((day) => ({ ...day, isDaytime: true })),
    },
  });
}

beforeEach(() => {
  readSkyWording.mockReset();
  readDaylightWeek.mockReset();
  daylight(["2026-08-17", "2026-08-18"]);
});

test("asks for the slug it was given and shows that day's words", async () => {
  week([
    {
      localDate: "2026-08-17",
      periodName: "Today",
      words: "Patchy Fog then Mostly Sunny",
    },
  ]);

  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(readSkyWording).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(readDaylightWeek).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("Patchy Fog then Mostly Sunny")).toBeDefined();
});

test("shows today and not another day the same read carries", async () => {
  // The wording read returns the whole week. A panel that took the first entry
  // of *that* array would be wrong whenever the forecast has stopped covering
  // today -- it is ragged, and drops days it does not reach.
  week([
    { localDate: "2026-08-18", periodName: "Tuesday", words: "Mostly Sunny" },
    { localDate: "2026-08-17", periodName: "Today", words: "Patchy Fog" },
  ]);

  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText("Patchy Fog")).toBeDefined();
  expect(screen.queryByText("Mostly Sunny")).toBeNull();
});

test("takes today from the daylight read, which cannot fail", async () => {
  // Not from a clock: reading one during render is impure and this repo's lint
  // rules refuse it. Moving the day the daylight read names must move the panel.
  daylight(["2026-08-18", "2026-08-19"]);
  week([
    { localDate: "2026-08-17", periodName: "Today", words: "Patchy Fog" },
    { localDate: "2026-08-18", periodName: "Tuesday", words: "Mostly Sunny" },
  ]);

  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText("Mostly Sunny")).toBeDefined();
  expect(screen.queryByText("Patchy Fog")).toBeNull();
});

test("names the region without promising content it does not have yet", async () => {
  // "Today" and not "Today, hour by hour": the chart lands in a later slice,
  // and a heading naming content the region does not carry is the page
  // promising more than it delivers.
  week([{ localDate: "2026-08-17", periodName: "Today", words: "Sunny" }]);

  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Today");
});

test("the region is labelled by its heading, for anyone navigating by region", async () => {
  week([{ localDate: "2026-08-17", periodName: "Today", words: "Sunny" }]);

  const { container } = render(
    await DayPanel({ slug: "la-jolla-shores-beach" }),
  );

  const section = container.querySelector("section");
  const heading = screen.getByRole("heading", { level: 2 });
  expect(section?.getAttribute("aria-labelledby")).toBe(heading.id);
});

test("an outage reaches the reader as words rather than an empty region", async () => {
  readSkyWording.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    cell: CELL,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  render(await DayPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
  expect(screen.getByText(/could not get/)).toBeDefined();
});

test("a failure to resolve the beach is not swallowed into a rendered nothing", async () => {
  readSkyWording.mockRejectedValue(new Error("no beach in the inventory"));

  await expect(DayPanel({ slug: "no-such-beach" })).rejects.toThrow(
    /no beach in the inventory/,
  );
});
