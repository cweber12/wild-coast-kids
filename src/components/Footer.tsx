export function Footer() {
  return (
    // min-h from the footer token: the closing snap stop sizes itself as the
    // window less the nav less this, so the two share one screen exactly.
    <footer className="flex flex-col items-center gap-4 bg-dark p-9 text-center md:min-h-footer md:flex-row md:justify-between md:p-12 md:text-left">
      <div>
        <p className="text-xl font-black text-pink italic">Wild Coast Kids</p>
        <p className="mt-1 text-xs font-semibold text-white/30">
          San Diego · wildcoastkids.com
        </p>
      </div>
      <p className="text-2xs leading-loose font-extrabold tracking-wider text-white/25 uppercase md:text-right">
        Art Classes · Tuesday Co-op
        <br />
        Charter Eligible · K–8
      </p>
    </footer>
  );
}
