import Link from "next/link";
import type { ReactNode } from "react";

export type PillTone =
  "yellow" | "purple" | "ocean" | "outline-light" | "outline-dark";

/* Solid and outline pills carry different padding so their outer boxes match:
   the outline's 2px border makes up the difference. That pairing was already
   right on the program cards and wrong in the hero, which is the drift this
   module removes. */
const TONES: Record<PillTone, string> = {
  yellow: "bg-yellow px-7 py-3.25 font-black text-ink",
  purple:
    "bg-purple px-7 py-3.25 font-black text-white transition-colors duration-fast hover:bg-purple-deep",
  ocean: "bg-ocean px-7 py-3.25 font-black text-white",
  "outline-light":
    "border-2 border-white/50 px-6.5 py-2.75 font-bold text-white",
  "outline-dark": "border-2 border-lavender px-6.5 py-2.75 font-bold text-dark",
};

type PillLinkProps = {
  href: string;
  /** Picks the surface the pill sits on. The list is closed on purpose. */
  tone: PillTone;
  children: ReactNode;
};

/**
 * The site's call-to-action shape: a fully-rounded link.
 *
 * The interface is a destination and a tone, and nothing else. Growing a
 * className escape hatch or a size axis would put geometry back in the
 * interface, which is what left eleven call sites writing five different
 * paddings for the same idea. Callers that need spacing around a pill wrap
 * it; they do not reach through it.
 *
 * Hash destinations go through next/link like any other href — it renders a
 * plain anchor and same-page hashes work.
 */
export function PillLink({ href, tone, children }: PillLinkProps) {
  return (
    <Link
      href={href}
      className={`rounded-pill inline-block text-sm ${TONES[tone]}`}
    >
      {children}
    </Link>
  );
}
