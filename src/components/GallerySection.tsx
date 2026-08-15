import { GalleryRow } from "./GalleryRow";
import { Placeholder } from "./Placeholder";
import { GALLERY_IMAGES, type GalleryAspect } from "./galleryImages";

/* What a tile's aspect costs it in width. Two 4:3 tiles and one 16:9 share a
   row at one height, and 4/3 : 4/3 : 16/9 normalises to exactly 0.3 : 0.3 :
   0.4 — so the shares are the ratios, and the three tiles come out the same
   height without a second rule saying so. The subtraction is the two gap-6
   gaps between them, so a row of three fills the container exactly — Tailwind
   emits these as `width: calc(30% - .9rem)` and `calc(40% - 1.2rem)`.

   The shares only apply from lg, where three tiles share a screenful. Below
   that the row shows one tile at a time at 85% with the next peeking, and the
   wide ones are simply shorter. */
const TILE_ASPECT_CLASSES: Record<GalleryAspect, string> = {
  tall: "aspect-4/3 lg:w-[calc((100%-3rem)*0.3)]",
  wide: "aspect-video lg:w-[calc((100%-3rem)*0.4)]",
};

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
        {GALLERY_IMAGES.map(({ label, aspect }) => (
          <Placeholder
            key={label}
            label={label}
            /* self-center rather than the flex default: stretch forces a
               height, which makes aspect-ratio yield nothing and pulls the
               16:9 tiles up to the height of the 4:3 ones. Centred, the row
               takes its height from its tallest tile and a swipe past a wide
               one does not make the page jump. It sits here rather than as
               items-center on the row because GalleryRow owns no tile
               geometry. */
            className={`rounded-thumb w-[85%] shrink-0 snap-start self-center overflow-hidden ${TILE_ASPECT_CLASSES[aspect]}`}
            labelClassName="whitespace-normal"
          />
        ))}
      </GalleryRow>
    </section>
  );
}
