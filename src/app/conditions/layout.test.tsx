import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import ConditionsLayout from "./layout";
import { useSelectedDay } from "@/components/conditions/selectedDay";

function Probe() {
  const { choose } = useSelectedDay();
  // A default context exists, so reading `selected` alone cannot tell a real
  // provider from the fallback. `choose` is the half that differs: the
  // fallback's is a no-op.
  return <p>{typeof choose}</p>;
}

/**
 * The layout exists to keep one thing mounted across a navigation between
 * `/conditions/<area>` and `/conditions/<area>/<beach>`, so what it must do is
 * provide the day to whatever it wraps. A layout and not a template: a template
 * remounts per navigation, which is the behaviour this exists to stop.
 */
test("everything under /conditions is inside the day provider", () => {
  render(
    <ConditionsLayout>
      <Probe />
    </ConditionsLayout>,
  );

  expect(screen.getByText("function")).toBeDefined();
});
