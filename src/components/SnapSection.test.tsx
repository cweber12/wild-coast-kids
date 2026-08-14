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

test("centring never pushes content off the top of the stop", () => {
  const { container } = render(
    <SnapSection>
      <p>content</p>
    </SnapSection>,
  );

  // Plain justify-center splits overflow across both ends, and the top end
  // of a snap stop cannot be scrolled to — content taller than the box
  // becomes unreachable. The safe variant falls back to start-alignment.
  const section = container.firstElementChild;
  expect(section?.className).toContain("md:justify-center-safe");
  expect(section?.className).not.toMatch(/md:justify-center(?!-safe)/);
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

test("a content-height section keeps its own height but stays a stop", () => {
  const { container } = render(
    <SnapSection height="content">
      <p>content</p>
    </SnapSection>,
  );

  // The hero, which brings its own height and fills the screen at every
  // width rather than only from md up.
  const section = container.firstElementChild;
  expect(section?.className).toContain("md:snap-start");
  expect(section?.className).not.toContain("md:min-h-");
});

test("the closing stop leaves room for the footer", () => {
  const { container } = render(
    <SnapSection height="screen-less-footer">
      <p>content</p>
    </SnapSection>,
  );

  // Both tokens are the ones the nav and footer set their own heights from,
  // so the three agree by construction and nothing measures anything.
  expect(container.firstElementChild?.className).toContain(
    "md:min-h-[calc(100dvh-var(--spacing-nav)-var(--spacing-footer))]",
  );
});

test("the stop carries its own surface", () => {
  const { container: cream } = render(
    <SnapSection>
      <p>content</p>
    </SnapSection>,
  );
  const { container: ocean } = render(
    <SnapSection tone="ocean">
      <p>content</p>
    </SnapSection>,
  );

  // Painting the child instead leaves the colour the height of the content
  // while the stop stays a screen tall — which is how the ocean band ended
  // up with a cream stripe above it.
  expect(cream.firstElementChild?.className).not.toContain("bg-");
  expect(ocean.firstElementChild?.className).toContain("bg-ocean");
});

test("a section can carry an anchor target", () => {
  const { container } = render(
    <SnapSection id="community">
      <p>content</p>
    </SnapSection>,
  );

  expect(container.querySelector("section#community")).not.toBeNull();
});
