"use client";

import Image from "next/image";

import { GalleryPager } from "./GalleryPager";
import { GalleryRow } from "./GalleryRow";
import { useGalleryPaging } from "./useGalleryPaging";
import { GALLERY_IMAGES, type GalleryAspect } from "./galleryImages";

/* What a tile's aspect costs it in width, and what the browser needs to pick a
   file for it.

   The width share: two 4:3 tiles and one 16:9 share a row at one height, and
   4/3 : 4/3 : 16/9 normalises to exactly 0.3 : 0.3 : 0.4 — so the shares are
   the ratios, and the three tiles come out the same height without a second
   rule saying so. The subtraction is the two gap-6 gaps between them, so a row
   of three fills the container exactly — Tailwind emits these as
   `width: calc(30% - .9rem)` and `calc(40% - 1.2rem)`.

   The shares only apply from lg, where three tiles share a screenful. Below
   that the row shows one tile at a time at 85% with the next peeking, and the
   wide ones are simply shorter. `sizes` says the same thing a second time in
   the units the preload scanner reads, and `lg` there is spelled as its pixel
   value because a media query cannot see a Tailwind breakpoint.

   `width`/`height` are the tile's ratio rather than the file's. Nothing lays
   out from them — the classes above set the width and `aspect-*` sets the
   height — so what they are for is the ratio Next reserves before the bytes
   arrive, and reserving the file's shape would make every tile jump on load. */
const TILE_ASPECT: Record<
  GalleryAspect,
  { className: string; sizes: string; width: number; height: number }
> = {
  tall: {
    className: "aspect-4/3 lg:w-[calc((100%-3rem)*0.3)]",
    sizes: "(min-width: 1024px) 30vw, 85vw",
    width: 1200,
    height: 900,
  },
  wide: {
    className: "aspect-video lg:w-[calc((100%-3rem)*0.4)]",
    sizes: "(min-width: 1024px) 40vw, 85vw",
    width: 1600,
    height: 900,
  },
};

/* Ties the pager to the row it drives. The two no longer sit together in the
   DOM, so the relationship is stated rather than positional. */
const GALLERY_ROW_ID = "gallery-row";

export function GallerySection() {
  /* The section is a client component because it holds the paging seam the
     row and the pager share. Its own content is static; what is hydrated is
     the wiring between the two. */
  const { rowRef, page } = useGalleryPaging();

  return (
    // Surface lives on the SnapSection wrapping this, so it fills the stop
    // rather than only the height of the content.
    <section className="py-section-sm stops:py-0">
      <div className="mb-10 flex flex-col items-start gap-3 px-gutter-sm md:flex-row md:items-end md:justify-between md:px-gutter">
        <h2 className="text-title leading-tight font-black italic">
          What kids
          <br />
          make here.
        </h2>
        {/* Reversed below md so the controls sit nearest the row they drive.
            From md the heading runs to two lines while this column's paragraph
            is one, and the controls take the height that leaves empty — which
            is why moving them off the row costs the stop nothing. */}
        <div className="flex flex-col-reverse gap-3 md:flex-col md:items-end">
          <GalleryPager controls={GALLERY_ROW_ID} page={page} />
          <p className="leading-normal text-sm text-fog md:max-w-50 md:text-right">
            Every class is different.
            <br />
            Every kid surprises us.
          </p>
        </div>
      </div>
      {/* The row is driven by the reader, not by a clock: a piece of artwork
          you want to look at should not slide away, and one you missed
          should be one press back. */}
      <GalleryRow
        id={GALLERY_ROW_ID}
        label="Artwork from Wild Coast Kids classes"
        rowRef={rowRef}
      >
        {GALLERY_IMAGES.map(({ src, alt, aspect, crop }) => (
          <Image
            key={src}
            src={src}
            alt={alt}
            width={TILE_ASPECT[aspect].width}
            height={TILE_ASPECT[aspect].height}
            sizes={TILE_ASPECT[aspect].sizes}
            /* Inline rather than a class, alone in a codebase that has no
               other inline style, because these nine values are content
               rather than design: an arbitrary object-position utility per
               photograph would put nine single-use rules in the stylesheet,
               each usable by exactly one image. Spelling one here would be
               worse than that — @source names src/, and the scanner reads
               comments, so naming the class would compile a tenth rule that
               nothing at all uses. Inline also gives the tests a stronger
               seam: jsdom has no stylesheet to resolve a class against, but
               it reads an inline objectPosition back exactly. */
            style={{ objectPosition: crop }}
            /* self-center rather than the flex default: stretch forces a
               height, which makes aspect-ratio yield nothing and pulls the
               16:9 tiles up to the height of the 4:3 ones. Centred, the row
               takes its height from its tallest tile and a swipe past a wide
               one does not make the page jump. It sits here rather than as
               items-center on the row because GalleryRow owns no tile
               geometry. */
            className={`rounded-thumb w-[85%] shrink-0 snap-start self-center object-cover ${TILE_ASPECT[aspect].className}`}
          />
        ))}
      </GalleryRow>
    </section>
  );
}
