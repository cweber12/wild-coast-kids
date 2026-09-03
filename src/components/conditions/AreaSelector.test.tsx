import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { AreaSelector } from "./AreaSelector";
import { TOUCH_TARGET } from "../ui/touchTarget";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const AREAS = [
  { slug: "la-jolla", name: "La Jolla" },
  { slug: "mission-bay-west", name: "Mission Bay – West" },
  { slug: "ocean-beach", name: "Ocean Beach" },
];

test("the chooser is labelled, so it is reachable without sight of it", () => {
  render(<AreaSelector areas={AREAS} current="la-jolla" />);

  const select = screen.getByLabelText("Choose an area");
  expect(select).toBeDefined();
  expect((select as HTMLSelectElement).value).toBe("la-jolla");
});

/**
 * The control offers areas, not beaches. It offered 51 beaches under headings
 * until 2026-09-02; an area is the thing a reader has a name for, and the
 * beaches inside one are listed on the page it leads to.
 */
test("every area given is offered exactly once, and nothing else is", () => {
  const { container } = render(
    <AreaSelector areas={AREAS} current="la-jolla" />,
  );

  const values = [...container.querySelectorAll("option")].map(
    (option) => (option as HTMLOptionElement).value,
  );
  expect(values).toEqual(["la-jolla", "mission-bay-west", "ocean-beach"]);
  expect(container.querySelectorAll("optgroup")).toHaveLength(0);
});

test("choosing an area navigates to it", () => {
  render(<AreaSelector areas={AREAS} current="la-jolla" />);

  const select = screen.getByLabelText("Choose an area") as HTMLSelectElement;
  select.value = "ocean-beach";
  select.dispatchEvent(new Event("change", { bubbles: true }));

  expect(push).toHaveBeenCalledWith("/conditions/ocean-beach");
});

test("an area without scripting is still reachable, as a link", () => {
  // Asserted against server-rendered markup, because that is where a `noscript`
  // does its job: the client renderer never parses its contents, and a family on
  // a phone with a blocked script only ever sees the HTML the server sent.
  const markup = renderToStaticMarkup(
    <AreaSelector areas={AREAS} current="la-jolla" />,
  );

  expect(markup).toContain("<noscript>");
  // Two-sided: markup naming every area twice would pass a bare `toContain`
  // whether or not the fallback exists, so the links must be inside it.
  const fallback = markup.slice(markup.indexOf("<noscript>"));
  expect(fallback).toContain("/conditions/la-jolla");
  expect(fallback).toContain("/conditions/mission-bay-west");
  expect(fallback).toContain("Mission Bay – West");
});

/**
 * The one control in the page header, and the site's 44px floor below `md`
 * (ADR-0004). jsdom applies no stylesheets (ADR-0001), so this asserts the
 * element refers to the standard rather than that the rendered box is 44px. A
 * human confirms the second.
 */
test("the chooser composes the touch-target floor rather than measuring it", () => {
  render(<AreaSelector areas={AREAS} current="la-jolla" />);

  expect(screen.getByLabelText("Choose an area").className).toContain(
    TOUCH_TARGET,
  );
});

/**
 * The chooser sits in the page header beside the title, so the row owns the
 * spacing between it and the readings. A margin here would be counted twice —
 * the failure `SnapSection`'s docstring records from the landing page.
 */
test("it carries no vertical margin of its own", () => {
  const { container } = render(
    <AreaSelector areas={AREAS} current="la-jolla" />,
  );

  expect(container.firstElementChild?.className).not.toContain("mb-");
});
