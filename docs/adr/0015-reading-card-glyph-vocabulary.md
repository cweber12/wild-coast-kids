# 0015 — The reading cards take 🐚 🏄 💨, on a chip that carries them

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
the same three mark the same products in the week grid and its reserved rows.
🌊 leaves `/conditions` entirely and is left meaning one thing site-wide.

**The glyph renders at 34px inside a 56px `rounded-thumb` chip filled
`bg-ocean`, on the lead-figure row rather than above the heading.**

Three things follow from that one sentence, and each answers an objection above:

- **The chip is what makes 🐚 and 💨 possible.** They are pale glyphs; a
  saturated backing is the "adjust the background" the contrast objection was
  always asking for. It adjusts the glyph's own backing, not the card's, so the
  reading surface stays what ADR-0009 and `ReadingCard` require of it.
- **Beside the figure, the glyph costs no height.** The figure line is already
  36px (`--text-stat`). A 56px chip sharing that row adds nothing to the card,
  so the 46px that bought the first screen back is not spent again. The
  constraint that shrank the glyph was about a _position_, and it does not apply
  to this one.
- **`bg-ocean` and not the alternatives.** Rendered as a set on five treatments:
  ocean and dark both carry all three glyphs; purple leaves the shell pale;
  yellow washes out the air puff; bare on mist loses two of the three. Ocean
  over dark because `text-ocean` is already this page's accent, so the chip
  reads as the same system as the eyebrow above it rather than as a foreign
  black block. `bg-dark` is the higher-contrast fallback if it ever needs one.

**When a card has no lead figure, the chip renders on its own row.** `TideToday`
and `WavesToday` pass `figure={null}` in their no-station, no-buoy and
unavailable states. A card that loses its subject mark when a station goes quiet
is worse than one that spends 56px, and those cards are the short ones anyway.

**💨 and not 🌬️.** The wind face is the obvious Unicode choice and it is a face,
which puts a character on a page of instrument readings. Of the faceless
alternatives, 🍃 is a plant, 🌀 is a hurricane, 🎐 is a wind chime, 🪁 is a toy and
🌪️ reads as a funnel at 44px; each is either the wrong subject or overstates a
3 mph breeze. 💨 is the only faceless glyph that means moving air, and it is
precisely the one that needs the chip.

**The chip is decoration, not a verdict.** ADR-0009 forbids this site making a
judgement about whether conditions are good, and `ReadingCard` extends that to
"a card that looked like a verdict would be making one in CSS". What makes
colour a verdict is _differential_ colour — a green card and a red one. The chip
is identical on all three cards and carries no text, so it asserts nothing about
the water. This is the same escape the docstring itself named when it said the
colour goes into the glyph; that outlet closed when the glyph reached 10px, and
this reopens it.

## Consequences

`/conditions` gains its first saturated surface. Before this the page painted
three background colours — mist, white and white/60 — all within 1.30:1 of the
cream behind them, and used none of the site's yellow, purple or pink. Three
ocean chips are the whole of the change.

**`ReadingCard`'s "the glyph labels the heading rather than floating above it"
paragraph is superseded and is rewritten in the same commit.** Its reasoning
about `WeekGrid` marking one product two ways still stands — the week grid keeps
its inline `<dt>` glyph, because a 56px chip in a 148px cell is not the same
problem as a 56px chip beside a 36px figure.

**This reverses finding 9 of `.design/conditions-page/DESIGN_REVIEW.md`
(2026-08-24), which shipped the 10px inline glyph.** That finding was right
about the height and wrong to conclude that shrinking was the only way to
recover it. The reversal is recorded here rather than left as a silent swap, so
the next reader finds the argument and not just the diff. `TideWeek`'s comment
arguing 🌊-over-🐚 is rewritten to point here for the same reason.

**The gate cannot check that a glyph reads.** jsdom applies no stylesheets
(ADR-0001), so tests assert which glyph a card composes, that it stays
`aria-hidden`, that it is no longer inside the heading, and that it still
renders when `figure` is null. That 34px on ocean is legible where 10px on mist
was not is a human check at the review viewport — the same compromise ADR-0004
records for the touch target and ADR-0014 for a heading rank.

**🏖️ still marks the surf-zone forecast, and that is still wrong.** The product
is rip-current risk and the glyph is a beach parasol; it was reported as finding
12 of the 2026-08-24 review and is not fixed here. It sits in a reserved slot
rather than on a reading card, so it is outside this decision's subject, and
recording the omission is the point — the alternative is a vocabulary rule that
quietly means "the three cards it was written for".

The part most likely to be re-litigated is overriding a principle the brief
states in full. The honest answer is that the brief's two reasons were checked
rather than assumed: one was measured and answered with a chip, and the other
turned out to describe a roster the glyph is not on.
