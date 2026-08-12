export function QuoteStats() {
  return (
    <section className="border-lavender px-gutter-sm py-section-sm grid items-center gap-8 border-y-[1.5px] md:grid-cols-2 md:gap-12 md:px-gutter md:py-section">
      <figure>
        <blockquote className="text-quote leading-[1.25] font-black italic">
          “My daughter now notices every tidepool we walk past.
          <br />
          <span className="text-purple">She sketches everything.”</span>
        </blockquote>
        <figcaption className="mt-5 text-xs font-bold tracking-wider text-purple uppercase">
          — Parent, Wild Coast Kids
        </figcaption>
      </figure>
      <div className="flex flex-col gap-3">
        <div className="rounded-thumb bg-yellow px-6 py-5">
          <p className="text-stat leading-none mb-1 font-black text-ink italic">
            K–8
          </p>
          <p className="text-xs font-bold text-black/50">All ages welcome</p>
        </div>
        <div className="rounded-thumb bg-purple px-6 py-5">
          <p className="text-stat leading-none mb-1 font-black text-yellow italic">
            Charter ✓
          </p>
          <p className="text-xs font-bold text-white/60">
            Fund eligible programs
          </p>
        </div>
      </div>
    </section>
  );
}
