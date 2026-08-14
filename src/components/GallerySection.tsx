import { GalleryRow } from "./GalleryRow";
import { Placeholder } from "./Placeholder";

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
    // Surface lives on the SnapSection wrapping this, so it fills the stop
    // rather than only the height of the content.
    <section className="py-section-sm md:py-0">
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
      {/* The row is driven by the reader, not by a clock: a piece of artwork
          you want to look at should not slide away, and one you missed
          should be one press back. */}
      <GalleryRow label="Artwork from Wild Coast Kids classes">
        {GALLERY_IMAGES.map((label) => (
          <Placeholder
            key={label}
            label={label}
            /* Tiles are a fraction of the row rather than a fixed size, so a
               whole number of them is visible at every width and they grow
               to fill the stop: two from md, three from lg, four from xl.
               The subtraction in each calc is the gap-4 between them. */
            className="rounded-thumb aspect-4/3 w-[85%] shrink-0 snap-start overflow-hidden md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]"
            labelClassName="whitespace-normal"
          />
        ))}
      </GalleryRow>
    </section>
  );
}
