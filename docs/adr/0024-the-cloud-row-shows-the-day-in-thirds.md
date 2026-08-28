# 0024 — The cloud row shows the day in thirds, and computes no words

Date: 2026-08-28. Status: accepted. Supersedes part of ADR-0020.

## Context

The cloud row printed one figure: the mean cloud cover across the daylight
window. ADR-0020 chose a mean rather than an extreme, and that reasoning still
holds — cloud has no unreachable hours, so there is no 3:14 AM to route around.

What it did not check is whether one number describes the day.

Measured against the live gridpoint `SGX/54,21` on 2026-08-28, every one of the
next seven days is a marine-layer burn-off:

| day    | what the row showed | first third | middle | last third |
| ------ | ------------------- | ----------- | ------ | ---------- |
| Aug 28 | 38%                 | 48%         | 36%    | 22%        |
| Aug 29 | 35%                 | 40%         | 33%    | 29%        |
| Aug 30 | **46%**             | **65%**     | 32%    | 31%        |
| Aug 31 | 38%                 | 48%         | 32%    | 27%        |
| Sep 1  | 54%                 | 53%         | 46%    | 69%        |
| Sep 2  | 61%                 | 70%         | 54%    | 55%        |
| Sep 3  | **56%**             | **72%**     | 49%    | 34%        |

Sunday is the clearest case. "46%" is the average of a 65% morning and a 32%
afternoon, and it describes neither. A parent deciding whether to drive out
after breakfast or after lunch is asking precisely the question that average
destroys — and on this coast, in this season, that is not an edge case. It is
the shape of the week.

The single figure was also the one thing on the page a reader could not act on.
A tide time says when to go; a swell height says what the water is doing; "46%"
says nothing a person can use without knowing what 46% feels like.

## Decision

**The row shows the daylight window in three parts, and the mean is gone.**

- **Thirds of the window, not named clock hours.** The window is already
  computed here from the beach's own coordinates, so dividing it is arithmetic.
  Drawing a boundary at 11 AM instead would be this site inventing a fact about
  the sky, and it would not track the season: a 13-hour August window gives
  roughly 6:20–10:40, 10:40–3:00, 3:00–7:20, and a 10-hour December one narrows
  all three together.
- **Labelled AM, Mid and Eve.** "Mid" rather than "PM", because the third part
  is also PM and a column headed "PM" beside one headed "Eve" reads as a
  contradiction rather than a sequence. They are approximations and the
  component says so: a third of an August window runs to about 10:40, which is
  late for "AM", and the alternative is naming hours.
- **The mean is dropped rather than kept beside the parts.** It was the
  misleading figure. Printing it next to three numbers that do not obviously
  average to it would be noise defending a number nobody should read.
- **A third the forecast did not reach is an em dash, never a zero.** The
  product does not run backwards, so on the day the reader is standing in the
  first third is usually gone. A 0% there would report a cloudless morning
  nobody observed.
- **The phenomenon still leads.** "Patchy fog" is the fact a parent plans
  around, and it is the National Weather Service's word rather than ours.

**No band word is computed here, and that is a finding rather than an
omission.** "46% Partly cloudy" was the obvious companion fix — a percentage
is confusing, words are not — and it was tested before it was built. Banding
the daylight mean on the National Weather Service's own sky-condition scale
contradicts the National Weather Service's own published wording:

| day    | mean | we would print | its forecast endpoint says |
| ------ | ---- | -------------- | -------------------------- |
| Aug 28 | 38%  | Partly cloudy  | **Mostly Sunny**           |
| Aug 29 | 35%  | Mostly sunny   | Mostly Sunny               |
| Aug 30 | 46%  | Partly cloudy  | **Mostly Sunny**           |
| Aug 31 | 38%  | Partly cloudy  | **Mostly Sunny**           |
| Sep 2  | 61%  | Partly cloudy  | Partly Sunny               |
| Sep 3  | 56%  | Partly cloudy  | Partly Sunny               |

Three of six disagree. A site that names a source and then contradicts it in
the source's own vocabulary has said something worse than nothing.

The words exist and they are the publisher's to give: `shortForecast` on
`/gridpoints/{cell}/forecast` carries them, transitions included — "Patchy Fog
then Mostly Sunny". That is a second upstream read with its own outage path and
its own provenance, and it is deliberately not taken here.

## Alternatives considered

**Band the mean into words and keep one figure.** Cheapest, no height cost, and
it fixes the confusion the row was reported for. Rejected on the measurement
above: it disagrees with the National Weather Service on half the sample, and it
leaves the mean — which is the misleading part — in place.

**Band the middle third instead.** It matches the National Weather Service on
all six measured days, which is suspicious rather than reassuring: it is a rule
fitted to six points, and the next reader would have no way to tell whether it
holds because it is right or because the sample was small.

**Read `shortForecast` and print the publisher's own wording.** The best
version of the row, and it is what this should become. Deferred rather than
rejected: it is a second request, a second failure mode, a second provenance
line and its own decision about what happens when the two products disagree
about the same day. A day view is planned that will want that read anyway, and
taking it once, in the shape that view needs, is better than taking it twice.

**Morning / Midday / Evening spelled out.** Each column is about 42px at 1280
and "Morning" alone is wider than that at the label register. Going under 10px
to fit a word would break the size scale — 10px is already this page's floor.
The long form belongs in the day view.

**Leave the row alone and put the split in the day view only.** Defensible: the
grid is meant to be at a glance. Rejected because the figure on the page is not
merely thin, it is wrong about every day of the week measured, and a day view
nobody has opened yet does not fix what the grid says.

## Consequences

- **The grid is taller.** Measured at La Jolla Shores: 256px to 288px at 1280,
  about 12%. That is the cost of the row saying something usable.
- **`SkyWeekDay.cloudPercent` is replaced by `SkyWeekDay.thirds`.** Anything
  wanting the daylight mean must now average the parts, and should ask first
  whether it wants a figure this decision found misleading.
- **The row still computes no judgement**, which is what ADR-0009 requires.
  Three means are three measurements; the words on the row are the publisher's.
- **ADR-0020's "mean rather than extreme" survives** and its "one figure for the
  day" does not. The reasoning that chose a mean was about reachability and is
  untouched; what changed is how many means one day needs.
- **Anything that restores a single daylight figure to this row reverses this**,
  and will look like a simplification. The table at the top is the argument.
