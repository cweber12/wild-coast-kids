/**
 * The two secondary-text roles a reading card has, named once. See ADR-0015.
 *
 * The card is `bg-dark`, so every pairing on it was re-measured: `text-fog` is
 * a colour chosen against `mist` and it is unreadable here. What replaced it is
 * `text-white` at an opacity, which is what the rest of this site already does
 * on a saturated surface -- `Footer` at /30 and /25, `ProgramCards` at /90 and
 * /35, `ReservedSlot`'s ocean tone at /45. A new palette token would have been
 * the other answer and would have meant one convention on this page and a
 * different one everywhere else.
 *
 * Measured against `--color-dark` #1a1a2e:
 *
 * - **`CARD_PROSE`** — white/75, **10.02:1**. The plain-words line every card
 *   carries, and the body of a disclosure. It is the half of the card written
 *   for a parent rather than for a surfer, so it is the one that has to stay
 *   comfortable to read at 13px.
 * - **`CARD_MUTED`** — white/55, **5.96:1**. Provenance lines and stat labels:
 *   present, subordinate, and still clear of the 4.5:1 this page holds itself
 *   to. Not lower -- white/45 is 4.43:1 and would fail, which is the whole
 *   reason these are two named values rather than one guess repeated.
 *
 * Named because the alternative is spelling the same decision seventeen times
 * across three panels, which is the drift `touchTarget.ts` and `headingRank.ts`
 * both exist to stop. The figure and the stat values are not here: they are
 * `text-white` at full strength, which needs no name because it carries no
 * decision.
 */

/** Sentences a reader is meant to read: the plain-words line, a disclosure body. */
export const CARD_PROSE = "text-white/75";

/** Present but subordinate: provenance lines, stat labels. */
export const CARD_MUTED = "text-white/55";

/**
 * The same subordinate role on the page's own ground, where the two above are
 * invisible.
 *
 * **This file is named for the card because that is where these roles started,
 * and one of them has left.** `ProvenanceLine` was a card component; the week
 * grid and the day panel now render it on `--color-cream` directly, and the
 * colour measured against `--color-dark` went with it. White at 55% over cream
 * paints #fdfcfb on #faf8f5 -- **1.03:1**, read off the built page. The line was
 * present, correct, attributed and the same colour as the paper.
 *
 * `text-fog` rather than a new token: #6b5f7d on #faf8f5 is **5.56:1**, it is
 * already this page's subordinate text everywhere else, and inventing a fourth
 * grey would be two names for one decision -- the drift the whole of this
 * file's docstring above is about.
 *
 * The floor these are held to is 4.5:1 and not the 3:1 large-text allowance:
 * every role here renders at 13px or 16px. `cardText.test.ts` computes all four
 * pairings rather than trusting the figures written here, which is what would
 * have caught the invisible line the day it was rendered.
 */
export const PAGE_MUTED = "text-fog";
