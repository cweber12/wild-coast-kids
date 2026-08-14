/* The second quote is invented copy, not a real testimonial — placeholder
   for a parent's own words. Replace before launch. Every other unfinished
   thing on this site announces itself (see ReservedSlot, Placeholder); this
   one deliberately does not, so it needs this comment instead. */
const QUOTES = [
  {
    lead: "“My daughter now notices every tidepool we walk past.",
    tail: "She sketches everything.”",
  },
  {
    lead: "“He used to ask how long until we go home.",
    tail: "Now he asks when we can go back.”",
  },
];

export function QuoteStats() {
  return (
    // border-t only: this section closes the page, so its bottom edge meets
    // the footer rather than another section.
    <section className="border-lavender px-gutter-sm py-section-sm border-t-[1.5px] md:px-gutter md:py-section">
      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {QUOTES.map(({ lead, tail }) => (
          <figure key={lead}>
            <blockquote className="text-quote leading-[1.25] font-black italic">
              {lead}
              <br />
              <span className="text-purple">{tail}</span>
            </blockquote>
            <figcaption className="mt-5 text-xs font-bold tracking-wider text-purple uppercase">
              — Parent, Wild Coast Kids
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-2 md:gap-4">
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
