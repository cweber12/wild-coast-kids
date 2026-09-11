import { expect, test, vi } from "vitest";
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
  default: BeachConditions,
  generateMetadata,
  generateStaticParams,
  revalidate,
} = await import("./page");

const params = (area: string, beach: string) => ({
  params: Promise.resolve({ area, beach }),
});

test("renders the beach named in the route", async () => {
  render(await BeachConditions(params("la-jolla", "windansea-beach")));

  expect(screen.getByRole("main")).toBeDefined();
  expect(screen.getByText("week for windansea-beach")).toBeDefined();
  expect(screen.getByText("day for windansea-beach")).toBeDefined();
});

/**
 * The beach page still carries both of its area's controls, so moving between
 * two beaches in one area does not mean going back up a level.
 *
 * The beach half was a list of links until 2026-09-11 (ADR-0060). The control
 * has to do one thing the list did not: open on the beach being shown, so it
 * says where the reader is rather than only where they could go.
 */
test("a beach keeps both of its area's choosers", async () => {
  render(await BeachConditions(params("la-jolla", "windansea-beach")));

  expect(
    (screen.getByLabelText("Choose an area") as HTMLSelectElement).value,
  ).toBe("la-jolla");
  expect(
    (screen.getByLabelText("Choose a beach") as HTMLSelectElement).value,
  ).toBe("windansea-beach");
});

/**
 * The URL asserts a containment that `areas.json` owns, so a wrong first
 * segment is corrected rather than served. `/conditions/coronado/la-jolla-cove`
 * is a claim about San Diego that is false, and serving it would mean two URLs
 * for one beach with one of them lying about where it is.
 */
test("a beach under the wrong area redirects to the right one", async () => {
  await expect(
    BeachConditions(params("coronado", "la-jolla-cove")),
  ).rejects.toThrow("NEXT_REDIRECT:/conditions/la-jolla/la-jolla-cove");
});

test("a beach outside the inventory is a 404", async () => {
  await expect(
    BeachConditions(params("la-jolla", "no-such-beach")),
  ).rejects.toThrow("NEXT_NOT_FOUND");
  expect(notFound).toHaveBeenCalled();
});

/**
 * An invented first segment is a 404 rather than a redirect: correcting a wrong
 * area is only defensible when the area named is a real one somebody could have
 * meant.
 */
test("a real beach under an invented area is a 404", async () => {
  await expect(
    BeachConditions(params("atlantis", "la-jolla-cove")),
  ).rejects.toThrow("NEXT_NOT_FOUND");
});

test("the title names the beach rather than its area", async () => {
  expect(
    await generateMetadata(params("la-jolla", "windansea-beach")),
  ).toMatchObject({ title: "WindanSea Beach conditions" });
});

test("prerenders nothing at build", () => {
  expect(generateStaticParams()).toEqual([]);
});

test("revalidates on the same window as the other conditions routes", () => {
  expect(revalidate).toBe(900);
});

/**
 * One page, one address. An area of one serves its beach at the area's URL, so
 * this level does not exist for it — redirected rather than 404ed, because the
 * beach is real and this is the URL the beach list linked to until it moved up.
 */
test("the nested URL of a one-beach area moves up to the area", async () => {
  await expect(
    BeachConditions(params("sunset-cliffs", "sunset-cliffs-park")),
  ).rejects.toThrow("NEXT_REDIRECT:/conditions/sunset-cliffs");
});
