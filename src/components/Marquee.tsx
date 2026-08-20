import { StripTrack } from "./StripTrack";

const PHRASES = [
  "Art Classes",
  "Tidepools",
  "Nature Journal",
  "Hikes",
  "Science",
  "San Diego",
  "K–8",
];

export function Marquee() {
  return (
    <div className="group overflow-hidden border-y-2 border-dark bg-yellow py-3.5">
      <StripTrack>
        {PHRASES.map((phrase) => (
          <span
            key={phrase}
            className="flex items-center text-base font-black tracking-wider text-ink uppercase"
          >
            <span className="px-7">{phrase}</span>
            <span aria-hidden="true" className="px-1.5 text-purple">
              ✦
            </span>
          </span>
        ))}
      </StripTrack>
    </div>
  );
}
