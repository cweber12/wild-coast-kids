import { NavLink } from "./NavLink";
import { Placeholder } from "./Placeholder";

// Entries flip from landing-section anchors to routes as each page lands
// (docs/plans/nav-pages-scaffolding.md).
const SECTION_LINKS = [
  { href: "/art", label: "Art Classes" },
  { href: "#coop", label: "Tuesday Co-op" },
  { href: "#conditions", label: "Conditions" },
  { href: "#community", label: "Community" },
];

export function Nav() {
  return (
    // Two rows below md — logo and CTA above, links spread beneath — because
    // the four links plus the pill cannot share one 375px row (design
    // review, must-fix). md: restores the template's single row.
    <nav className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-y-2 border-b-2 border-purple bg-cream px-3 py-2.5 md:flex-nowrap md:px-8 md:py-3.5">
      <div className="size-10 shrink-0 overflow-hidden rounded-full md:size-13">
        <Placeholder
          label="Wild Coast Kids logo"
          className="size-full rounded-full"
          labelClassName="min-h-0 p-1 text-[7px] leading-[1.15]"
        />
      </div>
      <div className="order-last flex w-full flex-wrap justify-between gap-x-2 md:order-0 md:w-auto md:flex-nowrap md:justify-start md:gap-7">
        {SECTION_LINKS.map(({ href, label }) => (
          <NavLink
            key={href}
            href={href}
            className="border-b-2 border-transparent pb-0.5 text-[9px] font-extrabold tracking-wider whitespace-nowrap text-dark uppercase transition-colors duration-fast hover:border-yellow aria-[current=page]:border-yellow md:text-2xs"
          >
            {label}
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
