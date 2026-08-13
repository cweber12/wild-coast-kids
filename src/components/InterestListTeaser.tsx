import Link from "next/link";
import { InterestListForm } from "./InterestListForm";

/**
 * The landing page's interest-list teaser: the pitch, a link on to the fuller
 * /community page, and the form itself alongside.
 *
 * The teaser and the form are separate modules because /community renders the
 * form without this teaser. Rendering the whole section there put the "Meet
 * the community" link on the page it points at.
 */
export function InterestListTeaser() {
  return (
    <section
      id="community"
      className="px-gutter-sm py-section-sm grid items-start gap-10 md:grid-cols-2 md:gap-20 md:px-gutter md:py-section"
    >
      <div>
        <h2 className="text-title leading-display mb-4 font-black italic">
          Stay in
          <br />
          the <span className="text-purple">loop.</span>
        </h2>
        <p className="leading-relaxed mb-6 text-base text-fog">
          Drop your info and we&apos;ll reach out with new classes, co-op
          updates and coastal adventures.
        </p>
        <Link
          href="/community"
          className="rounded-pill inline-block border-2 border-lavender px-[24px] py-[10px] text-sm font-bold text-dark"
        >
          Meet the community →
        </Link>
      </div>
      <InterestListForm />
    </section>
  );
}
