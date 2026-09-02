import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatPrice, SessionSchedule } from "./SessionSchedule";
import { REGION_HEADING } from "./ui/headingRank";
import type { ScheduleResult, Session } from "@/lib/sessions";

const session = (overrides: Partial<Session> = {}): Session => ({
  id: "11111111-1111-1111-1111-111111111111",
  program: "coop",
  title: "Tidepool Walk at Cabrillo",
  summary: null,
  // 10:00 to 13:00 on a Tuesday in San Diego.
  startsAt: "2026-09-08T17:00:00Z",
  endsAt: "2026-09-08T20:00:00Z",
  locationName: null,
  locationUrl: null,
  priceCents: null,
  ...overrides,
});

const slot = {
  emoji: "🌿",
  headline: "Full co-op details coming soon.",
  detail:
    "The weekly rhythm, meeting spots, and fall sign-up details land here.",
  program: "coop" as const,
};

const ok = (sessions: Session[]): ScheduleResult => ({ kind: "ok", sessions });

describe("SessionSchedule", () => {
  test("lists each session with its day and hours in Pacific time", () => {
    render(<SessionSchedule {...slot} result={ok([session()])} />);

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Tidepool Walk at Cabrillo",
      }),
    ).toBeDefined();
    expect(screen.getByText("Tue, Sep 8 · 10:00 AM – 1:00 PM")).toBeDefined();
  });

  test("renders one item per session, in the order given", () => {
    render(
      <SessionSchedule
        {...slot}
        result={ok([
          session({ id: "a", title: "First" }),
          session({ id: "b", title: "Second" }),
        ])}
      />,
    );

    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(["First", "Second"]);
  });

  // Both states show the same thing on purpose. A parent can act on neither,
  // and the difference is reported to the operator in the server log instead.
  test.each([
    ["no sessions yet", ok([])],
    [
      "an unreachable database",
      {
        kind: "unavailable",
        reason: "HTTP 500",
        drift: false,
      } as ScheduleResult,
    ],
  ])("falls back to the reserved slot when there is %s", (_case, result) => {
    render(<SessionSchedule {...slot} result={result} />);

    expect(screen.getByText(/full co-op details coming soon/i)).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  test("links the location when there is a URL, and opens it detached", () => {
    render(
      <SessionSchedule
        {...slot}
        result={ok([
          session({
            locationName: "Cabrillo National Monument",
            locationUrl: "https://maps.example.com/cabrillo",
          }),
        ])}
      />,
    );

    const link = screen.getByRole("link", {
      name: "Cabrillo National Monument",
    });
    expect(link.getAttribute("href")).toBe("https://maps.example.com/cabrillo");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("shows a location with no URL as plain text rather than a dead link", () => {
    render(
      <SessionSchedule
        {...slot}
        result={ok([session({ locationName: "Studio — North Park" })])}
      />,
    );

    expect(screen.getByText("Studio — North Park")).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
  });

  // Null and zero are different facts: one is "not priced here", the other is
  // "this costs nothing". Rendering null as "Free" would invent a promise.
  test("prints nothing for an unpriced session and 'Free' for a free one", () => {
    const { rerender } = render(
      <SessionSchedule
        {...slot}
        result={ok([session({ priceCents: null })])}
      />,
    );
    expect(screen.queryByText(/free|\$/i)).toBeNull();

    rerender(
      <SessionSchedule {...slot} result={ok([session({ priceCents: 0 })])} />,
    );
    expect(screen.getByText("Free")).toBeDefined();
  });

  test("carries the program's own accent, derived rather than passed", () => {
    render(
      <SessionSchedule
        {...slot}
        program="art"
        result={ok([session({ program: "art" })])}
      />,
    );

    expect(
      screen.getByText(/Tue, Sep 8/).className.includes("text-purple"),
    ).toBe(true);
  });

  /**
   * ADR-0014, on the page that decision knowingly left behind. See #139.
   *
   * "Upcoming sessions" was label register at 10px and the session titles
   * inside it are display register at 18px, so the child outranked its parent
   * -- the same defect ADR-0014 fixed on `/conditions`, on a page outside the
   * brief it was taken under.
   *
   * The colour is the half that needed deciding rather than deriving. It was
   * `ACCENTS[program]`, so the heading's colour was a function of which program
   * was rendering; it now inherits, as `REGION_HEADING` does everywhere and as
   * the `<h1>` above it already did. Asserting the same string at both programs
   * is what proves that, and a per-program class would fail here rather than
   * only on the page nobody screenshotted.
   *
   * The accent is not gone from the component -- the date line above each title
   * still carries it, which the test above this one holds.
   */
  test("the list's heading outranks the titles inside it, at either program", () => {
    const { rerender } = render(
      <SessionSchedule
        {...slot}
        program="art"
        result={ok([session({ program: "art" })])}
      />,
    );

    const named = () =>
      screen.getByRole("heading", { level: 2, name: "Upcoming sessions" })
        .className;

    expect(named()).toBe(REGION_HEADING);

    rerender(
      <SessionSchedule
        {...slot}
        program="coop"
        result={ok([session({ program: "coop" })])}
      />,
    );

    expect(named()).toBe(REGION_HEADING);
  });

  // The page's own title is an h1 and session titles are h3, so the list owes
  // the document the level in between. The reserved slot has no list to name
  // and so introduces no heading at all.
  test("heads the list at level 2, and adds no heading when there is none", () => {
    const { rerender } = render(
      <SessionSchedule {...slot} result={ok([session()])} />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Upcoming sessions" }),
    ).toBeDefined();

    rerender(<SessionSchedule {...slot} result={ok([])} />);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("formatPrice", () => {
  test.each([
    [0, "Free"],
    [4500, "$45"],
    [500, "$5"],
    [4550, "$45.50"],
    [99, "$0.99"],
  ])("%i cents reads as %s", (cents, expected) => {
    expect(formatPrice(cents)).toBe(expected);
  });
});
