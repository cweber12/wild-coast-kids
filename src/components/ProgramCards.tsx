import Link from "next/link";
import { Placeholder } from "./Placeholder";

const COOP_ACTIVITIES = [
  { emoji: "🌊", name: "Tidepools" },
  { emoji: "🌿", name: "Hikes" },
  { emoji: "📓", name: "Nature Journal" },
  { emoji: "🔬", name: "Science" },
];

const CARD_BASE =
  "rounded-card relative flex min-h-[520px] flex-col justify-between overflow-hidden p-9 transition-transform duration-fast hover:-translate-y-1";

export function ProgramCards() {
  return (
    <div className="px-gutter-sm pb-section-sm md:px-gutter md:pb-section">
      <div className="grid gap-4 md:grid-cols-2">
        <article id="art" className={`${CARD_BASE} bg-purple`}>
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
            <span aria-hidden="true" className="mb-4 block text-[44px]">
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
            <p className="leading-normal mb-4.5 max-w-[340px] text-sm text-white/90">
              Watercolors, ink, collage, printmaking — inspired by the coast and
              whatever sparks curiosity. Every session is different.
            </p>
            <div className="mb-5.5 flex flex-wrap gap-2">
              <span className="rounded-pill bg-yellow px-[13px] py-[5px] text-2xs font-extrabold tracking-wide text-ink">
                Charter eligible
              </span>
              <span className="rounded-pill bg-white/15 px-[13px] py-[5px] text-2xs font-extrabold tracking-wide text-white">
                All levels
              </span>
              <span className="rounded-pill bg-white/15 px-[13px] py-[5px] text-2xs font-extrabold tracking-wide text-white">
                Outdoors
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/book"
                className="rounded-pill bg-yellow px-[26px] py-3 text-sm font-black text-ink"
              >
                Book a class →
              </Link>
              <Link
                href="/art"
                className="rounded-pill border-2 border-white/50 px-[24px] py-[10px] text-sm font-bold text-white"
              >
                Learn more →
              </Link>
            </div>
          </div>
        </article>

        <article id="coop" className={`${CARD_BASE} bg-ocean`}>
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
            <span aria-hidden="true" className="mb-4 block text-[44px]">
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
                  className="rounded-tile bg-white/12 p-3 text-center"
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
              <a
                href="#community"
                className="rounded-pill bg-yellow px-[26px] py-3 text-sm font-black text-ink"
              >
                Join interest list →
              </a>
              <Link
                href="/coop"
                className="rounded-pill border-2 border-white/50 px-[24px] py-[10px] text-sm font-bold text-white"
              >
                Learn more →
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
