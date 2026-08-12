import { Placeholder } from "./Placeholder";
import { StripTrack } from "./StripTrack";

const GALLERY_IMAGES = [
  "Art class at the park",
  "Mixed media art",
  "Neon chalk art",
  "Sunset painting",
  "Watercolor houses",
  "Cactus collage",
  "Pixel art",
  "Kids with artwork",
  "Dinosaur watercolor",
];

export function GallerySection() {
  return (
    <section className="bg-mist py-section-sm md:py-section">
      <div className="mb-10 flex flex-col items-start gap-3 px-gutter-sm md:flex-row md:items-end md:justify-between md:px-gutter">
        <h2 className="text-title leading-tight font-black italic">
          What kids
          <br />
          make here.
        </h2>
        <p className="leading-normal text-sm text-fog md:max-w-50 md:text-right">
          Every class is different.
          <br />
          Every kid surprises us.
        </p>
      </div>
      {/* Full-bleed film strip: single row, moving at the marquee's px/s via
          the shared StripTrack speed. */}
      <div className="group overflow-hidden">
        <StripTrack>
          {GALLERY_IMAGES.map((label) => (
            <Placeholder
              key={label}
              label={label}
              className="rounded-thumb mx-1.5 h-52 w-72 shrink-0 overflow-hidden md:h-56 md:w-80"
              labelClassName="whitespace-normal"
            />
          ))}
        </StripTrack>
      </div>
    </section>
  );
}
