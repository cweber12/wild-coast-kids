import Image from "next/image";

import { PillLink } from "./PillLink";

export function Hero() {
  return (
    <section className="relative grid flex-1 overflow-hidden bg-purple pb-15 md:grid-cols-2 md:pb-0">
      {/* md:pt-5 md:pb-14, not the symmetric py-15 this started at. Padding on
          this column is not binding on a tall window — it is justify-center
          inside a cell already `100dvh - nav` tall, so the content is centred
          in the same space whatever the padding — which is why trimming it is
          what let the poster into a 555px stop (issue #37).

          The bottom half is asymmetric on purpose. The "San Diego, CA · K–8"
          line below is absolutely positioned to the section's bottom edge, and
          when the section shrinks to the stop the centred content catches up
          with it and prints straight through the CTA pills. pb-14 reserves the
          51px that line occupies, so the two cannot meet at any window height. */}
      <div className="relative z-10 col-start-1 row-start-1 flex flex-col justify-center px-6 pt-5 md:px-12 md:pt-5 md:pb-14">
        <p className="mb-5 text-2xs font-extrabold tracking-widest text-yellow uppercase">
          📍 San Diego · K–8 · Outdoors
        </p>
        <h1 className="text-display leading-display mb-6 font-black text-cream italic">
          Kids who
          <br />
          make,
          <span className="block text-yellow">wonder.</span>
        </h1>
        {/* white/90, up from the template's /70: 4.79:1 vs a failing 3.60:1 */}
        <p className="leading-relaxed mb-6 max-w-80 text-base text-white/90">
          Art classes and outdoor co-op rooted in the California coast. Charter
          fund eligible.
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Routes, not anchors: both program cards now share one snap
              stop, so #art and #coop would have been the same screen — and
              an anchor onto an element inside a section lands the viewport
              at a non-snap position. */}
          <PillLink href="/book" tone="yellow">
            🎨 Book Art Class
          </PillLink>
          <PillLink href="/coop" tone="outline-light">
            Tuesday Co-op →
          </PillLink>
        </div>
      </div>
      <div className="relative col-start-2 row-start-1 hidden md:block">
        {/* The photograph the Placeholder here stood in for. Its accessible
            name describes this frame rather than inheriting the slot's old
            label — the slot said "kids exploring the coast", and what arrived
            is a class in progress.

            fill + object-cover because the column is a full-height half-width
            box and the frame is 3:2: it takes a centre vertical slice, so the
            instructor and her whiteboard stay in shot at every window height
            and the crop eats the easels at the two edges instead. priority
            because this is the poster, and so the page's LCP element.

            Nothing overlays it. A purple gradient used to blend its left edge
            into the text column, as the reference template's hero did; the
            photograph meets the purple at the column line instead. The text
            column is a grid neighbour rather than an overlay, so no copy
            depends on that wash for contrast.

            The second half of sizes is the width this image occupies below
            `md`, where the column above is `hidden`: none of it. priority
            preloads from the head, which no stylesheet reaches — say `100vw`
            there and a phone downloads 31.5kB of a photograph it never
            displays. 1px, not 0: a source size has to be positive, and it is
            small enough that the browser picks the narrowest candidate. */}
        <Image
          src="/hero-art-class.jpg"
          alt="Kids drawing at easels on the bluff above the beach, the instructor holding up a dragon sketch"
          fill
          priority
          sizes="(min-width: 768px) 50vw, 1px"
          className="object-cover"
        />
      </div>
      <p className="absolute bottom-9 left-6 z-10 text-2xs font-bold tracking-[0.12em] text-white/35 uppercase md:left-12">
        San Diego, CA · K–8
      </p>
    </section>
  );
}
