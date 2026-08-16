import { InterestListForm } from "./InterestListForm";
import { PillLink } from "./PillLink";

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
    // The #community anchor lives on the SnapSection wrapping this, so the
    // links that target it land on a snap stop rather than mid-section.
    <section className="px-gutter-sm py-section-sm grid items-start gap-10 md:grid-cols-2 md:gap-20 md:px-gutter stops:py-0">
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
        <PillLink href="/community" tone="outline-dark">
          Meet the community →
        </PillLink>
      </div>
      <InterestListForm />
    </section>
  );
}
