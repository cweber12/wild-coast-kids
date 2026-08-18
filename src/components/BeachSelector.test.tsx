import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { BeachSelector } from "./BeachSelector";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const GROUPS = [
  {
    region: "North County coast",
    beaches: [
      { slug: "san-onofre-state-beach", name: "San Onofre State Beach" },
      { slug: "harbor-beach", name: "Harbor Beach" },
    ],
  },
  {
    region: "Bays, lagoons and inlets",
    beaches: [{ slug: "agua-hedionda-lagoon", name: "Agua Hedionda Lagoon" }],
  },
];

test("the chooser is labelled, so it is reachable without sight of it", () => {
  render(<BeachSelector groups={GROUPS} current="harbor-beach" />);

  const select = screen.getByLabelText("Choose a beach");
  expect(select).toBeDefined();
  expect((select as HTMLSelectElement).value).toBe("harbor-beach");
});

test("beaches are grouped by region rather than listed flat", () => {
  const { container } = render(
    <BeachSelector groups={GROUPS} current="harbor-beach" />,
  );

  const labels = [...container.querySelectorAll("optgroup")].map((group) =>
    group.getAttribute("label"),
  );
  // Seventy-three entries is too many to scan as one list.
  expect(labels).toEqual(["North County coast", "Bays, lagoons and inlets"]);
});

test("every beach given is offered exactly once", () => {
  const { container } = render(
    <BeachSelector groups={GROUPS} current="harbor-beach" />,
  );

  const values = [...container.querySelectorAll("option")].map(
    (option) => (option as HTMLOptionElement).value,
  );
  expect(values).toEqual([
    "san-onofre-state-beach",
    "harbor-beach",
    "agua-hedionda-lagoon",
  ]);
});

test("a beach without scripting is still reachable, as a link", () => {
  // Asserted against server-rendered markup, because that is where a `noscript`
  // does its job: the client renderer never parses its contents, and a family on
  // a phone with a blocked script only ever sees the HTML the server sent.
  const markup = renderToStaticMarkup(
    <BeachSelector groups={GROUPS} current="harbor-beach" />,
  );

  expect(markup).toContain("<noscript>");
  expect(markup).toContain("San Onofre State Beach");
  expect(markup).toContain("/conditions/agua-hedionda-lagoon");
  // Two-sided: markup containing every beach twice would pass the lines above
  // whether or not the fallback exists, so the links must be inside it.
  const fallback = markup.slice(markup.indexOf("<noscript>"));
  expect(fallback).toContain("/conditions/san-onofre-state-beach");
});
