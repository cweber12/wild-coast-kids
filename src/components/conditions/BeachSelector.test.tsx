import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { BeachSelector } from "./BeachSelector";
import { TOUCH_TARGET } from "../ui/touchTarget";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const BEACHES = [
  { slug: "la-jolla-shores-beach", name: "La Jolla Shores Beach" },
  { slug: "windansea-beach", name: "WindanSea Beach" },
  { slug: "bird-rock", name: "Bird Rock (NR)" },
];

function selector(current: string | null = null) {
  return (
    <BeachSelector
      areaSlug="la-jolla"
      areaName="La Jolla"
      beaches={BEACHES}
      current={current}
    />
  );
}

test("the chooser is labelled, so it is reachable without sight of it", () => {
  render(selector());

  expect(screen.getByLabelText("Choose a beach")).toBeDefined();
});

/**
 * The area is the first option rather than an absence.
 *
 * `AreaSelector` cannot take a reader back out of a beach — choosing the area
 * they are already inside navigates to where they already are — so if this
 * control did not offer the area, walking into a beach would be one-way.
 */
test("the area itself is offered first, and the beaches follow in order", () => {
  const { container } = render(selector());

  const options = [...container.querySelectorAll("option")].map((option) => ({
    value: (option as HTMLOptionElement).value,
    label: option.textContent,
  }));

  expect(options).toEqual([
    { value: "", label: "All of La Jolla" },
    { value: "la-jolla-shores-beach", label: "La Jolla Shores Beach" },
    { value: "windansea-beach", label: "WindanSea Beach" },
    { value: "bird-rock", label: "Bird Rock (NR)" },
  ]);
});

test("it opens on the beach being shown", () => {
  render(selector("windansea-beach"));

  const select = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  expect(select.value).toBe("windansea-beach");
});

/**
 * On the area's own page nothing inside it is selected, so the control has to
 * open on the area rather than on whichever beach happens to be first — which
 * would claim the page is showing a beach it is not.
 */
test("on the area's page it opens on the area, not the first beach", () => {
  render(selector(null));

  const select = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  expect(select.value).toBe("");
});

test("choosing a beach navigates into it", () => {
  render(selector());

  const select = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  select.value = "bird-rock";
  select.dispatchEvent(new Event("change", { bubbles: true }));

  expect(push).toHaveBeenCalledWith("/conditions/la-jolla/bird-rock");
});

/**
 * The way back out, which is the reason the empty option exists at all. A
 * beach slug appended to nothing would navigate to `/conditions/la-jolla/`,
 * which is not a route.
 */
test("choosing the area navigates back out to it", () => {
  render(selector("bird-rock"));

  const select = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  select.value = "";
  select.dispatchEvent(new Event("change", { bubbles: true }));

  expect(push).toHaveBeenCalledWith("/conditions/la-jolla");
});

/**
 * Asserted against server-rendered markup, because that is where a `noscript`
 * does its job: the client renderer never parses its contents, and a family on
 * a phone with a blocked script only ever sees the HTML the server sent.
 *
 * It matters more here than on `AreaSelector`. With `AreaBeaches` retired this
 * is the only place an area's beaches appear as links, so a fallback that
 * quietly stopped rendering would make every beach page unreachable without
 * JavaScript rather than merely inconvenient.
 */
test("a beach without scripting is still reachable, as a link", () => {
  const markup = renderToStaticMarkup(selector());

  expect(markup).toContain("<noscript>");
  // Two-sided: markup naming every beach twice would pass a bare `toContain`
  // whether or not the fallback exists, so the links must be inside it.
  const fallback = markup.slice(markup.indexOf("<noscript>"));
  expect(fallback).toContain("/conditions/la-jolla/la-jolla-shores-beach");
  expect(fallback).toContain("/conditions/la-jolla/windansea-beach");
  expect(fallback).toContain("/conditions/la-jolla/bird-rock");
  expect(fallback).toContain("Bird Rock (NR)");
  // And the way back out, which is a route the beach links cannot reach.
  expect(fallback).toContain('href="/conditions/la-jolla"');
});

/**
 * The site's 44px floor below `md` (ADR-0004). jsdom applies no stylesheets
 * (ADR-0001), so this asserts the element refers to the standard rather than
 * that the rendered box is 44px. A human confirms the second.
 */
test("the chooser composes the touch-target floor rather than measuring it", () => {
  render(selector());

  expect(screen.getByLabelText("Choose a beach").className).toContain(
    TOUCH_TARGET,
  );
});

test("it carries no vertical margin of its own", () => {
  const { container } = render(selector());

  expect(container.firstElementChild?.className).not.toContain("mb-");
});
