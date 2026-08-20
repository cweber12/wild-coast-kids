import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Marquee } from "./Marquee";

test("every phrase appears twice in the DOM for the seamless loop", () => {
  render(<Marquee />);

  expect(screen.getAllByText("Art Classes")).toHaveLength(2);
  expect(screen.getAllByText("K–8")).toHaveLength(2);
});

test("exactly one copy of the track is exposed to assistive tech", () => {
  render(<Marquee />);

  const copies = screen.getAllByText("Tidepools");
  const hiddenCopies = copies.filter((el) =>
    el.closest('[aria-hidden="true"]'),
  );
  expect(hiddenCopies).toHaveLength(1);
  expect(copies.length - hiddenCopies.length).toBe(1);
});
