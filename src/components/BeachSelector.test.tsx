import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { BeachSelector } from "./BeachSelector";
import { TOUCH_TARGET } from "./touchTarget";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const GROUPS = [
  {
    region: "La Jolla and Pacific Beach",
    beaches: [
      { slug: "del-mar-city-beach", name: "Del Mar City Beach" },
      { slug: "la-jolla-shores-beach", name: "La Jolla Shores Beach" },
    ],
  },
  {
    region: "Bays, lagoons and inlets",
    beaches: [{ slug: "mission-bay", name: "Mission Bay" }],
  },
];

test("the chooser is labelled, so it is reachable without sight of it", () => {
  render(<BeachSelector groups={GROUPS} current="la-jolla-shores-beach" />);

  const select = screen.getByLabelText("Choose a beach");
  expect(select).toBeDefined();
  expect((select as HTMLSelectElement).value).toBe("la-jolla-shores-beach");
});

test("beaches are grouped by region rather than listed flat", () => {
  const { container } = render(
    <BeachSelector groups={GROUPS} current="la-jolla-shores-beach" />,
  );

  const labels = [...container.querySelectorAll("optgroup")].map((group) =>
    group.getAttribute("label"),
  );
  // Forty-odd entries is still too many to scan as one list.
  expect(labels).toEqual([
    "La Jolla and Pacific Beach",
    "Bays, lagoons and inlets",
  ]);
});

test("every beach given is offered exactly once", () => {
  const { container } = render(
    <BeachSelector groups={GROUPS} current="la-jolla-shores-beach" />,
  );

  const values = [...container.querySelectorAll("option")].map(
    (option) => (option as HTMLOptionElement).value,
  );
  expect(values).toEqual([
    "del-mar-city-beach",
    "la-jolla-shores-beach",
    "mission-bay",
  ]);
});

test("a beach without scripting is still reachable, as a link", () => {
  // Asserted against server-rendered markup, because that is where a `noscript`
  // does its job: the client renderer never parses its contents, and a family on
  // a phone with a blocked script only ever sees the HTML the server sent.
  const markup = renderToStaticMarkup(
    <BeachSelector groups={GROUPS} current="la-jolla-shores-beach" />,
  );

  expect(markup).toContain("<noscript>");
  expect(markup).toContain("Del Mar City Beach");
  expect(markup).toContain("/conditions/mission-bay");
  // Two-sided: markup containing every beach twice would pass the lines above
  // whether or not the fallback exists, so the links must be inside it.
  const fallback = markup.slice(markup.indexOf("<noscript>"));
  expect(fallback).toContain("/conditions/del-mar-city-beach");
});

/**
 * The one control on this page, and the site's 44px floor below `md`
 * (ADR-0004). It already measured about that from `py-3` alone, which is
 * exactly the drift the constant exists to stop: a value that happens to be
 * right is not the same as one that stays right when the padding changes.
 *
 * jsdom applies no stylesheets (ADR-0001), so this asserts the element refers
 * to the standard rather than that the rendered box is 44px. A human confirms
 * the second.
 */
test("the chooser composes the touch-target floor rather than measuring it", () => {
  render(<BeachSelector groups={GROUPS} current="la-jolla-shores-beach" />);

  expect(screen.getByLabelText("Choose a beach").className).toContain(
    TOUCH_TARGET,
  );
});

/**
 * The chooser moved into the page header beside the title, so the row owns the
 * spacing between it and the readings. A margin here would be counted twice —
 * the failure `SnapSection`'s docstring records from the landing page, where
 * padding on both the stop and its child pushed sections past the height they
 * had to fit.
 */
test("it carries no vertical margin of its own", () => {
  const { container } = render(
    <BeachSelector groups={GROUPS} current="la-jolla-shores-beach" />,
  );

  expect(container.firstElementChild?.className).not.toContain("mb-");
});
