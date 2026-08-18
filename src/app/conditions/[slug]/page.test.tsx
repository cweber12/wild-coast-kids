import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/TidePanel", () => ({
  TidePanel: ({ slug }: { slug: string }) => <p>panel for {slug}</p>,
}));
vi.mock("@/components/WavePanel", () => ({
  WavePanel: ({ slug }: { slug: string }) => <p>waves for {slug}</p>,
}));

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ push: vi.fn() }),
}));

const {
  default: BeachConditions,
  generateMetadata,
  generateStaticParams,
  revalidate,
} = await import("./page");

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

test("renders the beach named in the route", async () => {
  render(await BeachConditions(params("harbor-beach")));

  expect(screen.getByRole("main")).toBeDefined();
  expect(screen.getByText("panel for harbor-beach")).toBeDefined();
});

test("a slug outside the inventory is a 404, not an apology page", async () => {
  await expect(BeachConditions(params("no-such-beach"))).rejects.toThrow(
    "NEXT_NOT_FOUND",
  );
  expect(notFound).toHaveBeenCalled();
});

test("the title names the beach, so a shared link says where it is about", async () => {
  const metadata = await generateMetadata(params("harbor-beach"));
  expect(metadata.title).toBe("Harbor Beach conditions");
  expect(String(metadata.description)).toContain("Harbor Beach");
});

test("metadata for an unknown slug falls back rather than throwing", async () => {
  // generateMetadata runs before the page body, so it must not be the thing that
  // decides a 404.
  expect((await generateMetadata(params("no-such-beach"))).title).toBe(
    "Conditions",
  );
});

test("nothing is prerendered at build, so upstream load follows real readers", () => {
  // 73 beaches times a NOAA request each, on every build, for pages nobody has
  // looked at.
  expect(generateStaticParams()).toEqual([]);
});

test("it revalidates on the same clock as /conditions", () => {
  // The two routes render one section; which URL a reader arrived at must not
  // decide how fresh their answer is.
  expect(revalidate).toBe(900);
});
