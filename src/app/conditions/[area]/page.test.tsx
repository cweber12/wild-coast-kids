import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/conditions/WeekPanel", () => ({
  WeekPanel: ({ slug }: { slug: string }) => <p>week for {slug}</p>,
}));
vi.mock("@/components/conditions/DayPanel", () => ({
  DayPanel: ({ slug }: { slug: string }) => <p>day for {slug}</p>,
}));

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const permanentRedirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock("next/navigation", () => ({
  notFound,
  permanentRedirect,
  useRouter: () => ({ push: vi.fn() }),
}));

const {
  default: AreaConditions,
  generateMetadata,
  generateStaticParams,
  revalidate,
} = await import("./page");

const params = (area: string) => ({ params: Promise.resolve({ area }) });

// Both mocks record across tests, and two of the assertions below are about a
// call NOT happening.
beforeEach(() => {
  notFound.mockClear();
  permanentRedirect.mockClear();
});

test("renders the area named in the route", async () => {
  render(await AreaConditions(params("la-jolla")));

  expect(screen.getByRole("main")).toBeDefined();
  expect(
    screen.getByRole("heading", { name: /Beaches in La Jolla/ }),
  ).toBeDefined();
});

/**
 * The area reports what is measured now, and sends the reader to a beach for
 * what is forecast. Air is shared by all eighteen areas, so every area page has
 * something measured to say; the week and the day chart are still one beach at
 * a time.
 */
test("an area reports what is measured and defers the forecast", async () => {
  render(await AreaConditions(params("la-jolla")));

  expect(screen.getByText(/still shown one beach at a time/)).toBeDefined();
  expect(screen.queryByText(/week for/)).toBeNull();
  expect(screen.queryByText(/day for/)).toBeNull();
});

/**
 * The old per-beach URLs. `/conditions/<beach>` served a page for months, so it
 * redirects into the area holding that beach rather than 404ing — permanently,
 * because the nesting is the shape from here on.
 */
test("a beach slug redirects into the area holding it", async () => {
  await expect(AreaConditions(params("windansea-beach"))).rejects.toThrow(
    "NEXT_REDIRECT:/conditions/la-jolla/windansea-beach",
  );
  expect(permanentRedirect).toHaveBeenCalledWith(
    "/conditions/la-jolla/windansea-beach",
  );
});

/**
 * Three slugs name an area and a beach alike, and the area wins. A reader
 * following an old bookmark lands on the area containing the beach they saved,
 * which is a near miss rather than a broken link.
 */
test("a slug that is both an area and a beach resolves as the area", async () => {
  render(await AreaConditions(params("ocean-beach")));

  expect(
    screen.getByRole("heading", { name: /Beaches in Ocean Beach/ }),
  ).toBeDefined();
  expect(permanentRedirect).not.toHaveBeenCalled();
});

test("a slug that is neither is a 404, not an apology page", async () => {
  await expect(AreaConditions(params("no-such-place"))).rejects.toThrow(
    "NEXT_NOT_FOUND",
  );
  expect(notFound).toHaveBeenCalled();
});

test("the title names the area", async () => {
  expect(await generateMetadata(params("mission-bay-west"))).toMatchObject({
    title: "Mission Bay – West conditions",
  });
});

test("a slug outside the table gets the plain title rather than an invented one", async () => {
  expect(await generateMetadata(params("no-such-place"))).toEqual({
    title: "Conditions",
  });
});

/**
 * Nothing prerendered, so upstream load follows real readers rather than a
 * build asking five publishers about eighteen areas nobody has opened.
 */
test("prerenders nothing at build", () => {
  expect(generateStaticParams()).toEqual([]);
});

/**
 * All three routes render one section, so a reader should not get a fresher
 * answer depending on which URL they arrived at.
 */
test("revalidates on the same window as the other conditions routes", () => {
  expect(revalidate).toBe(900);
});

/**
 * Six of the eighteen areas hold one beach, and for those the area is the beach
 * page. ADR-0046 permits a single-member area on the grounds that "a lone
 * member shares everything with itself"; this is where that stops being an
 * argument and becomes what a reader sees.
 */
test("an area holding one beach shows it rather than offering it", async () => {
  render(await AreaConditions(params("sunset-cliffs")));

  expect(screen.getByText("week for sunset-cliffs-park")).toBeDefined();
  expect(screen.getByText("day for sunset-cliffs-park")).toBeDefined();
  // No list, and no heading over a list of one.
  expect(screen.queryByRole("heading", { name: /Beaches in/ })).toBeNull();
});

/**
 * The old per-beach URL of a one-beach area goes straight to the area, not
 * through the nested form on the way. Both routes ask
 * `canonicalConditionsPath`, which is what makes one hop the only hop.
 */
test("an old beach URL redirects once, not through the nested form", async () => {
  await expect(AreaConditions(params("sunset-cliffs-park"))).rejects.toThrow(
    "NEXT_REDIRECT:/conditions/sunset-cliffs",
  );
  expect(permanentRedirect).toHaveBeenCalledTimes(1);
  expect(permanentRedirect).toHaveBeenCalledWith("/conditions/sunset-cliffs");
});

/** A beach in an area of several still gets the nested URL. */
test("a beach with siblings still redirects to the nested URL", async () => {
  await expect(AreaConditions(params("la-jolla-cove"))).rejects.toThrow(
    "NEXT_REDIRECT:/conditions/la-jolla/la-jolla-cove",
  );
});
