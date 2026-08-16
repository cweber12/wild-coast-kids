import { PillLink } from "./PillLink";
import { Placeholder } from "./Placeholder";

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
        {/* showLabel: without it this slot is invisible over the purple and
            the poster's right half reads as empty (design review, finding 2). */}
        <Placeholder
          background
          showLabel
          label="Hero photo of kids exploring the coast"
          className="absolute inset-0 bg-white/5"
          labelClassName="text-white/40"
        />
        {/* Blends the photo edge into the purple text column, as in the
            template's hero-photo::after gradient. */}
        <div className="absolute inset-0 bg-linear-to-r from-purple from-28% via-purple/15 via-60% to-transparent" />
      </div>
      <p className="absolute bottom-9 left-6 z-10 text-2xs font-bold tracking-[0.12em] text-white/35 uppercase md:left-12">
        San Diego, CA · K–8
      </p>
    </section>
  );
}
