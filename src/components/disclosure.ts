import { TOUCH_TARGET } from "./touchTarget";

/**
 * A `<summary>` grown to the touch-target floor without losing its marker.
 *
 * Every disclosure on the conditions page measured 17px tall -- `text-sm` at
 * Montserrat's normal line-height, and nothing else. They were the only
 * interactive elements on that page under 44px, and the design review that
 * found them is the third to report a touch target here. ADR-0004 exists
 * because the first two were filed as style notes and nothing happened.
 *
 * **The display is deliberately left alone.** `Nav` composes the floor with
 * `flex` and `PillLink` with `inline-flex`, and either one here would take the
 * disclosure triangle with it: the marker comes from the UA stylesheet's
 * `display: list-item` on `<summary>`, so any other display removes the one
 * thing that says the element opens. This is the per-context display choice
 * `touchTarget.ts` says stays with the caller -- it is just that here the
 * choice is to make none.
 *
 * **The padding is not decoration.** `min-h-11` alone pins a 17px line to the
 * top of a 44px box and leaves 27px of blank under it, which reads as a
 * spacing bug rather than as a target. ADR-0004's reason for growing
 * background-less elements at every breakpoint is that the growth is
 * *invisible*, and that is only true when it is balanced. `py-3` puts 12px
 * either side of the line for 41px and the floor lifts it to 44, so both parts
 * do real work: padding alone would satisfy the number by accident, which is
 * exactly the drift `touchTarget.ts` exists to stop.
 *
 * **No `md:min-h-0`.** ADR-0004: an element with no background takes 44px at
 * every breakpoint, because the box growing is invisible and there is nothing
 * to buy by restricting it. That clause is what separates a summary from
 * `PillLink`, which is a visible shape and does carry the opt-out.
 *
 * Composing this does not prove the rendered box is 44px -- jsdom applies no
 * stylesheets (ADR-0001) -- so tests assert that every summary a component can
 * render refers to the standard, and a human confirms it holds.
 */
export const DISCLOSURE_TARGET = `${TOUCH_TARGET} py-3`;
