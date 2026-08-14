import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import { SnapSection } from "./SnapSection";

// jsdom applies no stylesheets, so the class contract is the seam, as in
// StripTrack.test.tsx.

test("a section is a snap stop a screen tall, from md up", () => {
  const { container } = render(
    <SnapSection>
      <p>content</p>
    </SnapSection>,
  );

  const section = container.firstElementChild;
  expect(section?.className).toContain("md:snap-start");
  expect(section?.className).toContain(
    "md:min-h-[calc(100dvh-var(--spacing-nav))]",
  );
});

test("nothing is forced below md", () => {
  const { container } = render(
    <SnapSection>
      <p>content</p>
    </SnapSection>,
  );

  // Two of the landing page's sections are taller than a phone viewport, so
  // a phone gets an ordinary page: every class here is md-scoped.
  const classes = container.firstElementChild?.className.split(/\s+/) ?? [];
  expect(classes.length).toBeGreaterThan(0);
  for (const className of classes) {
    expect(className.startsWith("md:")).toBe(true);
  }
});

test("a natural section keeps its own height but stays a stop", () => {
  const { container } = render(
    <SnapSection natural>
      <p>content</p>
    </SnapSection>,
  );

  // The closing section, so the footer below it shares the screen.
  const section = container.firstElementChild;
  expect(section?.className).toContain("md:snap-start");
  expect(section?.className).not.toContain("md:min-h-");
});

test("a section can carry an anchor target", () => {
  const { container } = render(
    <SnapSection id="community">
      <p>content</p>
    </SnapSection>,
  );

  expect(container.querySelector("section#community")).not.toBeNull();
});
