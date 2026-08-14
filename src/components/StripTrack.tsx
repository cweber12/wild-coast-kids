"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* The track computes its duration from its own width, so the speed stays the
   same pixels-per-second however wide the content gets. This used to keep two
   strips in sync; the gallery now moves only when the reader moves it, so the
   marquee is the only caller left. */
const SPEED_PX_PER_SECOND = 80;

type StripTrackProps = {
  children: ReactNode;
};

/**
 * The looping-strip mechanic: children render twice side by side and the
 * track translates by -50%, so the loop is seamless. The duplicate copy is
 * aria-hidden — assistive tech hears the content once. The parent supplies
 * `group` and `overflow-hidden`; hovering the parent pauses the animation,
 * and prefers-reduced-motion stops it entirely.
 *
 * One caller, `Marquee`. This module was justified by having two, so the
 * seam it sits at is now hypothetical rather than real — kept because the
 * mechanic is genuinely intricate, not because anything varies across it.
 * If the marquee ever goes, this goes with it rather than waiting for a
 * second caller that is not coming.
 */
export function StripTrack({ children }: StripTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      const half = track.scrollWidth / 2;
      if (half > 0) setDuration(half / SPEED_PX_PER_SECOND);
    };

    measure();
    // The webfont changes text width when it lands; measure again after it
    // (document.fonts is absent in jsdom, hence the optional chain).
    document.fonts?.ready.then(measure);
  }, []);

  return (
    <div
      ref={trackRef}
      className="animate-strip flex w-max whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:animate-none"
      style={
        duration === null ? undefined : { animationDuration: `${duration}s` }
      }
    >
      <div className="flex shrink-0">{children}</div>
      <div aria-hidden="true" className="flex shrink-0">
        {children}
      </div>
    </div>
  );
}
