# 0015 — The reading cards take 🐚 🏄 💨, on a surface that carries them

Date: 2026-08-25. Status: accepted.

## Context

`DESIGN_BRIEF.md`'s third experience principle set the now-band's vocabulary —
🌊 tide, 🏄 waves and water, 🌡️ air — and rejected 🐚 for the tide card on two
grounds: that it "renders pale lavender on a pale lavender surface", and that
"the animal vocabulary is reserved for sightings", because #121 is about to make
an animal glyph mean something a person found. Both were re-measured before this
decision, and they do not come out the same way.

**The contrast objection is real, and larger sizes make it worse.** Rendered at
48px on all seven of the site's surfaces, 🐚 is a grey-lavender spiral that
disappears on cream, mist, lavender and white, and only reads on ocean, purple,
yellow and dark. 💨 behaves the same way and slightly worse: it is a white puff.
The objection was never about the glyph being wrong for tide — it was about
where the glyph was standing.

**The reservation objection does not hold.** #121's roster is 🐙 🦀 🪸 🐌 ⭐ 🦭 🦈
🦞 🪼 🐢. **🐚 is not in it**, and a shell is not an animal a naturalist logs — it
is the thing left behind. The brief's rule is that a glyph may mean one thing
per page, and a shell on the tide card competes with nothing on it.

**🌊 is the glyph that actually has a collision.** It means Tidepools in
`ProgramCards`, tidepools in `InterestListForm`'s interest checkbox, and the
tide in `TideToday` and `TideWeek`. Three meanings across three pages breaks no
stated rule, but it makes 🌊 the expensive glyph to spend on the tide card while
🐚 sits free — and it is why moving tide to 🐚 _reduces_ collision rather than
creating it.

**The glyph the brief did commit is not currently readable.** Measured on the
rendered page: seventeen glyphs marking live measurements render at 10px — three
card headings and fourteen week-grid labels — while the only large glyphs on the
page are 24px and 48px, inside dashed boxes standing in for products that do not
exist yet. The biggest mark on `/conditions` is a 48px 🗺️ in a box with no map.
At 10px a full-colour emoji is not a mark; it is a smudge in front of an
otherwise crisp uppercase eyebrow.

That size is not an accident. `ReadingCard`'s docstring records why: the glyph
was a 34px block with a 12px margin on a line of its own, "46px per card, in
every card", and recovering that row was where the first screen's spare height
was on a 639px window. The height argument was correct. What it did not
consider is that the row above the heading is not the only place a glyph can go.

## Decision

**The now-band's vocabulary is 🐚 lowest tide, 🏄 waves and water, 💨 air**, and
the same three mark the same products in the week's reserved rows. 🌊 leaves
`/conditions` entirely.

> Amended 2026-08-25, after this shipped. The vocabulary reached the week
> grid's `<dt>` labels too, and it should not have: those are set at 10px, and
> at 10px a shell is a grey smudge on a pale cell — the exact failure the card
> was given a dark surface to escape, repeated fourteen times. **A glyph marks a
> panel on this page. A row inside one is named in words.** The week grid's row
> glyphs are gone; the reserved slots keep theirs, being panels at 24px and 48px.
> The rule this ADR was reaching for is about which glyph means which product,
> and that is unaffected.

**The card is `bg-dark`, and the glyph stands on it bare at 30px, beside the
lead figure.** The contrast objection is answered by the surface the glyph
stands on, and the card is that surface.

Three things follow, and each answers an objection above:

- **A dark card is what makes 🐚 and 💨 possible.** They are pale glyphs, so
  they need something dark behind them; that is the whole of the "adjust the
  background" the objection was asking for. Rendered as a set on five
  treatments, all three glyphs read on `bg-dark`, on `bg-ocean` and on
  `bg-purple-deep`, and two of the three are lost on `bg-mist`.
- **Beside the figure, the glyph costs nothing.** The figure line is already
  36px (`--text-stat`) and a 30px glyph fits inside it, so the row does not
  grow: the card measures 283px at 1536×639 and 301px at 1280, which are the
  heights it had before any of this. The 46px that shrinking the glyph bought
  back is not spent again. The constraint was always about the _position_ above
  the heading, not about the size.
- **`bg-dark` and not `bg-ocean` or `bg-purple-deep`, which also carry the
  glyphs.** Those two are the exact surfaces `ProgramCards` uses for the
  landing page's offer cards. A reading is not an offer, and a page that dresses
  an instrument panel like a sales card has said something about it. `--color-dark`
  is the footer's colour, which is a neutral register rather than a competing one.

**A first attempt put the glyph on a 44px `bg-ocean` chip and kept the card on
`bg-mist`.** It was built, measured and rejected on review: the badge shape read
as applied decoration rather than as part of the card, and it cost 8px per card
that the bare glyph does not. Recorded because the chip is the obvious answer to
"the glyph is too pale" and the next person to have the problem will reach for
it — the surface is the cheaper fix and the better-looking one.

