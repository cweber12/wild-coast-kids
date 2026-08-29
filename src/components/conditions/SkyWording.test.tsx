import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkyWording } from "./SkyWording";
import type { SkyWordingView } from "@/lib/conditions";

const CELL = { id: "SGX/54,21", elevationM: 0 };
const TODAY = "2026-08-17";

function view(
  days: {
    localDate: string;
    periodName: string;
    isDaytime: boolean;
    words: string;
  }[],
  cell = CELL,
): SkyWordingView {
  return {
    beachName: "La Jolla Shores Beach",
    cell,
    state: {
      kind: "week",
      days: days.map((day) => ({
        ...day,
        dayLabel: "Mon, Aug 17",
        dateLabel: "Mon, Aug 17",
        isToday: day.localDate === TODAY,
      })),
    },
  } as SkyWordingView;
}

const DAYTIME = {
  localDate: TODAY,
  periodName: "Today",
  isDaytime: true,
  words: "Patchy Fog then Mostly Sunny",
};

describe("the publisher's words", () => {
  test("prints them exactly as published, transitions and all", () => {
    // THE ASSERTION ADR-0009 TURNS ON, at the last place it could be broken.
    // ADR-0024 measured a computed band word contradicting this very field on
    // three days of six, so this component may relay and may not reword.
    render(<SkyWording view={view([DAYTIME])} localDate={TODAY} />);

    const words = document.querySelector("[data-sky-wording]");
    expect(words?.textContent).toBe("Patchy Fog then Mostly Sunny");
  });

  test("the transition survives, which is the part a band word cannot say", () => {
    // "Patchy Fog then Mostly Sunny" is one fact about a burn-off morning.
    // Anything that trimmed it to its first clause would print fog for a day
    // that clears by ten, which is the marine-layer week ADR-0024 measured.
    render(<SkyWording view={view([DAYTIME])} localDate={TODAY} />);

    const words =
      document.querySelector("[data-sky-wording]")?.textContent ?? "";
    expect(words).toContain(" then ");
    expect(words).toContain("Mostly Sunny");
  });

  test("names the period, so a night forecast is not read as an afternoon", () => {
    // The forecast does not run backwards: by evening today's daytime half has
    // dropped out and `readSkyWording` falls back to the night one. Printing
    // the publisher's name for it is the whole of what makes that honest.
    render(
      <SkyWording
        view={view([
          {
            localDate: TODAY,
            periodName: "Tonight",
            isDaytime: false,
            words: "Patchy Fog",
          },
        ])}
        localDate={TODAY}
      />,
    );

    expect(screen.getByText("Tonight")).toBeDefined();
    expect(document.querySelector("[data-sky-wording]")?.textContent).toBe(
      "Patchy Fog",
    );
  });

  test("carries its own provenance line, not the cloud row's", () => {
    // ADR-0024 named "a second provenance line" as one of three costs of taking
    // this read. One line covering both products would tell a reader the page
    // had asked once when it asked twice.
    render(<SkyWording view={view([DAYTIME])} localDate={TODAY} />);

    expect(screen.getByText(/Sky, in words/)).toBeDefined();
    expect(
      screen.getByText(/National Weather Service, San Diego/),
    ).toBeDefined();
    expect(
      screen.getByText(/a forecast, not a reading taken at the beach/),
    ).toBeDefined();
  });

  test("a bluff cell still says so, the way the cloud row does", () => {
    render(
      <SkyWording
        view={view([DAYTIME], { id: "SGX/54,21", elevationM: 117 })}
        localDate={TODAY}
      />,
    );

    expect(screen.getByText(/covers the bluff above this beach/)).toBeDefined();
  });
});

