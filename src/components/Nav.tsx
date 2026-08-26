import { NavLink } from "./NavLink";
import { Placeholder } from "./ui/Placeholder";
import { TOUCH_TARGET } from "./ui/touchTarget";

// Every interactive element in the bar composes the shared floor, because the
// failure this repo has is drift -- a link added later without it. The
// constant carries the number only; `flex items-center` is the nav's own
// layout, and PillLink needs a different one. See touchTarget.ts.
const NAV_TARGET = `${TOUCH_TARGET} flex items-center`;

const SECTION_LINKS = [
  { href: "/art", label: "Art Classes" },
  { href: "/coop", label: "Tuesday Co-op" },
  { href: "/conditions", label: "Conditions" },
  { href: "/community", label: "Community" },
];

export function Nav() {
  return (
    // Two rows below md — logo and CTA above, links spread beneath — because
    // the four links plus the pill cannot share one 375px row (design
    // review, must-fix). md: restores the template's single row.
    // sticky, not fixed: the nav occupies its own space, so no page has to
    // reserve any for it. min-h comes from the nav tokens, which is what
    // makes the hero's height and scroll-padding-top right by construction.
    <nav className="min-h-nav-sm md:min-h-nav px-gutter-sm sticky top-0 z-50 flex flex-wrap items-center justify-between gap-y-3 border-b-2 border-purple bg-cream py-2 md:flex-nowrap md:px-8 md:py-3.5">
      <div className="size-10 shrink-0 overflow-hidden rounded-full md:size-13">
        <Placeholder
          label="Wild Coast Kids logo"
          className="size-full rounded-full"
          labelClassName="min-h-0 p-1 text-[7px] leading-[1.15]"
        />
      </div>
      {/* -mx-1.5 cancels the links' own padding at the ends of the row, so the
          first and last labels stay flush with the gutter while their boxes
          reach past it. Below md the boxes meet; the padding and the negative
          margin both reset at md, where the row has room and 44px of height
          already clears the 24px pointer floor. Wrapping to a third row below
          ~340px is deliberate -- see ADR-0004. */}
      <div className="order-last -mx-1.5 flex w-full flex-wrap justify-between md:order-0 md:mx-0 md:w-auto md:flex-nowrap md:justify-start md:gap-7">
        {SECTION_LINKS.map(({ href, label }) => (
          // The indicator is a bottom border, and a border is drawn at its
          // own element's box edge. On the anchor it would track the touch
          // target rather than the label; on an inner span it keeps hugging
          // the text however large the target grows. group-* so the whole
          // target lights the underline, not just the glyphs.
          <NavLink
            key={href}
            href={href}
            className={`${NAV_TARGET} group px-1.5 text-[9px] font-extrabold tracking-wider whitespace-nowrap text-dark uppercase md:px-0 md:text-2xs`}
          >
            <span className="border-b-2 border-transparent pb-0.5 transition-colors duration-fast group-hover:border-yellow group-aria-[current=page]:border-yellow">
              {label}
            </span>
          </NavLink>
        ))}
      </div>
      {/* md:min-h-0 because the pill is a visible shape, not just a hit area:
          at md the same 44px would grow the yellow capsule from ~31px, which
          is a redesign rather than a fix. ~31px already clears the pointer
          floor (ADR-0004). */}
      <NavLink
        href="/book"
        className={`${NAV_TARGET} rounded-pill shrink-0 bg-yellow px-3.5 text-2xs font-black tracking-[0.06em] whitespace-nowrap text-ink md:min-h-0 md:px-5.5 md:py-2.25 md:text-xs`}
      >
        Book Now →
      </NavLink>
    </nav>
  );
}
