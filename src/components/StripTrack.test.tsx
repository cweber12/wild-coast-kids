import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import { StripTrack } from "./StripTrack";

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
