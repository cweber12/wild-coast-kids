export function Conditions() {
  return (
    <section
      id="conditions"
      className="px-gutter-sm py-15 grid items-center gap-8 bg-ocean md:grid-cols-2 md:gap-12 md:px-gutter md:py-20"
    >
      <div>
        <h2 className="text-title leading-tight mb-3.5 font-black text-white italic">
          Check
          <br />
          <span className="text-yellow">conditions</span>
          <br />
          first.
        </h2>
        <p className="leading-relaxed text-base text-white/65">
          Real-time surf, tide, wind and visibility for San Diego&apos;s coast —
          built by a local, for families planning tidepool visits and hikes.
        </p>
      </div>
      {/* The reserved slot for the future conditions-tool embed. */}
      <div className="rounded-box border-2 border-dashed border-white/20 bg-white/7 px-8 py-12 text-center">
        <span aria-hidden="true" className="mb-3.5 block text-5xl">
          🌊
        </span>
        <p className="leading-normal text-sm text-white/45">
          Conditions tool coming soon.
          <br />
          <br />
          Drop the URL and it embeds here automatically.
        </p>
      </div>
    </section>
  );
}
