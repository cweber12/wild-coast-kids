/**
 * A region heading, in the site's display register. See ADR-0014.
 *
 * The site writes headings two ways. The **display register** is
 * `font-black italic` at a size token with `leading-display` -- the `<h1>`,
 * `ProgramCards`' card titles, `QuoteStats`' pull quote. The **label register**
 * is `text-2xs font-extrabold tracking-widest uppercase` in an accent colour --
 * card headings, day headings, stat labels, provenance lines, eyebrows. A
 * region heading had been written both ways depending on which page reached
 * for it first, which left `/conditions` rendering a region, a card inside it
 * and a day inside that at the same 10px.
 *
 * `--text-quote` rather than `--text-card`, the other unused mid token: card
 * clamps to 30px at 375 against the `<h1>`'s 32px, where a region heading would
 * all but equal the page title. Quote is 20px there and 34px at 1536, clear at
 * both ends of the clamp -- and a rank that holds only on a desktop is not a
 * rank.
 *
 * The colour is inherited rather than set, as the `<h1>` inherits it: no new
 * text-on-surface pair, so nothing here is owed a contrast measurement the
 * page has not already taken.
 *
 * Named once because a rank asserted in two places is one of them waiting to
 * drift, which is the argument `touchTarget.ts` makes about a number. It does
 * not prove the rendered rank -- jsdom applies no stylesheets (ADR-0001) -- so
 * tests assert that a region heading refers to this and a card heading does
 * not, and a human confirms the rank is visible.
 */
export const REGION_HEADING =
  "text-quote leading-display mb-4 font-black italic";

/**
 * The same rank, on a page that is a tool rather than a document. ADR-0014 is
 * unaffected: a region heading still outranks a card heading, and this is still
 * the display register against the label one.
 *
 * **Why a second rank rather than a smaller first one.** `REGION_HEADING` is
 * also `/art`'s two section headings and `SessionSchedule`'s, which reaches
 * `/art` and `/coop`. Those pages spread their regions down a document, where a
 * 34px heading is an arrival. `/conditions` stacks three of them inside one
 * scroll -- the week, the day, the notes -- and a reader there is not arriving
 * three times, they are looking for a number. Editing the shared constant would
 * have quietened three pages to answer a complaint only one of them has.
 *
 * **It stays in the display register.** `font-black italic` at a size token
 * with `leading-display`, exactly as the constant above is. The alternative --
 * dropping these three headings to the label register -- is the flat scale
 * ADR-0014 was written to escape, where `/conditions` rendered a region, a card
 * inside it and a day inside that at the same 10px. The rank gets quieter; it
 * does not change kind.
 *
 * **The clamp is legible at both ends, which is the test the constant above
 * sets itself.** 17px at 375 against the conditions `<h1>`'s 24px, and 22px at
 * 1536 against its 36px. `--text-quote` fails that here for the mirror image of
 * the reason `--text-card` failed it there: 34px under a 36px title is not a
 * second rank, it is the same one twice.
 *
 * **`mb-3` rather than `mb-4`.** A smaller heading owns less space beneath it,
 * and 16px under a 22px line reads as a gap rather than as attachment.
 *
 * Like the constant above, this is asserted by reference rather than by
 * rendered size -- jsdom applies no stylesheets (ADR-0001). The token behind it
 * carries a `REQUIRED` row in `scripts/built-css.mjs` instead, because a
 * deleted token leaves `text-tool-region` sitting in the markup where every
 * jsdom test still finds it, compiling to nothing.
 */
export const TOOL_REGION_HEADING =
  "text-tool-region leading-display mb-3 font-black italic";
