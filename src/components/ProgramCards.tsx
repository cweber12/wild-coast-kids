import { PillLink } from "./ui/PillLink";
import { Placeholder } from "./ui/Placeholder";

const COOP_ACTIVITIES = [
  { emoji: "🌊", name: "Tidepools" },
  { emoji: "🌿", name: "Hikes" },
  { emoji: "📓", name: "Nature Journal" },
  { emoji: "🔬", name: "Science" },
];

/* p-7, not the p-9 this started at: a card has to come in under the 540px a
   stop budgets (issue #37), and 16px of padding is the cheapest of the three
   places that height was hiding. */
const CARD_BASE =
  "rounded-card relative flex min-h-[520px] flex-col justify-between overflow-hidden p-7 transition-transform duration-fast hover:-translate-y-1";

/* leading-none on a decorative glyph: at text-[44px] the default line box
   renders 66px tall, so 22px of the card's height was line-height around an
   emoji. Nothing moves visually. */
const CARD_EMOJI = "mb-4 block text-[44px] leading-none";

export function ProgramCards() {
  return (
    <div className="px-gutter-sm pb-section-sm md:px-gutter stops:pb-0">
      <div className="grid gap-4 md:grid-cols-2">
        <article className={`${CARD_BASE} bg-purple`}>
          <Placeholder
            background
            label="Art classes background"
            className="absolute inset-0 opacity-28"
          />
          <p
            aria-hidden="true"
            className="absolute top-7 right-7 text-xs font-extrabold tracking-wider text-white/35"
          >
            [ 01 ]
          </p>
          <div className="relative z-10 flex flex-col">
            <span aria-hidden="true" className={CARD_EMOJI}>
              🎨
            </span>
            <h2 className="text-card leading-display mb-2 font-black text-white italic">
              Art
              <br />
              Classes
            </h2>
            <p className="mb-3.5 text-xs font-extrabold tracking-wider text-yellow uppercase">
              In-person · Group & Private · K–8
            </p>
            {/* Both sentences are `/art`'s lead paragraph, word for word. The
                card is the teaser for that page, so when the page's emphasis
                moves the card follows — it said "Every session is different"
                until #105, which reads as the weaker half of what the page
                actually claims: the technique is shared and only the results
                differ. Keep the two in step; they are duplicated literals, and
                nothing enforces it (#113). */}
            <p className="leading-normal mb-4.5 max-w-[340px] text-sm text-white/90">
              Watercolors, ink, collage, printmaking — inspired by the coast and
              whatever sparks curiosity. Every class teaches a real technique,
              and nobody goes home with the same picture.
            </p>
            {/* "Outdoors" was here until #105. The co-op is the outdoor
                program; this one is studio work "inspired by the coast", which
                is not the same claim. The entry price replaces it rather than
                joining it, because the card is the one surface that linked to
                `/book` while saying nothing about what a class costs.
                `$20` is `TIERS[0].price` in `src/app/art/page.tsx` — the
                source of truth, and the other half of #113. */}
            <div className="mb-5.5 flex flex-wrap gap-2">
              <span className="rounded-pill bg-white/15 px-[13px] py-[5px] text-2xs font-extrabold tracking-wide text-white">
                All levels
              </span>
              <span className="rounded-pill bg-white/15 px-[13px] py-[5px] text-2xs font-extrabold tracking-wide text-white">
                $20 drop-in
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <PillLink href="/book" tone="yellow">
                Book a class →
              </PillLink>
              <PillLink href="/art" tone="outline-light">
                Learn more →
              </PillLink>
            </div>
          </div>
        </article>

        <article className={`${CARD_BASE} bg-ocean`}>
          <Placeholder
            background
            label="Tuesday co-op background"
            className="absolute inset-0 opacity-28"
          />
          <p
            aria-hidden="true"
            className="absolute top-7 right-7 text-xs font-extrabold tracking-wider text-white/35"
          >
            [ 02 ]
          </p>
          <div className="relative z-10 flex flex-col">
            <span aria-hidden="true" className={CARD_EMOJI}>
              🌿
            </span>
            <h2 className="text-card leading-display mb-2 font-black text-white italic">
              Tuesday
              <br />
              Co-op
            </h2>
            <p className="mb-3.5 text-xs font-extrabold tracking-wider text-yellow uppercase">
              Tuesdays · 10am – 1pm · Fall 2026
            </p>
            <ul className="mb-4.5 grid grid-cols-2 gap-2">
              {COOP_ACTIVITIES.map(({ emoji, name }) => (
                <li
                  key={name}
                  className="rounded-tile bg-white/12 p-2.5 text-center"
                >
                  <span aria-hidden="true" className="mb-1 block text-[22px]">
                    {emoji}
                  </span>
                  <span className="text-2xs font-extrabold text-white">
                    {name}
                  </span>
                </li>
              ))}
            </ul>
            <p className="leading-normal mb-4.5 max-w-[340px] text-sm text-white/90">
              Exploring San Diego&apos;s wild coast through science, journaling
              and hands-on discovery. Spots limited for fall.
            </p>
            <div className="flex flex-wrap gap-3">
              <PillLink href="#community" tone="yellow">
                Join the interest list →
              </PillLink>
              <PillLink href="/coop" tone="outline-light">
                Learn more →
              </PillLink>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
