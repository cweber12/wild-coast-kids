import { Placeholder } from "./Placeholder";

const SECTION_LINKS = [
  { href: "#art", label: "Art Classes" },
  { href: "#coop", label: "Tuesday Co-op" },
  { href: "#conditions", label: "Conditions" },
  { href: "#community", label: "Community" },
];

export function Nav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-2 border-b-2 border-purple bg-cream px-3 py-3 md:px-8 md:py-3.5">
      <div className="size-10 shrink-0 overflow-hidden rounded-full md:size-13">
        <Placeholder
          label="Wild Coast Kids logo"
          className="size-full rounded-full"
          labelClassName="min-h-0 p-1 text-[7px] leading-[1.15]"
        />
      </div>
      <div className="flex gap-2 md:gap-7">
        {SECTION_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className="border-b-2 border-transparent pb-0.5 text-[9px] font-extrabold tracking-wider text-dark uppercase transition-colors duration-fast hover:border-yellow md:text-2xs"
          >
            {label}
          </a>
        ))}
      </div>
      {/* Slimmer below md — at full size the pill clipped off-screen at 375px. */}
      <a
        href="#art"
        className="rounded-pill shrink-0 bg-yellow px-3 py-2 text-2xs font-black tracking-[0.06em] whitespace-nowrap text-ink md:px-5.5 md:py-2.25 md:text-xs"
      >
        Book Now →
      </a>
    </nav>
  );
}
