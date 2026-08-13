import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReservedSlot } from "./ReservedSlot";

test("the headline and the detail both reach the reader", () => {
  render(
    <ReservedSlot
      emoji="🗓️"
      headline="Online booking coming soon."
      detail="The scheduler embeds here once a booking provider is chosen."
    />,
  );

  expect(screen.getByText(/online booking coming soon/i)).toBeDefined();
  expect(screen.getByText(/the scheduler embeds here/i)).toBeDefined();
});

test("the emoji is decoration, not content", () => {
  const { container } = render(
    <ReservedSlot emoji="🌊" headline="Coming soon." detail="Lands here." />,
  );

  // A screen reader announcing "wave" before every one of these would be
  // noise; the headline already says what the slot is for.
  const emoji = container.querySelector("span");
  expect(emoji?.textContent).toBe("🌊");
  expect(emoji?.getAttribute("aria-hidden")).toBe("true");
});

test("the tone follows the surface the slot sits on", () => {
  const { container: light } = render(
    <ReservedSlot emoji="🎨" headline="Soon." detail="Here." />,
  );
  const { container: ocean } = render(
    <ReservedSlot emoji="🌊" headline="Soon." detail="Here." tone="ocean" />,
  );

  // Two adapters are what make the tone a real variant rather than a
  // hypothetical one: five slots sit on cream, one on the ocean section.
  expect(light.firstElementChild?.className).toContain("border-lavender");
  expect(ocean.firstElementChild?.className).toContain("border-white/20");
});
