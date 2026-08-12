import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

test("the home route renders a main landmark", () => {
  render(<Home />);

  // getByRole asserts the landmark is reachable the way a screen reader finds
  // it, not merely that some element was constructed.
  expect(screen.getByRole("main")).toBeDefined();
});
