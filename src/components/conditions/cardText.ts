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
