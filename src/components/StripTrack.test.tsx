import { expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import { StripTrack } from "./StripTrack";

test("the duration comes from the track's own width", () => {
  // jsdom has no layout, so scrollWidth is 0 and the measurement is skipped
  // on every other test in this file. Stubbing it is the only way to reach
  // the behaviour the module exists for: whatever the content's width, the
  // strip moves at one shared pixels-per-second.
  const width = vi
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockReturnValue(1600);

  const { container } = render(
    <StripTrack>
      <span>content</span>
    </StripTrack>,
  );

  // Two copies of the children, so half the track is 800px; at 80px/s that
  // is a ten-second loop.
  const track = container.firstElementChild as HTMLElement;
  expect(track.style.animationDuration).toBe("10s");

  width.mockRestore();
});

test("the track carries the pause and reduced-motion utilities", () => {
  // jsdom applies no stylesheets, so the seam here is the class contract:
  // the animation utility, the hover pause, and the reduced-motion stop
  // must all sit on the moving track.
  const { container } = render(
    <StripTrack>
      <span>content</span>
    </StripTrack>,
  );

  const track = container.firstElementChild;
  expect(track?.className).toContain("animate-strip");
  expect(track?.className).toContain(
    "group-hover:[animation-play-state:paused]",
  );
  expect(track?.className).toContain("motion-reduce:animate-none");
});
