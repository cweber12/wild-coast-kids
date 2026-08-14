import { PillLink } from "./PillLink";
import { ReservedSlot } from "./ReservedSlot";

export function Conditions() {
  return (
    <section
      id="conditions"
      className="px-gutter-sm py-section-sm grid items-center gap-8 bg-ocean md:grid-cols-2 md:gap-12 md:px-gutter md:py-0"
    >
      <div>
        <h2 className="text-title leading-tight mb-3.5 font-black text-white italic">
          Check
          <br />
          <span className="text-yellow">conditions</span>
          <br />
          first.
        </h2>
        <p className="leading-relaxed mb-6 text-base text-white/65">
          Real-time surf, tide, wind and visibility for San Diego&apos;s coast —
          built by a local, for families planning tidepool visits and hikes.
        </p>
        <PillLink href="/conditions" tone="outline-light">
          Learn more →
        </PillLink>
      </div>
      <ReservedSlot
        emoji="🌊"
        headline="Conditions tool coming soon."
        detail="Drop the URL and it embeds here automatically."
        tone="ocean"
      />
    </section>
  );
}
