/**
 * The colour each reading takes in the week grid, named once.
 *
 * **Colour is per product and never per value, which is what keeps it out of
 * ADR-0009's way.** That decision forbids this site judging whether conditions
 * are good, and ADR-0015 drew the line that matters when it put the reading
 * cards on `bg-dark`: what makes colour a verdict is *differential* colour — a
 * green card and a red one. Every day's swell label is the same purple whether
 * the swell is 0.7 ft or 6 ft, so nothing here asserts anything about the
 * water. A reader gains a way to find one reading across seven columns; they
 * gain no opinion.
 *
 * **Three colours, because there are three readings and no more free ones.**
 * Measured against the cell's `white/60` over the cream page, which computes to
 * about #fdfcfa:
 *
 * - **`TIDE_TONE`** — ocean #1a4e8a, **8.5:1**.
 * - **`SWELL_TONE`** — purple #6b5faa, **5.3:1**.
 * - **`CLOUD_TONE`** — fog #6b5f7d, **5.0:1**, and the colour every label in
 *   this grid used to be. Cloud keeps it rather than taking a third saturated
 *   hue: pink is 2.1:1 here and yellow is unreadable on any pale surface, so
 *   the palette has exactly two label colours to spend and this is the row that
 *   does not need one. It is also the row that is an average rather than an
 *   extreme, so the odd one out is the right one to leave in the neutral.
 *
 * All three clear the 4.5:1 this page holds itself to.
 *
 * **Named here rather than beside each label**, because the argument above is
 * one argument about a set and not three unrelated colour choices. Spelling it
 * three times is the drift `cardText.ts`, `headingRank.ts` and `touchTarget.ts`
 * each exist to stop — and a fourth reading joining the grid needs to find the
 * measurement before picking a colour, which it can only do if the set lives
 * somewhere.
 *
 * A utility class rather than a token, for the reason `cardText.ts` gives: a
 * new palette entry would mean one convention on this page and a different one
 * everywhere else on the site.
 */

/** The lowest tide the daylight window reaches. */
export const TIDE_TONE = "text-ocean";

/** The biggest swell the daylight window reaches. */
export const SWELL_TONE = "text-purple";

/** The mean cloud across the daylight window. */
export const CLOUD_TONE = "text-fog";
