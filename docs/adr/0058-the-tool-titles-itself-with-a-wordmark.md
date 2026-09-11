# 0058 — The tool titles itself with a wordmark, not a headline

Date: 2026-09-11. Status: accepted. Qualifies ADR-0014; retires
`--text-tool-title`. Plan: `docs/plans/conditions-toolbar.md`.

## Context

`/conditions` opened on **"Check conditions first."** set in
`--text-tool-title` — `clamp(24px, 3vw, 36px)`, so 36px at the 1536×639 window
this site is reviewed at. Under it sat a liability sentence, a chooser and a
wrapped row of ten beach links. The week grid, which is what the page is for,
began at 459px and the day panel at 869px.

**The headline told the reader what they had just done.** The only way onto
this page is the nav item reading "Conditions", or a link from the landing
page's teaser. A three-word sentence in the largest type on the page, saying
the reader should check conditions, is addressed to somebody who has not
arrived — and that reader is already served twice over: the `metadata`
description in `app/conditions/page.tsx` carries the full sentence for search
and for a shared link, and `ConditionsTeaser` carries it on the landing page.

**The obvious fix does not work.** Dropping the `<h1>` one rank, to
`--text-tool-region`, puts it at exactly the size `TOOL_REGION_HEADING` gives
"The week ahead", "Today, hour by hour" and "How to read these numbers". That
is the rank collapse ADR-0014 was written to escape, stated in
`headingRank.ts`'s own words: "34px under a 36px title is not a second rank, it
is the same one twice." And there is no size between 22px and 36px to reach
for — inventing a fifth size token to thread that gap would be a worse outcome
than the problem.

**The page is a tool, and a tool's title is chrome.** ADR-0014 already made
this distinction once, splitting a tool register off the display register on
the grounds that "the page is read for a figure rather than arrived at". This
is the same argument one step further: what sits above a toolbar is not a
headline introducing a document, it is a label naming what the controls belong
to.

## Decision

**The `<h1>` is the single word "Conditions" in the label register** —
`text-2xs font-extrabold tracking-widest text-ocean uppercase`, named
`TOOL_WORDMARK` in `components/ui/headingRank.ts`.

**It is smaller than the region headings beneath it, deliberately.** Visual
rank and outline rank diverge here and that is the point: the bar is chrome,
and the first _content_ on the page is the first region. `TOOL_REGION_HEADING`
at 17–22px becomes the largest type on the page.

**The outline is untouched.** It is still an `<h1>`, still first, and no level
is skipped — a reader navigating by heading lands exactly where they did
before. Only the painted size changes.

**`--text-tool-title` retires with it**, along with its `REQUIRED` row in
`scripts/built-css.mjs`. That row's stated reason was this one element; with no
reader left, keeping the token would leave the gate asserting that a rule
nothing uses still compiles.

## Consequences

**ADR-0014's decision is unaffected, which is why this qualifies rather than
supersedes it.** That ADR is about a region heading outranking a card heading,
and it still does: 17–22px display against 10px label, clear at both ends of
the clamp. What changes is that the page above them no longer carries a title
in the display register at all.

**Visual rank no longer mirrors the outline on this page.** That is a real cost
and worth naming: somebody skim-reading a screenshot sees "The week ahead" as
the biggest thing on the page and could take it for the page's subject. The
mitigation is that the nav marks the current page and the wordmark sits in the
bar with the controls, which is where a reader looks for "where am I".

**No gate can see this.** jsdom applies no stylesheets (ADR-0001), so no test
can assert that the wordmark paints smaller than a region heading. The tests
assert class _reference_ — that the `<h1>` refers to `TOOL_WORDMARK` — and the
stylesheet gate asserts that `text-tool-region` still compiles. A human
confirms the rank is visible, which is already how ADR-0014 is verified.

**The liability sentence keeps its size.** It was tempting to shrink the
standing notice with the title, and the prototype did. ADR-0009 makes that
sentence the assertion this site owns, so it stays at `--text-base`. Shrinking
it is not something a layout change gets to do as a side effect.
