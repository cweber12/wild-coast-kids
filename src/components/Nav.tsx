import { Placeholder } from "./Placeholder";

const SECTION_LINKS = [
  { href: "#art", label: "Art Classes" },
  { href: "#coop", label: "Tuesday Co-op" },
  { href: "#conditions", label: "Conditions" },
  { href: "#community", label: "Community" },
];

export function Nav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b-2 border-purple bg-cream px-5 py-3 md:px-8 md:py-3.5">
      <div className="size-[52px] shrink-0 overflow-hidden rounded-full">
        <Placeholder
          label="Wild Coast Kids logo"
          className="size-full rounded-full"
          labelClassName="min-h-0 p-1 text-[7px] leading-[1.15]"
        />
      </div>
      <div className="flex gap-3 md:gap-7">
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
      <a
        href="#art"
        className="rounded-pill bg-yellow px-[22px] py-[9px] text-xs font-black tracking-[0.06em] text-ink"
      >
        Book Now →
      </a>
    </nav>
  );
}