describe("when there are no words", () => {
  test("an outage says so and never computes a word instead", () => {
    // The failure mode this whole read exists to avoid. Reaching for the cloud
    // percentages and banding them is exactly the computation ADR-0024
    // rejected on measurement, and a fallback is where it would look sensible.
    render(
      <SkyWording
        view={{
          beachName: "La Jolla Shores Beach",
          cell: CELL,
          state: { kind: "unavailable", detail: "HTTP 503", drift: false },
        }}
        localDate={TODAY}
      />,
    );

    expect(screen.getByText(/could not get/)).toBeDefined();
    expect(document.querySelector("[data-sky-wording]")).toBeNull();
    // Not a band word, not a percentage, not a guess.
    expect(document.body.textContent).not.toMatch(/Sunny|Cloudy|Fog|Clear|%/);
  });

  test("a beach outside the grid is told it will never have words", () => {
    // Permanent, where an outage is transient. The same distinction `TideToday`
    // draws between no-station and unavailable: collapsing them tells a reader
    // to come back later about something that will never work.
    render(
      <SkyWording
        view={{
          beachName: "Somewhere inland",
          cell: null,
          state: { kind: "no-cell", reason: "no cell was bound" },
        }}
        localDate={TODAY}
      />,
    );

    expect(screen.getByText(/publishes no forecast cell/)).toBeDefined();
    expect(document.querySelector("[data-sky-wording]")).toBeNull();
  });

  test("a day past the forecast's reach says that, not that the feed is down", () => {
    // The third silence, and it is neither of the other two: the cell answered
    // and the product simply does not reach this far ahead yet.
    render(<SkyWording view={view([DAYTIME])} localDate="2026-08-24" />);

    expect(screen.getByText(/does not reach this day yet/)).toBeDefined();
    expect(document.querySelector("[data-sky-wording]")).toBeNull();
  });

  test("the three silences are three different sentences", () => {
    // Each view below is a shape `readSkyWording` can actually return -- the
    // no-cell one carries a null cell, because the type says those are one
    // case. An earlier version of this test paired a live cell with a no-cell
    // state behind a cast, which is a view the read cannot produce, and the
    // tightened type is what surfaced it.
    const views: SkyWordingView[] = [
      {
        beachName: "La Jolla Shores Beach",
        cell: CELL,
        state: { kind: "unavailable", detail: "HTTP 503", drift: false },
      },
      {
        beachName: "Somewhere inland",
        cell: null,
        state: { kind: "no-cell", reason: "no cell was bound" },
      },
      view([DAYTIME]),
    ];

    const said = new Set<string>();
    for (const each of views) {
      // The last one is a live week asked for a day past the forecast's reach.
      const localDate = each.state.kind === "week" ? "2026-08-24" : TODAY;
      const { container, unmount } = render(
        <SkyWording view={each} localDate={localDate} />,
      );
      said.add(container.textContent ?? "");
      unmount();
    }

    expect(said.size).toBe(3);
  });

  /**
   * The regression. This panel renders onto the page's own cream ground, and
   * both of these printed the reading card's colour there -- white at 55%,
   * which paints 1.03:1 on cream. The words were in the DOM and the same
   * colour as the paper.
   *
   * The absence half is the worse one and is asserted first: a beach outside
   * the grid, or a quiet forecast endpoint, would have explained itself in
   * invisible text, which is the silent failure this component's own docstring
   * says it exists to prevent.
   */
  test("the absence is printed in a colour that is legible on the page", () => {
    const { container } = render(
      <SkyWording
        view={
          {
            beachName: "Somewhere inland",
            cell: null,
            state: { kind: "no-cell", reason: "no cell was bound" },
          } as SkyWordingView
        }
        localDate={TODAY}
      />,
    );

    const said = container.querySelector("p");
    expect(said?.getAttribute("class")).toContain("text-fog");
    expect(said?.getAttribute("class")).not.toContain("text-white");
  });

  test("the attribution is printed in a colour that is legible on the page", () => {
    const { container } = render(
      <SkyWording view={view([DAYTIME])} localDate={TODAY} />,
    );

    const lines = [...container.querySelectorAll("p")].map((p) =>
      p.getAttribute("class"),
    );
    expect(lines.some((cls) => cls?.includes("text-fog"))).toBe(true);
    expect(lines.every((cls) => !cls?.includes("text-white"))).toBe(true);
  });
});
