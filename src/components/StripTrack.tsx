"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* One shared speed keeps the marquee and the gallery strip visually in sync:
   each track computes its own duration from its own width, so both move at
   the same pixels-per-second no matter how wide their content is. */
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
