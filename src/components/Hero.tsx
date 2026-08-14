import { PillLink } from "./PillLink";
import { Placeholder } from "./Placeholder";

export function Hero() {
  return (
    <section className="relative grid flex-1 overflow-hidden bg-purple pb-15 md:grid-cols-2 md:pb-0">
      <div className="relative z-10 col-start-1 row-start-1 flex flex-col justify-center px-6 pt-5 md:px-12 md:py-15">
        <p className="mb-7 text-2xs font-extrabold tracking-widest text-yellow uppercase">
          📍 San Diego · K–8 · Outdoors
        </p>
        <h1 className="text-display leading-display mb-8 font-black text-cream italic">
          Kids who
          <br />
          make,
          <span className="block text-yellow">wonder.</span>
        </h1>
        {/* white/90, up from the template's /70: 4.79:1 vs a failing 3.60:1 */}
        <p className="leading-relaxed mb-9 max-w-80 text-base text-white/90">
          Art classes and outdoor co-op rooted in the California coast. Charter
          fund eligible.
        </p>
        <div className="flex flex-wrap gap-3">
          <PillLink href="#art" tone="yellow">
            🎨 Book Art Class
          </PillLink>
          <PillLink href="#coop" tone="outline-light">
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
