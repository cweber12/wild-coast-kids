/**
 * 44px, per ADR-0004: the touch-target floor below `md`.
 *
 * The number, and nothing else. The failure this repo has is drift -- an
 * interactive element added later without the floor -- and one name is one
 * place to be wrong. Display stays with the caller because it is genuinely
 * per-context: a nav link is a `flex` row item, a pill is `inline-flex` and
 * has to stay inline-level or it fills its container. A constant carrying
 * `flex` could not serve both, and spelling the number twice to serve the
 * second is the drift this exists to stop.
 *
 * Composing it does not prove the rendered box is 44px -- jsdom applies no
 * stylesheets (ADR-0001) -- so tests assert that an element refers to the
 * standard, and a human confirms it holds.
 *
 * Elements that are a visible shape add `md:min-h-0`: growing them above `md`
 * is a redesign, and they already clear the 24px pointer floor there.
 */
export const TOUCH_TARGET = "min-h-11";
