# Wild Coast Kids

The site for an art-class and outdoor-co-op program for K–8 kids in San Diego.
This file is the project's domain glossary: the words the code, the copy, the
issues and the plans all use for the same things. When two words are in play
for one concept, this file picks one and lists the rest under _Avoid_.

## Language

**Program**:
One of the two things the site offers — art classes, and the Tuesday co-op.
Each has a card on the landing page and a page of its own.
_Avoid_: offering, service, class (a class is one session of the art program)

**Teaser**:
A landing-page section that summarises a topic and links to its full page. The
teaser stays on `/` once the page exists; it is not a copy of the page.
_Avoid_: preview, blurb, summary, excerpt

**Interest list**:
The list a parent joins to hear about new classes and co-op spots. Collected by
the interest-list form, which appears on the landing page and on `/community`.
Every CTA that points at it reads "Join the interest list".
_Avoid_: email list, mailing list, the community, the loop

**Reserved slot**:
A labeled stand-in for content that has been decided on but not yet written or
built — a schedule, a booking scheduler, the conditions tool. Renders as a
dashed frame with an emoji and a "coming soon" line naming what lands there.
_Avoid_: coming-soon box, empty state, placeholder (that word is taken, below)

**Placeholder**:
A labeled stand-in for a future _image_ — logo, hero photo, card background,
gallery frame. Carries the accessible name the real image will inherit, so
swapping in the photograph changes nothing for assistive tech.
_Avoid_: stub, dummy image, reserved slot (that is for content, not images)

**Strip**:
A band of content that loops horizontally. The yellow marquee is the only one
left: the gallery was a strip until PR #14 gave it controls and stopped it
moving, and a row the reader drives is not a strip.
_Avoid_: carousel, ticker, marquee (the marquee is one strip, not the concept)

**Row**:
The gallery's nine tiles in one horizontal scroller the reader pages through a
screenful at a time. What a strip stopped being: it holds still until someone
moves it (ADR-0007). It keeps the page's gutter on both sides, and its snap
positions are offset to match — without that it comes to rest one gutter in,
having eaten its own inset.
_Avoid_: carousel, slider, gallery strip

**Pager**:
The row's prev/next pair. It sits above the row rather than on its edges,
because a control overlaid on a scroller covers artwork at some scroll position
whatever the padding is (ADR-0008). It names what it drives with
`aria-controls`, the row having stopped being its neighbour.
_Avoid_: arrows, nav buttons, controls (unqualified — the nav has controls too)

**Stop**:
One screen of the landing page, which the viewport comes to rest on. The page
is six of them. A stop owns its height and its surface, and the content inside
it adds no vertical padding of its own — the stop is already supplying that
space, and padding on both is counted twice.

A stop exists only on a window big enough to hold one: from `lg` wide and
`39rem` tall, expressed as the `stops` variant in `globals.css`. Below either
threshold the page has no stops at all — the sections put their own padding
back and it scrolls normally.

A stop is **540px** tall at that threshold, and every section is built to fit
it. Content that does not is a bug in the section: the budget is the constraint
sections are designed against, not a number to raise.
`docs/plans/stop-height-threshold.md` has the measurements and the reason the
threshold cannot go above 39rem.

The gallery is a stated exception, and the only one. Its tiles are a share of
the row with a fixed aspect, so its height follows the window's _width_ rather
than sitting under a budget: it exceeds its stop when `viewportHeight` is under
`0.225 × viewportWidth + 211`, which takes a window wider than about 1836px and
short for its width. Recorded rather than fixed — issue #38 — because no
display the site is reviewed on is wide enough to produce one.
_Avoid_: slide, panel, screen (a section is the content; the stop is the screen
it fills)

**Tall / wide**:
The two shapes a gallery tile comes in — 4:3 and 16:9. A row of the gallery is
two tall and one wide at a single height, so the wide tile is the wider one
rather than the shorter one, and the wide slot alternates side down the rows.
_Avoid_: portrait (a tall tile is landscape too, just less so), thumbnail

**Pill**:
The site's call-to-action shape: a fully-rounded link. Five tones, and the list
is closed — `yellow`, `purple`, `ocean`, `outline-light`, `outline-dark`. A
pill is a link; the interest-list form's submit control is the site's only
true button.
_Avoid_: button, chip, badge (a badge is the smaller non-interactive pill on a
program card)

**Conditions**:
The real-time surf, tide, wind and visibility tool for San Diego's coast, built
in this repo (ADR-0009). Has a teaser on the landing page and a page of its own;
the teaser still carries a reserved slot, which comes out in the slice that has
something to put in its place. It shows readings and forecasts relayed from
public sources, attributed and timestamped — never a judgement this site makes
about whether conditions are safe.
_Avoid_: weather, forecast, surf report
