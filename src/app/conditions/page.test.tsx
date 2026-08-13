import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Conditions from "./page";

test("the conditions page exposes its landmark, heading and embed slot", () => {
  render(<Conditions />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("conditions");

  expect(screen.getByText(/conditions tool coming soon/i)).toBeDefined();
});
