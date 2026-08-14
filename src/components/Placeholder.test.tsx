import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Placeholder } from "./Placeholder";

test("the label becomes the slot's accessible name", () => {
  // The label is the whole point of the module: whatever replaces this slot
  // with a real <img> has to keep the same name, so the name has to be
  // reachable by role rather than by the text that happens to be drawn.
  render(<Placeholder label="Logo" />);

  expect(screen.getByRole("img", { name: "Logo" })).toBeDefined();
});

test("a background slot is named even though it draws no label", () => {
  render(<Placeholder background label="Hero photo" />);

  // The visible label is what `background` drops; the accessible name is not.
  expect(screen.getByRole("img", { name: "Hero photo" })).toBeDefined();
});

test("a foreground slot draws its label by default", () => {
  render(<Placeholder label="Logo" />);

  expect(screen.getByText("Logo")).toBeDefined();
});

test("a background slot hides its label by default", () => {
  // `showLabel = !background`: a fill sits under real content, so its label
  // would print over that content. Nothing but this asserts the default.
  render(<Placeholder background label="Hero photo" />);

  expect(screen.queryByText("Hero photo")).toBeNull();
});

test("showLabel forces a background slot to draw its label", () => {
  // Hero does exactly this. Without the override its right half is invisible
  // over the purple and reads as empty (design review, finding 2).
  render(<Placeholder background showLabel label="Hero photo" />);

  expect(screen.getByText("Hero photo")).toBeDefined();
});

test("showLabel={false} silences a foreground slot's label", () => {
  render(<Placeholder showLabel={false} label="Logo" />);

  expect(screen.queryByText("Logo")).toBeNull();
  // Still an image to a screen reader, just an unlabelled-looking one.
  expect(screen.getByRole("img", { name: "Logo" })).toBeDefined();
});

test("a foreground slot carries the dashed frame", () => {
  // jsdom applies no stylesheets, so the class contract is the seam. The
  // frame is what tells a reader the slot is a stand-in and not a blank box.
  render(<Placeholder label="Logo" />);

  expect(screen.getByRole("img", { name: "Logo" }).className).toContain(
    "border-dashed",
  );
});

test("a background slot drops the dashed frame", () => {
  // A fill sits behind content, where a frame would read as a stray box.
  render(<Placeholder background label="Hero photo" />);

  expect(
    screen.getByRole("img", { name: "Hero photo" }).className,
  ).not.toContain("border-dashed");
});
