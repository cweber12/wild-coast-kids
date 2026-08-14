import { NavLink } from "./NavLink";
import { Placeholder } from "./Placeholder";

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
    <nav className="min-h-nav-sm md:min-h-nav sticky top-0 z-50 flex flex-wrap items-center justify-between gap-y-2 border-b-2 border-purple bg-cream px-3 py-2.5 md:flex-nowrap md:px-8 md:py-3.5">
      <div className="size-10 shrink-0 overflow-hidden rounded-full md:size-13">
        <Placeholder
          label="Wild Coast Kids logo"
          className="size-full rounded-full"
          labelClassName="min-h-0 p-1 text-[7px] leading-[1.15]"
        />
      </div>
      <div className="order-last flex w-full flex-wrap justify-between gap-x-2 md:order-0 md:w-auto md:flex-nowrap md:justify-start md:gap-7">
        {SECTION_LINKS.map(({ href, label }) => (
          // The indicator is a bottom border, and a border is drawn at its
          // own element's box edge. On the anchor it would track the touch
          // target rather than the label; on an inner span it keeps hugging
          // the text however large the target grows. group-* so the whole
          // target lights the underline, not just the glyphs.
          <NavLink
            key={href}
            href={href}
            className="group text-[9px] font-extrabold tracking-wider whitespace-nowrap text-dark uppercase md:text-2xs"
          >
            <span className="border-b-2 border-transparent pb-0.5 transition-colors duration-fast group-hover:border-yellow group-aria-[current=page]:border-yellow">
              {label}
            </span>
          </NavLink>
        ))}
      </div>
      <NavLink
        href="/book"
        className="rounded-pill shrink-0 bg-yellow px-3.5 py-2 text-2xs font-black tracking-[0.06em] whitespace-nowrap text-ink md:px-5.5 md:py-2.25 md:text-xs"
      >
        Book Now →
      </NavLink>
    </nav>
  );
}