**The card carries no text pair it inherited.** `text-fog` is a colour measured
against `mist` and it is unreadable on `bg-dark`, so every pairing was replaced
and re-measured: the figure and stat values at `text-white` (17.06:1), prose at
`text-white/75` (10.02:1), provenance and stat labels at `text-white/55`
(5.96:1), the eyebrow at `text-yellow` (15.22:1). The two secondary roles are
named once in `cardText.ts` rather than spelled out across three panels.

**The eyebrow is yellow, which is the first of the brand's colours to reach this
page.** Before this the page painted three backgrounds — mist, white and
white/60 — all within 1.30:1 of the cream behind them, and used no yellow,
purple or pink at all. The brief opens by saying the page "does not look like
the site it belongs to"; this is the smallest change that stops being true.

**💨 and not 🌬️.** The wind face is the obvious Unicode choice and it is a face,
which puts a character on a page of instrument readings. Of the faceless
alternatives, 🍃 is a plant, 🌀 is a hurricane, 🎐 is a wind chime, 🪁 is a toy and
🌪️ reads as a funnel at 44px; each is either the wrong subject or overstates a
3 mph breeze. 💨 is the only faceless glyph that means moving air.

**A dark card is decoration, not a verdict.** ADR-0009 forbids this site making
a judgement about whether conditions are good, and `ReadingCard` extends that to
"a card that looked like a verdict would be making one in CSS". What makes
colour a verdict is _differential_ colour — a green card and a red one. All
three cards take the same surface whatever the water is doing, so nothing here
asserts anything about it. The docstring's own resolution was that the colour
goes into the glyph and the eyebrow; that outlet closed when the glyph reached
10px, and this reopens it wider than the docstring imagined.

## Consequences

`/conditions` gains its first saturated surface, and the now-band stops being
the palest thing on a pale page. The week grid below it stays on `bg-mist` and
is not converted here: "now" and "planning" are different registers and it is
defensible for them to look different, but if it ever reads as an oversight
rather than a distinction, this is the decision it gets converted against.

**`ReadingCard`'s "the glyph labels the heading rather than floating above it"
paragraph is superseded and rewritten.** Its reasoning was that one page should
not mark a product two ways, and it resolved that by copying the week grid's
inline treatment onto the card. The resolution is now the other way round: the
card's glyph is the one that works, and the week grid has none, so there is one
treatment on the page and it is the legible one.

**This reverses finding 9 of `.design/conditions-page/DESIGN_REVIEW.md`
(2026-08-24), which shipped the 10px inline glyph.** That finding was right
about the height and wrong to conclude that shrinking was the only way to
recover it. The reversal is recorded here rather than left as a silent swap, so
the next reader finds the argument and not just the diff. `TideWeek`'s comment
arguing 🌊-over-🐚 is rewritten to point here for the same reason.

**The gate cannot check that a glyph reads, or that a contrast ratio holds.**
jsdom applies no stylesheets (ADR-0001), so tests assert which glyph a card
composes, that it stays `aria-hidden`, that it is no longer inside the heading,
that it still renders when `figure` is null, and that a stat value is at full
strength where its label is muted. That 30px on dark is legible where 10px on
mist was not, and that the ratios above hold as rendered, are human checks at
the review viewport — the same compromise ADR-0004 records for the touch target
and ADR-0014 for a heading rank.

**The reading card's corner radius is no longer the defect the review called
it.** Finding 1 of the 2026-08-25 review argued that `rounded-card` at 24px read
as a blob _because_ `bg-mist` sits at 1.10:1 against the page, so the corner arc
was the only visible part of the shape. On `bg-dark` the fill is 16:1 and the
card is a plainly visible rectangle, so the radius now reads as intended. That
finding still stands for the week grid's 159x148 cells, which keep the mist
surface and the 24px radius both.

**🌊 is not left meaning one thing, and this decision does not reach the page
that would fix it.** `Conditions.tsx` — the landing page's teaser — marks
"Today's low tide is live" with 🌊, which is the tide meaning this ADR just
moved to 🐚 one click away. So the site now names the same product two ways
across two pages, which is worse in one sense than the collision this started
with. It is left alone deliberately: the landing page is a finished composition
outside this brief, the teaser is a `ReservedSlot` on an ocean surface rather
than a reading card, and changing it is a visible edit to the first screen of
the site that wants its own branch. This ADR is what it is converted _against_
when someone does it. What is true today is that 🌊 means the tide on the
landing page and Tidepools in `ProgramCards` and `InterestListForm`, and that
`/conditions` no longer competes with either.

**🏖️ still marks the surf-zone forecast, and that is still wrong.** The product
is rip-current risk and the glyph is a beach parasol; it was reported as finding
12 of the 2026-08-24 review and is not fixed here. It sits in a reserved slot
rather than on a reading card, so it is outside this decision's subject, and
recording the omission is the point — the alternative is a vocabulary rule that
quietly means "the three cards it was written for".

The part most likely to be re-litigated is overriding a principle the brief
states in full. The honest answer is that the brief's two reasons were checked
rather than assumed: one was measured and answered by the surface, and the other
turned out to describe a roster the glyph is not on.
