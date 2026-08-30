# Wild Coast Kids

The site for an art-class and outdoor-co-op program for K–8 kids in San Diego.
This file is the project's domain glossary: the words the code, the copy, the
issues and the plans all use for the same things. When two words are in play
for one concept, this file picks one and lists the rest under _Avoid_.

## Language

**Program**:
One of the two things the site offers — art classes, and the Tuesday co-op.
Each has a card on the landing page and a page of its own. A program is the
standing offer; a **session** is one occasion of it.
_Avoid_: offering, service, class (a class is one session of the art program)

**Session**:
One dated occasion of a program — a single art class, or one Tuesday of the
co-op. It carries its own time, place and optional price, because those vary
between one occasion and the next. `public.sessions` holds one row per session,
and the schedule on `/art` and `/coop` is a list of the published ones still to
come.

The two programs are not sessions and are not data: they are the two cards in
`ProgramCards.tsx`, and a session's `program` column names one of them.
_Avoid_: event (in `src/` the word means a DOM event), occurrence, date,
booking, class (that is one session of the art program), slot (a reserved slot
stands in for content, not for a date)

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
It may stand **instead of** the content, which is where five of the six sit, or
**inside** content that already exists, holding open a layer of it rather than
the whole — the sightings on the shore map (ADR-0031). Either way it names what
lands there and never an issue number.
_Avoid_: coming-soon box, empty state, placeholder (that word is taken, below)

**Placeholder**:
A labeled stand-in for a future _image_ — the logo and card backgrounds are
what is left; the hero photo was one until the photograph arrived, and the
gallery's nine were until theirs did. The label is what the slot is _for_, so
the page reads the same shape either way. It is not the accessible name the
photograph then keeps: a label written before the picture exists is a guess,
and the hero's was wrong by the time it was filled — the real image names its
own frame. Both fills bore that out. "Kids with artwork" became two kids
holding up the self-portraits they had just finished, and "Neon chalk art"
turned out to be acrylic marker.
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

**Crop**:
Where a tile is anchored on the photograph inside it. Every tile is landscape
and most of the photographs are portrait, so each one names the point its tile
keeps — the centre is a choice too, and the wrong one for a piece that sits
low in its frame. Carried per image in `galleryImages.ts`, not per slot.
_Avoid_: focus (this repo's focus is the keyboard kind), framing, position

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
The real-time surf, tide and wind tool for San Diego's coast, built in this
repo (ADR-0009). Has a teaser on the landing page and a page of its own;
the teaser still carries a reserved slot, which comes out in the slice that has
something to put in its place. It shows readings and forecasts relayed from
public sources, attributed and timestamped — never a judgement this site makes
about whether conditions are safe. The tool is `src/components/conditions/`; the
teaser is not part of it and sits at the root of `src/components/` as
`ConditionsTeaser.tsx`, because it belongs to the landing page rather than to
the tool (ADR-0018).
_Avoid_: weather, forecast, surf report

**Observation station**:
One of the stations in `src/data/observation-stations.json` — 62 of them, across
the National Weather Service's network and NDBC's. The table is read by two
joins with different filters, so it is named for neither of them. Until it was
renamed it was `weather-stations.json`, and the sky join beside it was
`weather-join.mjs`; ADRs and plan files written before the rename still name
those paths, and are left as the dated records they are.
_Avoid_: weather station, met station

**Air station**:
The observation station a beach reads for air temperature and wind — the only
station its air card names. It was one of two until 2026-08-27: a _sky station_
supplied cloud and visibility from an airport METAR, and that term is retired
along with the reading (ADR-0020). Requiring one station to supply all four
values had let the scarcest of them decide where the temperature was measured,
which put an inland reading on a coastal beach (ADR-0010); this is the binding
that split off, and it outlived the one it was protected from.
_Avoid_: weather station, wind station, sky station

**Grid cell**:
The square of the National Weather Service's forecast map a beach falls in,
about 2.5 km across, named `office/x,y`. It is where the week's cloud forecast
comes from, and it has no distance beside it: every coordinate inside a cell is
equally inside it, so there is nothing to be nearer by.
_Avoid_: gridpoint, forecast point, weather square

**MOP line**:
One of the points in `src/data/mop-lines.json` — 1,210 of them along this
county's coast, numbered south to north behind the prefix CDIP assigns it. Each
is a place CDIP's Monitoring and Prediction model publishes a wave forecast for,
at 10 m depth and about 100 m from its neighbours. It has no name, so the page
calls it what it is: "MOP line D0498". A beach binds one for the week ahead and
a wave buoy for now; the two are separate joins over separate tables and refuse
the same water.
_Avoid_: MOP station, model buoy, virtual buoy, forecast point

**Sparkline**:
The 24-hour shape drawn behind the figures in one cell of the week grid. It
draws the tide, with night shaded, at a range shared across all seven days so
the cells stay comparable. It carries no cloud (ADR-0026) and does not follow
the day chart's tab — the week is the tide's shape at a glance, and the chart
is four products at reading size.
_Avoid_: mini chart, thumbnail, micro graph, spark

**Day panel**:
The region below the week, showing one chosen day: its heading, the
publisher's sky wording, the hour chart, the shore map, and — on today alone —
what was measured. The week grid is the control that picks which day; the panel
is what redraws.
_Avoid_: day view, detail panel, today panel (it is any of seven days)

**Hour chart**:
The large plot inside the day panel: twenty-four hours across, night shaded,
cloud as a band above, one of four series drawn at a time behind four tabs.
_Avoid_: graph, the plot, day chart, timeline

**Shore map**:
The square picture beside the hour chart: this beach's own stretch of coast
drawn heavier than the shore either side of it, and the open water washed in
beside it. **It plots no stations, buoys or model lines** — it draws a place,
not an inventory, and every source on the page is named in words under the
group it belongs to (ADR-0033). The line it draws is CDIP's model line rather
than a shoreline, which the sentence under it says. It reads no feed — every
position on it is committed.
_Avoid_: locator, mini map, station map, chart (that word is the plot's)

**Dial**:
The compass drawn on the shore map: two needles standing out at the direction
the wind and the swell come from and pointing in at the beach, each labelled at
its tail and each with a translucent arc for the range it swung through in
daylight. It is read against the coast underneath it — a needle whose tail is
over the shaded sea is onshore — which is why it sits on the map and not beside
it. **The labels are on the needles and there is no legend**: a word on the
thing itself is what a legend is a substitute for, and a boxed legend is one of
the brief's anti-references. It carries two publishers on one drawing, one
provenance line per needle (ADR-0032), and it is withheld on the beaches the
traced coast does not reach, where a bearing has nothing to be read against.
_Avoid_: compass rose, wind rose, gauge, direction widget, legend
