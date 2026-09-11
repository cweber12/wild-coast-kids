# Layout and information architecture for "current conditions at a coastal place"

Research report for the `/conditions` redesign, Wild Coast Kids.
Date: 2026-09-11. Research only — no code written, no repository files changed.

---

## 0. Method, and how to read the confidence labels

These products are mostly JavaScript SPAs. Direct fetching returns a loading
shell (BeachSafe, Safeswim), an HTTP 403 (Surfline, RNLI, Hawaii's current
official site), or nothing but an app shell (Windy.com). Four routes around that
carried most of this report, and they are worth recording because they will be
needed again:

- **Help-centre JSON APIs.** `support.surfline.com` 403s its HTML but serves
  Zendesk's JSON to curl, which is how eight current Surfline articles —
  including the full forecast-table column list — are quoted from source here
  rather than recalled.
- **The Wayback Machine via curl** (it is blocked to the fetch tool). BeachSafe
  and Hawaii Beach Safety were both _server-rendered_ in earlier years and their
  captures are complete HTML; RNLI and Magicseaweed likewise.
- **Shipped JavaScript bundles.** Windy.app's forecast table row order is an
  array in its widget bundle; Windy.com's pane geometry is in its stylesheet and
  its own plugin API docs.
- **Live HTML where it exists.** Windfinder, weather.gov and nps.gov all serve
  real markup and were read directly.

Where none of those worked I have said so rather than filling the gap.

Every structural claim below carries one of:

| Label                    | Meaning                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **[R]**                  | Retrieved. I fetched the product's own page and read its structure.                                                                 |
| **[R-doc]**              | Retrieved, but from documentation _about_ the product — its help centre, app-store listing, or a walkthrough — not the page itself. |
| **[recall, unverified]** | From my own recall. I could not confirm it. Treat as a hypothesis to check before designing against it.                             |
| **[gap]**                | Could not establish. Stated as a gap on purpose.                                                                                    |

A confidently wrong description of Surfline's layout would be worse than an
admitted gap, so the gaps are listed in §E rather than smoothed over.

---

## A. Comparable-product survey

### A.1 NWS Surf Zone Forecast (the text product itself) — **[R]**

Not a web page, but it is the most relevant document in the survey, because it
is the same publisher, the same audience and the same question, and it has been
refined over decades. Fetched the live San Diego/Orange County product at
`tgftp.nws.noaa.gov/data/raw/fz/fzus56.ksgx.srf.sgx.txt`.

Field order, verbatim labels:

1. Zone code and issuance time
2. Area name — `Orange County Coastal Areas-`
3. Timestamp
4. **`Rip Current Risk*.............`**
5. `Surf Height..................`
6. `Thunderstorm Potential........`
7. `Water Temperature............`
8. Tides (named location, times and heights)
9. `Remarks.......................` (swell direction and detail)
10. `&&` separator, then the **risk legend** — the definitions of Low/Moderate/High
11. `$$` terminator, then the next period repeats the block

**The structural fact worth taking:** the judgement comes _first_, before any
measurement. Surf height — the number a surfer wants — is field 5. Water
temperature, which is what most beachgoers actually feel, is field 7. The
publisher has decided that the one line answering "is the water dangerous"
outranks every figure, and that the scale's definitions ship attached to the
value rather than in a glossary.

The three levels and their exact sentences (retrieved from
`weather.gov/safety/ripcurrent-forecasts`):

- **Low** — "The risk for rip currents is low, however, life threatening rip currents often occur in the vicinity of groins, jetties, reefs, and piers."
- **Moderate** — "Life threatening rip currents are possible in the surf zone."
- **High** — "Life threatening rip currents are likely in the surf zone."

Note the deliberate construction: each level is a _sentence about likelihood_,
not an adjective. "Low" is not "safe".

### A.2 weather.gov point forecast (land point) — **[R]**

Fetched `forecast.weather.gov/MapClick.php?lat=32.7157&lon=-117.1611` (San Diego).

Reading order:

1. NWS branding and navigation
2. News headlines
3. **`Hazardous Weather Conditions`** — active advisories (a Heat Advisory when
   fetched). Hazards are above everything, including the location's own data.
4. **`Current conditions at San Diego International Airport (KSAN)`** — a single
   panel carrying icon, condition word ("Mostly Cloudy"), temperature, humidity,
   wind, barometer, dewpoint, visibility, heat index, and a "Last update"
   timestamp. Coordinates and elevation sit in the same block.
5. **`Extended Forecast for San Diego CA`** — seven day/night cards
6. **`Detailed Forecast`** — the same seven periods as prose
7. Maps, satellite, forecast discussion links

**Structural takeaways:** (a) hazards outrank both now and forecast; (b) the
"now" panel names its _instrument and its distance from you_ inside the panel,
which is exactly what the repo's measured band already does; (c) the same seven
periods appear twice — once as cards, once as prose — so the grid is a _scan_
layer and the prose is a _read_ layer over identical content.

### A.3 weather.gov marine point forecast — **[R]**

Fetched `forecast.weather.gov/MapClick.php?lat=32.8669&lon=-117.2543` (offshore
La Jolla). Same chassis, but **no current-conditions panel at all**. The page
goes straight from the point header to the icon cards, and the "now" reading is
folded into today's card. Below the cards: a numbered **Notices** section, then
`Additional Forecasts and Information`, then a basemap, then
**`ABOUT THIS FORECAST`** carrying coordinates, update time, valid period and
export formats, then imagery and the hourly-graph thumbnail.

**Takeaway:** NWS defers provenance and metadata to a named block at the bottom
(`ABOUT THIS FORECAST`) rather than distributing it. That is the same job the
repo's `ConditionsNotes` does.

### A.4 NWS experimental Beach Forecast page (San Diego office) — **[R]**

Fetched `weather.gov/beach/sgx`. This is the closest institutional analogue to
what is being designed, and it is **map-anchored**.

Reading order:

1. NWS header, then an active-alert banner
2. Title "Experimental Beach Forecast Webpage", marked **UNDER DEVELOPMENT**
3. **An interactive map, colour-coded by forecast rip current risk**, with
   compass zoom controls. Instruction text: "The map below is color-coded to
   indicate the forecast rip current risk level. Click on the beach area of your
   choice for more information, or click a beach umbrella for the detailed,
   beach forecast."
4. Risk-level legend and definitions table
5. Rip current education
6. UV Index scale
7. Thunderstorm/waterspout potential scales
8. Safety links

**The map _is_ the place-picker and the primary data display simultaneously.**
There is no now/forecast separation on the hub page at all — temporal detail
lives behind the umbrella pins. Note also that every colour scale on the page
ships with a definition table beside it.

### A.5 NOAA Tides & Currents — **[R], partial**

`tidesandcurrents.noaa.gov/stationhome.html?id=9410230` returned a portal shell;
the station identity was not present in the fetched HTML. The predictions page
(`noaatidepredictions.html?id=9410230`) fetched more usefully:

- Controls are the page's spine: `From:` / `To:` date range (with "The maximum
  range is 31 days"), `Shift Dates` buttons labelled `Back 1` / `Forward 1`, and
  separate selectors for **`Units`**, **`Timezone`** and **`Datum`** (linking to
  `datum_options.html`), plus 12/24-hour clock and `Data Interval`.
- Output toggles between `Plot Calendar` and `Data Only` — chart or table.
- Two standing disclaimers: predictions are "based upon the latest information
  available as of the date of your request", and raw data "have not been
  subjected to the National Ocean Service's quality control".

**Takeaway relevant to the Notes block:** NOAA treats _datum_ as a first-class
control sitting next to units and timezone, not as a footnote. The repo's
decision to explain the tidal datum in the notes is the weaker version of this;
the stronger version is that the datum is part of what the number _means_ and
therefore belongs adjacent to it.

### A.6 Surfline — **[R]** (live page HTML plus eight current support articles)

`surfline.com` 403s WebFetch, and so does the help centre's HTML — but the help
centre serves its Zendesk JSON API to curl, so the articles below are quoted
from source rather than recalled. Live spot-page HTML (503 KB) was also read.

Reading order:

1. Global nav.
2. **Spot carousel — _above_ the page title.** Horizontal chips, each spot name
   - its current surf-height range (`Crystal Pier 3-4 FT`), ending in
     **Add favorites**. Signed in this is your favourites; signed out, a regional
     default.
3. `<h1>` `<Spot> Surf Report & Forecast`.
4. **Tab row — the primary control:** `Report & Forecast | Analysis | Charts | Guide`.
5. **Webcam player** — the first visual block, with a cam-angle list beside it.
6. **Nearby Spots** strip.
7. **`Current Surf Conditions`** — the "now" block, scoped in Surfline's own docs
   as data "for right now, visible while you watch the cam". Seven cards, **each
   carrying a provenance label**: `Surf Rating` → `POOR` + a 5-bar scale +
   `LOTUS Forecast` / `Forecaster Observed`; `Surf` → `1-2 FT` + a body gloss
   `Knee to thigh`; `Wind` → `9 KTS WSW`, `Model Forecast`; `Swell` (up to three
   trains); `Tide`; `Water Temperature` → `63°f` + `3/2mm wetsuit`; `Weather` →
   `57°f` + `Use SPF 30`.
8. **Regional written report** — forecaster byline, a headline, then
   `Dawn to 10am:` and `Afternoon Outlook:` paragraphs.
9. **`<Spot> Surf Forecast`** — the 16-day block, with the table/chart toggle.
10. **A collapsible graph stack**: Tides, Swell, Nearshore Energy, Wave
    Consistency, Weather — each with its own `^` collapse control, on the
    documented rationale "if the data isn't of interest, just hide it".
11. Nearby Buoys, prose spot guide, breadcrumb, footer.

**Three mechanics worth taking.**

- **The rating is a word _and_ a position on a bar.** Seven levels
  `VERY POOR → EPIC` on a **5-bar scale**; `Good` and `Epic` can only be
  assigned by a human and override the model's slot. Model ratings use wind
  speed, wind direction and breaking wave height only — not tide, not shape.
- **"Observation Clarity" (April 2025) — directly relevant here.** Rather than
  assimilating observations into the forecast, Surfline now draws **forecast as
  bars and observed as a white-dotted line over them**, and marks measured data
  with an `Observed` badge. That is a published solution to the exact problem
  this repo has solved by physical separation: a measured wave height and a
  modelled one on the same page (ADR-0016, ADR-0055). **Overlay is the
  alternative to separation, and it has a real precedent.**
- **The table/chart toggle sits at the top of the forecast section.** Table
  columns, in documented order: timestamp & rating (far left, and the rating
  colour lives in this cell) · surf height · primary swell · secondary swell ·
  wind (large = speed, small = gust, red when gust is much higher) · energy ·
  consistency · weather · pressure · **probability** (explicitly "% model
  agreement", _not_ probability of occurrence). Table view runs in 3-hour
  blocks. On iOS it **paginates horizontally** into three swipeable groups
  rather than scrolling.

**Now vs forecast is separated three ways**: by block (Current Surf Conditions
vs the 16-day section); by tab in the apps (a literal `Live` tab and `Forecast`
tab); and **by provenance badge on each individual value**.

**Place picker:** there is no in-page spot dropdown at all. Switching place is
the favourites carousel above the title, the Nearby Spots strip, global search,
the Maps nav item, or a satellite thumbnail. Surfline is the one product where
_which spots are mine_ outranks _which spot am I looking at_.

### A.7 Magicseaweed (shut down May 2023) — **[R]** via Wayback

Read from a real spot page capture (17th St, 2022-06-25, 540 KB) plus MSW's own
archived help pages — so the column list below is from `<th>` elements, not from
recall.

**It did have a now block, and it was above the table** — correcting my earlier
gap. Order: nav → `<h1> <Spot> Surf Report and Forecast` + three-level region
breadcrumb → spot tab row (`Forecast | Webcam | Tide | Spot Guide | Reports |
Photos | Live Data`) → webcam (Pro-gated) → **Nearby Spots carousel** →
**`Current Surf Report` / `Current Conditions`** (compass thumbnail, surf height
range `1-2 ft`, the five-star rating, wind, primary/secondary/wind swell,
weather icon, `Air 65°f / Sea 67°f`, then today's tide events and
first light/sunrise/sunset/last light with the tide station named and its
distance) → `<Spot> Surf Forecast` with range tabs `Hourly | 7 Day | 16 Day
(PRO)` → **the table** → per-day tide & daylight bands → model/settings row →
`Last Model Run` / `Data Status` / `Run Age` → embed snippet → footer.

MSW's help is blunt about what its now block actually was: _"Current conditions
are based on the very latest forecast information **NOT a local reporter**."_
The opposite of Surfline, whose now block's whole selling point is observation.

**The table's columns, in order:** unlabelled timestamp (`12am, 3am, 6am, 9am,
Noon, 3pm, 6pm, 9pm`) · **Surf** · **Swell Rating** · **Primary Swell** ·
**Secondary Swell** · **Wind** · **Weather** · **Prob.** Day names spanned the
table as header rows.

**Where the stars sat, and why it matters.** Column 3 — after surf height,
before the swell detail. Not a badge and not a separate block: **a column of
five stars per 3-hour row, so the rating scanned vertically down the day as a
shape.** And the encoding was two-part and documented: _"The total number of
stars is the rating of the swell without the wind taken into effect. We then
grey out stars if the wind is blowing onshore… the overall rating for the hour
is the total number of just the dark blue stars."_ A four-star morning degraded
to two by cross-onshore wind and recovered to three when it went offshore.

MSW's own stated reading order for the table was **rating first, then period,
then direction** — the rating existed so you could skip the numbers, and the
numbers existed so you could overrule the rating. That is a better articulation
of the verdict/evidence relationship than anything in the UX literature I found.

### A.8 Windy.com — **[R]** for the frame, **[gap]** for the panel contents

Read from the live app shell DOM and stylesheet (v51.2.1) plus the plugin API
docs. **The map is not a block on the page; it is the page** —
`#map-container` is `position:absolute` at `top/right/bottom/left:0`, 100% × 100%,
and every other region is a floating overlay fixed against an edge. The forecast
panel does not sit _beside_ the map, it sits _on top of_ it; the map is never
resized or pushed.

The app's own pane vocabulary, from the plugin API:

- `rhpane` — right-hand pane, desktop only, ~320px, scrollable, and **exclusive:
  only one can be open at a time**.
- `bottom` — "Big bottom location that **cannot coexist with LH/RHpane**, like
  detail / station / rplanner".
- plus `lhpane`, `small-bottom`, `center` (modal), `top` (mobile), and `nearest`
  (embedded _inside_ detail/station).

**The load-bearing fact is that third bullet: the detailed forecast is mutually
exclusive with the summary panes.** Windy has two forecast presentations on two
different edges and you cannot have both at once — a deliberate, enforced
either/or rather than a layout accident.

**Primary control** is the **layer picker** (what the map paints) with the
**timeline scrubber** at the bottom (when), and a play button that animates the
map forward. **Place-picking** is search, favourites, or — the distinguishing
move — **clicking any arbitrary point**, which drops a picker dot: Windy has no
canonical spot list, any lat/lon is a valid place.

The **detail panel and the meteogram are two view modes of one bottom pane**
(`basic` / `meteogram` / `waves`, plus an aviation `airgram`). Meteogram bands,
top to bottom: temperature & dew point; wind speed and gusts; altitude/pressure
references; sea-level pressure; precipitation colour-coded by type; and a grey
band at the bottom that is **relative humidity by altitude, not cloud cover** —
a distinction Windy makes explicitly.

**[gap]:** the section order _inside_ the right-hand pane's summary forecast.
Every retrieval hit the SPA shell. The pane's existence, position, width and
exclusivity are verified; its contents are not, and are not guessed at here.

### A.9 Windfinder — **[R]**, fully verified from live HTML

Three URLs fetched 2026-09-11. Real slugs are `la_jolla_pier`, `la_jolla_beach`,
`la-jolla_scripps-canyon`, `la-jolla_noaa-fisheries`; my earlier `/forecast/la_jolla`
404 was a bad guess, not a blocked page.

**The key structural decision: now and forecast are on separate URLs behind a
persistent tab row**, all sharing one header.

- `/forecast/<slug>` — GFS, 13 km, 3-hourly, 10 days
- `/weatherforecast/<slug>` — **Superforecast**: 5 km, **1-hourly**, 3 days
- `/report/<slug>` — "Real time wind & weather report"

Tab row, directly under the spot name: **`Forecast | Superforecast | Report |
Statistics | Tides | Webcams`**.

Reading order on the forecast page: nav → `<h1>` **page type first, place
second** (`Wind, waves, weather & tide forecast / La Jolla Pier`) → **a one-line
now strip inline in the header**: `12 kts` `South-Southwest` + _"Report from
local weather station at 10:20 local time"_ — that is the _entire_ current-
conditions presence on this page → spot meta row (sunrise, sunset, local time,
elevation) → tab row → `Daily forecast` with an **`as: Tables | Bird's-eye`
toggle** on the same line → **provenance line** (`Last update:` / `Next update:`
/ which model) → the table → distance-sorted nearby spots **with per-spot
capability tags** (`Tides`, `Waves`, `Weather station`, `Live measurements`) →
popularity, additional info, footer.

**Table orientation: rows are the variables, columns are the time steps** — a
sticky left gutter of parameter labels, with each day a horizontally scrolling
section of time-step columns. Row labels in order: `Local time` · `Wind
direction` · `Wind speed` · `Wind gusts` · `Cloud cover` · `Precipitation type`
· `Precipitation (mm/3h)` · `Air temperature` · `Air pressure` · `Wave
direction` · `Wave height` · `Wave period` · `Tide type` · `Time` · `Tide
height`. Superforecast adds `Feels like` and `Relative humidity`, switches to
`mm/1h`, and adds a `Show night hours` toggle.

Note **tides are three rows inside the same grid**, not a separate chart —
Windfinder is the only product surveyed that folds tide into the main forecast
matrix rather than giving it a module.

Two details worth copying: absent data is stated as **`No data available`**
rather than hidden; and the page carries an explicit `Next update:` time, not
just a last-updated stamp. One detail worth not copying: the page's own prose
says forecasts come "in time steps of 6 hours" while the table renders 3-hourly
— their explanatory copy has drifted from their data, which is the failure mode
`docs/` in this repo is also prone to.

### A.10 Windy.app — **[R]** for the web page and the table, **[R-doc]** for the native app

A different product from Windy.com. The web spot page was fetched live and the
forecast table's row order was read out of the widget's JavaScript bundle, so
that part is source-verified.

Two structural signatures, and **both are directly relevant to this redesign**:

1. **The audience is a control, not an assumption.** An activity picker sits
   near the top: `Kitesurfing / Boating / Cycling / Diving / Fishing (Fresh) /
Fishing (Salt) / General Weather / Hiking / Kayaking / Paragliding / Sailing
/ Snow Sports / SUP / Surfing / Windsurfing` — and it re-weights what the
   forecast emphasises. Nothing else in the survey has an equivalent.
2. **A per-day verdict list — one row per day for ten days, each a status glyph
   plus a sentence.** Verbatim examples:
   - `✅ Good kite forecast: wind 9.5 m/s, gusts 15.3 m/s, no major model differences`
   - `⚠️ Models wind forecasts diverge significantly (> 5.7 m/s) (GFS27 10.8 m/s vs ICON Global 5.1 m/s)`
   - `ℹ️ Strong wind – experience required`
   - `ℹ️ Unlikely breeze — 0% probability`

   **Model _disagreement_ is surfaced to the reader as a first-class warning**
   rather than buried in a probability column — the opposite of Surfline's
   `Prob.` column and MSW's `Prob.`

Table orientation matches Windfinder: **variables down, hours across.** The row
order is literally an array in the bundle: `wind-direction, wind-speed,
wind-gust, air-temp, clouds, precipitation, fog, waves-direction, waves-height,
waves-period, tides, moon-phase`. Windy.app's guide states the intent: _"the
forecast table is your main tool — pick an exact hour and see all parameters in
one column."_

**[gap]:** whether the native app has a "now" block distinct from the first
table column. The web page has none — the nearest meteostation module is the
only measured data and it sits far down the page. Two of Windy.app's own guides
disagree about the native spot screen's composition and were not reconciled.

### A.11 The orientation split — a cross-cutting finding

Worth isolating, because it bears directly on the week grid.

- **Magicseaweed and Surfline put time down the left and variables across.** A
  row is a _moment_; you scan downward through the day. MSW's star column only
  works in this orientation — a vertical run of stars is a shape you take in at
  a glance, which is exactly what its help text claims for it.
- **Windfinder and Windy.app put variables down the left and time across.** A
  row is a _variable_; you scan rightward through its arc.

The first reads like a diary. The second reads like a strip chart. **The repo's
week grid is the second** — seven day blocks with the same four labelled
readings aligned across them — and that is the right choice for "which day
should we go", because comparison across days is a horizontal scan of one row.

**A second correlation worth naming: the "now" block's richness tracks whether
the product owns instruments.** Surfline has the fullest one because it has 550+
cameras, smart-cam wave measurement and human forecasters to fill it, and it
labels every field's provenance. MSW's looked similar but was, by its own
admission, just the model's current row. Windfinder's is one measured wind
number in the page header. Windy.com and Windy.app have essentially none — the
current hour is just the first column. **This site owns no instruments either;
it relays two.** That argues for the measured band being _small and heavily
attributed_ rather than large — which is what it already is.

### A.12 Apple Weather — **[R-doc]**

From MacRumors' iOS 15 Weather guide and Apple's own support page.

- Card-style interface; the main view leads with current conditions and an
  **hourly scroller** the user shifts through.
- Then a **10-day forecast**.
- Then named detail modules: **"air quality, temperature, UV index, sunset and
  sunrise, wind, precipitation, humidity, visibility, and pressure"**.
- Later versions add a **Highlights** section at the very top carrying
  "need-to-know weather information for the day", and let the 10-day row switch
  between temperature / precipitation / wind so the _same seven-to-ten rungs_
  re-render for a different variable.

Where the city switcher sits (bottom bar / list view) is **[recall, unverified]**.

**Takeaway:** Apple's now → hourly → 10-day → detail-modules order is the
canonical **timeline spine**, and the "10-day row swaps variable" mechanic is
directly applicable to a week grid carrying four rows.

### A.13 Google search weather card — **[R]**

From 9to5Google's documentation of the card (2022 redesign, plus a 2024 air
quality addition and a 2026 redesign note).

- **Top-left**: current temperature and "feels like"; across from it, condition,
  precipitation, humidity, wind.
- **Four tabs in order**: `Overview`, `Precipitation`, `Wind`, `Humidity`
  (air quality added later). Overview contains a 24-hour forecast.
- **A second carousel at the bottom**: the 10-day outlook.

The location control's position is **[gap]** — the article does not say.

**Takeaway:** Google splits by _variable_ (tabs) after splitting by _time_
(24-hour then 10-day). One block, one control, two carousels — the whole thing
is designed to fit inside a search result, i.e. inside a fold.

### A.14 Carrot Weather and Hello Weather — **[R-doc]**

Two opposite philosophies, both documented in reviews.

- **Hello Weather** is described as showing "everything in one screen" — a
  single-screen dashboard where "you can almost see everything from the main
  screen".
- **Carrot Weather** ships a **Layout screen** where the user builds their own
  page: "adding new components, rearranging them, changing their design, and
  inserting additional data points", with multiple saved layouts for different
  seasons or activities.

Reviewers name the cost of the Carrot approach explicitly: "presenting too much
information which might overwhelm users who prefer less information."

**Takeaway:** user-arrangeable layouts are a real pattern, but they are a
confession that the designer could not decide the ranking. For a page with one
audience and one question, deciding is cheaper.

### A.15 Tide-specific apps (Tides Near Me, Tide Alert, Tide Guide, eTide) — **[R-doc]**

From app-store listings and reviews.

- Tides Near Me's home screen "displays the current tide status and the time for
  the next high or low tide" — i.e. **the primary object is the _next_ event,
  not the curve**. The curve and the table are secondary.
- Tide Alert, Tide Guide and eTide all lead with **widgets** — lock-screen,
  home-screen, Dynamic Island — sized 1×1 upward, showing "the next tide".
- Tide Guide tracks "tide progress, the next tide, wind, or sun and moon events
  from the lock screen".

**Takeaway:** the entire tide-app category has converged on _one sentence_:
"rising/falling, next event at HH:MM". That is the single-answer principle
applied to a continuous variable, and it is worth stealing for the week grid's
"today" column.

### A.16 BeachSafe (Surf Life Saving Australia) — **[R]**, via archive

The live site is now client-only (a raw fetch returns 6,313 bytes reading
`Loading App...`), but the **October 2024 / January 2025 build was
server-rendered** and is complete in the Wayback Machine. The reading order
below is that build — Coogee, 20 Oct 2024 capture. Whether today's rewrite
preserves it is **[gap]**.

1. Global nav (Rip Currents / Multilingual / Surf Safety / About / SLS / Apps).
   **No search on the beach page.**
2. **Sticky header row.** Left third: umbrella icon + `COOGEE`, an empty
   `beach-status` badge slot, breadcrumb `NSW › Randwick › Coogee`, and a
   **Directions** link to Google Maps.
3. **Right two-thirds of that same row — the "now" strip.** Seven equal cells,
   big value over small grey caption: `Weather Forecast` · `18.50°C / Current
Temperature` · `41.00km/h / Wind speed` · `19.37°C / Water Temperature` ·
   `1.01m / Swell` · `0.24m / Tide` · `8/11 / UV`. **Marked
   `d-none d-sm-inline` — the entire numeric strip is hidden on mobile.**
4. Photo carousel, a **Favourite** button, the **expert prose description**
   truncated behind `read more`, then `Beach Length: 0.4km`, then
   **`General Hazard Rating: 4/10`**.
5. **`Patrols`** — a 7-column days × providers grid (rows are named
   organisations; cells are hours or `-`; today's column highlighted yellow).
   Where no service exists the grid is replaced by prose.
6. `Information` (facility chips) → 7. `Regulations` → 8. `Hazards` (chips;
   empty at Coogee, `Topographic rips` at Bondi).
7. **`Weather`** — a tab bar `Weather | Swell | Wind | Tide | UV | Radar`, each
   tab a `<canvas>`.
8. Disclaimer → 11. `Near By Beaches` cards (name, today's patrol hours, air
   temp, wind, swell, distance) → 12. legend, promos, footer.

**Three findings that matter more than the order.**

- **The hazard rating is not a verdict and is not at the top.** `General Hazard
Rating: 4/10` is plain body text, roughly fifth down, _below_ a long prose
  paragraph, with no colour, no band word and no scale reference on the page.
- **It is a constant, not a condition.** The ABSAMP 1–10 scale (Surf Life Saving
  Australia with the University of Sydney Coastal Studies Unit) rates the
  **beach's physical character**, not today — which is why it is typeset as a
  fact. Band wording, verbatim (from a newspaper piece using the app, so
  **[R-doc]**): 1–3 "Least hazardous… however, supervision still required, in
  particular for children and poor swimmers"; 4–6 "Moderately hazardous"; 7–8
  "Highly hazardous… considered dangerous"; 9–10 "Extremely hazardous".
- **Now vs forecast is split with nothing in between**: a seven-number strip at
  the top, then tabbed charts at position 9. No "this afternoon", no trend.
  Patrol is the sole exception and deliberately merges both in a week grid.

**Place-picker** lives on the homepage, not the beach page: geolocation button,
`Search beach` box, three checkbox filters (`Has toilet`, `Has Parking`,
`Dogs allowed`), and a ranked **"Nearest patrolled beaches"** list whose rows
carry air temp, wind, swell and distance. Note the default is _patrolled_
beaches, not nearest.

### A.17 RNLI beach pages — **[R]**, via archive

`rnli.org` returns 403 to fetching and to curl with a browser User-Agent;
retrieved from a 2025 Wayback capture of Perranporth. URL pattern is
`rnli.org/find-my-nearest/lifeguarded-beaches/<slug>`.

1. Nav, breadcrumb.
2. **Tab bar: `Perranporth Beach | Forecasts and tides | News and media`** —
   the page's primary control.
3. Share buttons → 4. `<h1>Perranporth Beach</h1>`
4. **One authored tourism paragraph** ("Its miles of golden sands are great for
   surfers, snorkelers and bodyboarders - and popular with families…").
5. **`Lifeguard patrol dates 2025*`** — `Daily` / `05 April - 02 November`,
   `Patrol times` / `10am - 6pm`, then
   **`Please remember - No Flags = No Lifeguards`**.
6. **`Today's weather`** — `15°C`, `Cloudy`, `Min: 10°C`, `Max: 15°C`, and a
   link `Get a 5-day forecast`.
7. `Beach information` — a tab set whose contents are **identical on every beach
   page** (generic safety bullets, two PDFs, lifeguard recruitment).
8. Directions, donate → 10. beach news → 11. accuracy footnote, then
   **`No Flags = No Lifeguards` repeated**.

**The sections the brief expected are not there.** No hazards section, no water
quality, no facilities, **and no tide times** — tides, the 5-day forecast and a
`Time | Wave height | Wave period` surf table at 3-hour steps are all one click
away on `Forecasts and tides`. (RNLI's marketing copy does describe water
quality and hazards as part of the _beach finder_; the rendered beach page in
this capture does not carry them.)

**The structural lesson, and it is the sharpest negative in the survey:** the
first operational fact after the beach's name is the **lifeguard patrol season**
— a date range and an opening-hours pair. RNLI answers "is this beach OK today"
with a _staffing_ answer, not a conditions answer, and everything time-varying
lives on a second page. Its place-picker is a **paginated alphabetical list of
248 beaches** (12/24/48 per page, 21 pages), and **the result cards carry no
conditions at all** — just a name and `More details`. You can find a beach; you
cannot compare two.

### A.18 National Park Service conditions pages — **[R]**

Fetched `nps.gov/cabr/planyourvisit/conditions.htm` (Cabrillo National Monument,
San Diego).

Heading order: **`Alerts & Conditions`** → **`Alerts`** (empty when fetched) →
**`Current Conditions`** → then named standing items (`Cabrillo Sea Cave
Closed`, `Smoke-Free Policy`, `Trash-Free Initiative`) → contact and footer.

Cape Hatteras and Point Reyes carry the same `planyourvisit/conditions.htm`
chassis.

Cape Hatteras (`nps.gov/caha/planyourvisit/conditions.htm`, also **[R]**) runs
the same chassis with more content: `Alerts` (first, and **rendered even when
empty**) → `Beach Access Info` → **`Beach Access Status`** (ramp-by-ramp across
three islands, each with status, hours and notes) → **`Mileage Summary`** (a
table of total vs currently-open miles and percentages) → **`Ocean Info`**,
last, which is two links and the three rip-current definitions.

**Takeaways, and the main one is negative.**

- **No live instrument data on either page — zero readings, zero feeds.** The
  only quantitative thing on the Cape Hatteras page is a count of open vehicle
  ramps. The actual rip-current forecast is off-site at `weather.gov/beach/mhx`;
  NPS ships only the _definitions_ of the levels and a link to someone else's
  number.
- **Alerts are a structurally reserved first block**, rendered even when there
  is nothing in them. Exceptions first, steady state second, never interleaved.
- **The ordering principle is what the agency manages, not what a visitor is
  asking.** Beach _driving_ access gets a ramp-by-ramp table and a percentage
  summary; the ocean gets two links at the bottom. Freshness is a single
  `Last updated` date per block rather than an ordering.

I had initially read the NPS ordering as _decay rate_ — true today, true this
season, true always — and that reading does not survive Cape Hatteras. **Decay
rate is still a good organising axis for the redesign (§C.9), but it should be
credited as an idea rather than as NPS's practice.**

### A.19 Hawaii Beach Safety — **[R]**, via archive — _the closest structural match found_

`hawaiibeachsafety.com` now 301-redirects to a commercial successor
(`safebeachday.com`), but the state-backed original (PacIOOS / SOEST / Hawaii
DOH / Hawaii Tourism Authority / the four county Ocean Safety divisions) is
preserved. **This is the single most relevant page in the survey** and it is
worth reading in full. Reading order (`/oahu/waikiki-dukes`, Dec 2022 capture):

1. `<h1>Waikiki - Dukes</h1>`
2. **`Current conditions at Waikiki at Duke Paoa Kahanamoku Beach Park`**
3. **Two verdict cards side by side**, each = heading + rating word + an advice
   sentence + who it is for:
   - `Beach & Nearshore` → **`Caution`** → _"Approach the water with caution. Be
     aware that ocean conditions can change. This is the safest level of
     nearshore conditions."_ → _"Primarily for beachgoers and surfers"_
   - `Offshore` → **`Caution`** → _"Be cautious and maintain alert for choppy
     seas, currents, and breaking waves…"_ → _"Primarily for boaters and
     kayakers"_
4. `Learn more about these rating signs and alerts.` +
   **`Ratings updated Tuesday, December 06, 2022 - 12:55pm`**
5. **`Weather`** — `85° F`, `Mostly Cloudy`, `Winds East at 10.4 MPH (9 KT)`,
   **`Recorded Tuesday, December 6, 2022 - 12:53pm`**, then
   `View 7 Day Weather Forecast`
6. **`Surf Forecast (Official)`** — `0-2 feet`,
   **`Forecast Tuesday, December 6, 2022 - 10:06am`**
7. `Recommended Activities` (icons) → 8. `Amenities` → 9. feed links (`rss` /
   `json`) and `Beach ID: 8` → 10. also-known-as names → 11. `News`
8. **`Background`** — the long authored encyclopaedia description, credited to
   John R. K. Clark's _Beaches of Oʻahu_ — **dead last**
9. Agency credit, then other-beach lists.

**Four moves worth stealing.**

- **Verdict first, prose last** — exactly inverted from BeachSafe. The
  encyclopaedia paragraph cannot delay the answer because it is at the bottom.
- **Every value carries its own freshness word, and the word differs by kind** —
  ratings are `updated`, weather is `Recorded`, surf is `Forecast`. **Now vs
  forecast is separated per value rather than per section.** This is cheap, it
  scales, and it is the single most transferable idea in the whole survey for a
  page whose three layers are now / week / day.
- **The verdict is split by _who you are_, not by topic** — nearshore for
  swimmers, offshore for boaters, each with an explicit "primarily for…" line.
  Two ratings, one page, no tabs.
- **The island page is the comparison view**: a map with a Nearshore/Offshore
  toggle, then a table grouped by **shore** (`Oahu South Shore`, `Windward
(East)`, `North Shore`, `Waianae (West)`) with columns
  `Nearshore | Offshore | Beach`. Geography is the grouping key — you scan the
  shore facing the swell — not distance and not alphabet.

The homepage carries **`Recommended Beaches`** — a live, condition-filtered
shortlist per island that can legitimately be empty and says so
(_"Kauai (0) — No beaches are currently recommended."_). A shortlist that is
allowed to be empty is a strong pattern and a rare one.

**The successor site** (`safebeachday.com/waikiki/`) was retrieved and rendered
**no live readings at all** — description, amenities, activities, prohibitions,
hazards, disclaimer. Whether status is client-rendered there is **[gap]**.

### A.20 Safeswim (Auckland Council, NZ) — **[R]** for the key page, SPA otherwise

Beach pages are a pure SPA (a raw fetch returns `No beaches found.`), but the
pin key at `safeswim.org.nz/pins` is static and definitive, and it carries the
idea worth taking.

**Two independent risk axes that are never merged into one verdict.**

- _Water quality_ (illness): `Suitable for swimming` · `Swimming not advised`
  (currently unsuitable) · `Swimming not advised` (long-term, "consistently
  poor") · `Do not swim` (wastewater overflow nearby) · **`Data interruption`**
  (temporarily unavailable) · **`No water quality data`** (not available at this
  location).
- _Water safety_ (drowning): `Surf Life Saving` (lifeguards **not** on duty) ·
  `Surf Life Saving` (on duty) · `Dangerous conditions` ("The flagged area is
  closed…") · `Swimming not advised` ("High risk of injury or drowning.") ·
  `Exercise caution`.

**Two findings.** First, **"no data" is a first-class, named state — twice
over**, distinguishing a temporary interruption from a location that was never
instrumented. That is directly applicable to a page where the rip level reaches
26 of 51 beaches and a buoy reaches 15. Second, the **same words are reused
across both axes** (`Swimming not advised` appears in each), which keeps the
vocabulary small but makes the pin alone ambiguous about _why_ — a caution
about over-economising on wording.

### A.21 Volusia County, FL beach flags — **[R]**, for the redundancy pattern

`Double red` — "water is closed to the public" · `Red` — "high hazard meaning
high surf and/or strong currents" · `Yellow` — "medium hazard" · `Green` —
"low hazard meaning calm conditions, exercise caution" · `Purple` — "dangerous
marine life spotted". Plus the standing line: _"Absence of flags does not assure
safe waters."_

**The pattern worth naming:** severity is escalated by **count** (double red vs
red), not only by hue. A redundant channel that survives greyscale _and_ a
distant view, which is what a flag has to do.

### A.22 AirNow AQI — **[R]**, included as the risk-scale exemplar

Not a beach product, but the best-documented public-safety risk scale in US
government practice, and directly applicable to the rip current level.

Six categories, each carrying **a colour, a numeric range, a name, and a
sentence**: Green 0–50 "Good"; Yellow 51–100 "Moderate"; Orange 101–150
"Unhealthy for Sensitive Groups"; Red 151–200 "Unhealthy"; Purple 201–300 "Very
Unhealthy"; Maroon 301+ "Hazardous" — with a health sentence attached to each
("Air quality is satisfactory, and air pollution poses little or no risk", etc.).

**Takeaway:** four redundant encodings of one value — colour, number, name,
sentence — so the value survives greyscale, colour-blindness, and a reader who
does not know the scale. NWS's rip scale has three of the four (colour, name,
sentence) and deliberately omits the number.

---

### A.23 The survey, ranked by how well each answers _this_ question

"Is this beach OK today, for my kids" — not "what are the conditions".

| #   | Product                                 | Why it ranks there                                                                                                                                                                     |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Hawaii Beach Safety**                 | Verdict + advice sentence + per-value timestamp, split by user type, prose last. Best structure in the set; worst list-view accessibility.                                             |
| 2   | **Safeswim**                            | Two independent axes never collapsed, and "no data" as a named state.                                                                                                                  |
| 3   | **NWS Surf Zone Forecast / beach page** | The answer with its instructions attached — but no place identity and no "now".                                                                                                        |
| 4   | **BeachSafe**                           | Richest data of any product here, undone by placement: the rating is a static constant buried mid-page in body text, the "now" strip is hidden on mobile, the forecast is behind tabs. |
| 5   | **weather.gov point forecast**          | Hazards → now → week → prose is a sound order, but it is a weather page, not a beach page.                                                                                             |
| 6   | **RNLI**                                | Answers a _staffing_ question, not a conditions question. Everything time-varying is on a second page; the beach list carries no conditions at all.                                    |
| 7   | **NPS**                                 | Organised around what the agency manages. No live data. At Cape Hatteras the ocean is two links at the bottom of a page about vehicle ramps.                                           |

The surf products (Surfline, Magicseaweed, Windy, Windfinder) are deliberately
absent from this ranking: they answer a different question for a different
reader, and their value to this redesign is mechanical (shared time axes, table
transposes, view toggles) rather than structural.

---

## B. The archetypes

Six, distilled from the survey. For each: the structure, what it optimises, what
it costs, who uses it, and whether it survives a 639px fold.

---

### B1. Verdict-first

**Structure.** One judgement occupies the top of the page, alone or nearly
alone, at a size nothing else on the page competes with. It carries its own
scale definition inline. Every measurement is subordinate and below it. The
page's job is to answer one question before the reader has to read anything.

**Optimises for.** The single-answer reader — the one who wants to leave having
learned one thing. Lowest possible literacy requirement. Best possible
glanceability: the answer is the page's focal point, so there is no scanning
task at all. Survives being screenshotted and sent to a spouse.

**Costs.**

- **Coverage.** A verdict-first page needs a verdict for _every_ place and
  _every_ day, or the hero slot is empty and the page looks broken. This is the
  archetype's real tax.
- **Compression.** One word cannot carry a nuanced state, and readers
  over-trust it. Magicseaweed's star rating was criticised as "subjective and
  arbitrary" precisely because a synthesised verdict invites more weight than it
  can bear.
- **Liability.** If the site synthesises the verdict, the site owns it.
- It pushes everything else below the fold by construction.

**Who uses it.** **Hawaii Beach Safety is the exemplar** — two verdict cards at
the very top, each with its advice sentence and its audience, and the
encyclopaedia prose banished to the page's foot **[R]**. NWS Surf Zone Forecast
(rip current risk is field 1, before surf height) **[R]**; NWS experimental beach
page, where the map is coloured by the verdict **[R]**; AirNow **[R]**; Safeswim
**[R]**; Surfline, for an expert audience, with a synthesised seven-level quality
word above the numbers **[R]**.

**BeachSafe is the counter-example that proves the archetype is a _placement_
decision, not a data decision** — it has a hazard rating and puts it fifth down
in plain body text below a prose paragraph, which makes it not verdict-first at
all **[R]**.

**A refinement worth naming: the two-axis verdict.** Hawaii splits its verdict by
_who is asking_ (nearshore for swimmers, offshore for boaters); Safeswim splits
by _what could go wrong_ (illness vs drowning) and **never merges the two into
one number**. Both refuse to collapse genuinely different risks into a single
word. For this site the natural second axis is _in the water_ vs _on the sand_ —
tidepooling at a low tide is a different question from swimming, and the rip
level answers only one of them.

**Survives 639px?** **Yes, easily — it is the only archetype designed for a short
fold.** A verdict plus its sentence is 2–4 lines. The question is not whether it
fits but what you are willing to put below it.

---

### B2. Now-band plus timeline spine

**Structure.** A thin "as of this instant" strip directly under the page header,
then a single continuous time axis running down the page at decreasing zoom:
week → chosen day → hours. The spine is the backbone; everything else hangs off
the currently selected rung.

**Optimises for.** "Which day should we go?" — comparison across time, which is
the one task a grid does better than prose. Also makes the now/forecast boundary
structural rather than typographic: above the spine is measured, below it is
modelled.

**Costs.**

- The now-band and the spine compete for the same fold. Every pixel the band
  spends is a pixel the week's first rung loses — which the repo has already
  measured: the band as a full-width block cost "77px of band plus a 36px
  margin, above a week grid whose top edge then fell 51px below a 639px fold"
  (`src/components/conditions/ConditionsSection.tsx`, comment dated by its own
  history — **treat the figures as dated**).
- Time axes want width. A seven-across grid is impossible on a phone, so the
  spine must transpose or stack there — which turns a comparison object back
  into a list (see §C.7 for what this repo already does).
- Two zoom levels of the same instrument invite the reader to wonder which one
  is authoritative.

**Who uses it.** Apple Weather (now → hourly → 10-day → modules) **[R-doc]**;
Google's weather card (current block → 24-hour carousel → 10-day carousel)
**[R]**; Surfline (`Current Surf Conditions` → written report → 16-day forecast →
a collapsible graph stack) **[R]**; Magicseaweed (`Current Conditions` → the
table, with tide-and-daylight bands between day blocks) **[R]**; weather.gov
(current conditions panel → seven cards → the same seven as prose) **[R]**.

**The variant worth knowing about: Windfinder puts the spine on a different URL
from the now block** — `/forecast/`, `/weatherforecast/` (hourly Superforecast)
and `/report/` (real-time) behind one persistent tab row, with only a single
measured wind reading inline in the forecast page's header **[R]**. That is this
archetype crossed with B5, and it is what you do when the now data is thin —
which is the situation on 15 of 18 areas here.

**Survives 639px?** **Yes, conditionally.** The condition is that the band is
_one line_ and the spine's first rung begins above roughly y≈400, leaving ~240px
for a grid row. This is the archetype the current page is already closest to.

---

### B3. Dashboard grid (single screen, no scroll)

**Structure.** Every block is a tile; the tiles tessellate one screen; nothing
scrolls. Stephen Few's definition of a dashboard is exactly this — "a
single-screen UI ... used daily ... to keep track of the overall state of
something", "presented in a way that allows them to monitor what's going on in
an instant".

**Optimises for.** Zero interaction cost. Everything is simultaneously visible
and therefore comparable. Rewards a returning reader who has learned the layout.

**Costs.**

- Few's own framing names the failure mode: "Dashboards are usually required to
  display a great deal of somewhat disparate information in a limited amount of
  space (a single screen). It is challenging to squeeze all this information
  onto the screen without ending up with a cluttered mess."
- It **flattens hierarchy**. If everything is a tile, nothing is the answer.
  Reviewers say exactly this about Carrot Weather: "presenting too much
  information which might overwhelm users".
- To fit, you shrink type — and ADR-0015 in this repo already records what
  happens then: at 10px "a full-colour emoji is not a mark; it is a smudge".

**Who uses it.** Hello Weather ("everything in one screen") **[R-doc]**; Carrot
Weather's Layout screen, which makes the tessellation user-editable **[R-doc]**;
Windy.com's bottom detail pane, which tiles one screen and is deliberately exclusive with the side panes **[R]**.

**Survives 639px?** **Not with eight content blocks.** 639px minus site nav
minus a page header leaves roughly 450–500px of tile space. That is about four
tiles at a readable density, not eight. This archetype only survives here by
dropping blocks, and the blocks it would drop (week, day) are the ones that
answer "which day".

---

### B4. Map-anchored

**Structure.** A map is both the primary control and the primary display. Place
selection _is_ clicking the map. Data arrives as colour on the map plus a panel
that appears beside or beneath it.

**Optimises for.** "Which beach?" rather than "when?". Spatial comparison —
seeing that the whole county is Moderate today but one headland is High.
Discovery for a reader who does not know the place names.

**Costs.**

- **The most expensive element per pixel on the page.** A map below roughly
  300×300 stops being legible, and the repo has already measured this: the map
  column is "472px wide at the review viewport (1536×639)" and the alternative
  was "1,908 pixels of picture in a 639-pixel window"
  (`docs/adr/0051-the-area-map-is-square.md` — **[R]**, in-repo, dated).
- It answers _where_, and the audience's live question is largely _when_.
- At 375px a map is nearly the whole screen. The repo's own measurement: the map
  column "measures 472px at 1536×639 but **342px on a 390px phone**"
  (`src/components/conditions/BeachPins.tsx`).
- Needs tiles or traced geometry; needs JS.

**Who uses it.** NWS experimental beach forecast page, where the map is
colour-coded by rip risk and "click on the beach area of your choice" is the
entire navigation **[R]**; **Windy.com, where the map literally is the page** — `#map-container` is absolute at all four edges and every panel floats on top of it **[R]**; BeachSafe, whose picker is a map plus a distance-ranked list **[R]**.

**Survives 639px?** **Only by being the sole thing above the fold.** A usable map
plus a header consumes the screen. That is a defensible choice for a
"which beach" product and a bad one for a "which day" product.

---

### B5. Progressive drill-down (hub → place → detail route)

**Structure.** The page is a shallow hub. Detail lives on its own URL. Each
level answers one question and links to the next. Nothing is disclosed in place.

**Optimises for.** Fold economics — each screen has few blocks, so each fits.
Shareable and printable URLs. Graceful degradation without JS. Cheap to make
accessible.

**Costs.**

- Round trips. Comparing Saturday to Sunday becomes navigation rather than
  scanning, which is the exact failure mode the repo's own plan names: "the
  reader who came to compare Saturday against Sunday has to scroll past all
  eight [figures] to reach anything that mentions Saturday"
  (`docs/plans/the-measured-band.md` — **[R]**, in-repo).
- Breaks the week/day relationship across a page boundary — and the week and the
  day are the same instrument at two zoom levels, so splitting them hides the
  relationship that makes both legible.

**Who uses it.** **Windfinder is the cleanest example** — `Forecast |
Superforecast | Report | Statistics | Tides | Webcams` as six URLs behind one
persistent tab row, with the now data on its own page **[R]**. Also: RNLI, where
the beach page and `Forecasts and tides` are separate pages and _everything_
time-varying is on the second **[R]**; Surfline's `Report & Forecast | Analysis |
Charts | Guide` tabs and its `Live` / `Forecast` app tabs **[R]**; NPS, where
`Alerts` and `Current Conditions` are a hub **[R]**; NOAA Tides & Currents
**[R]**; weather.gov, where the hourly graph and the forecast discussion are each
their own page **[R]**.

**The in-place cousin worth stealing regardless of archetype:** Surfline's
**collapsible graph stack** — Tides, Swell, Nearshore Energy, Wave Consistency,
Weather, each with its own collapse control, on the stated rationale "if the data
isn't of interest, just hide it" **[R]**. Per-region disclosure rather than
per-page navigation, and it costs no round trip.

**Survives 639px?** **Yes, trivially — that is the point of it.** It survives by
having less to fit.

---

### B6. Table of record

**Structure.** One dense table is the whole page. Rows are variables, columns are
time steps (or the transpose). No verdict layer, no separate "now", no prose.
Every cell is a number or a glyph.

**Optimises for.** Expert comparison and maximum information density. Printing.
Fitting a lot of time into one screen. It is the highest data-to-ink ratio
available.

**Costs.**

- **It is hostile to a non-expert.** It has no entry point: there is no single
  cell that is the answer, so the reader must know what to look for. That is
  disqualifying for "a parent deciding whether to take kids tidepooling".
- Brutal at 375px. The honest guidance is that fitting is not the same as
  reading: "A table can technically fit on a 375px screen and still be useless.
  Fitting just means no horizontal overflow."
- Its verdict column, when it has one, attracts the criticism aimed at MSW's
  stars.

**Who uses it.** Magicseaweed **[R]**, whose eight columns are verified from its archived `<th>` elements; Windfinder and Windy.app **[R]**, both transposed (variables down, time across); Surfline's table view **[R]**; NOAA tide
tables in `Data Only` mode **[R]**.

**Survives 639px?** **Yes — a table is almost exactly a fold-shaped object.** It
survives the _constraint_ and fails the _audience_, which is the most useful
thing to know about it.

---

### Archetype summary

| Archetype                    | Answers                     | 639px fold          | 375px phone | Fit to this audience            |
| ---------------------------- | --------------------------- | ------------------- | ----------- | ------------------------------- |
| B1 Verdict-first             | "Is it OK?"                 | Excellent           | Excellent   | **High** — but coverage-limited |
| B2 Now-band + timeline spine | "Which day?"                | Good, conditionally | Fair        | **High**                        |
| B3 Dashboard grid            | "What's the overall state?" | Poor with 8 blocks  | Poor        | Low                             |
| B4 Map-anchored              | "Which beach?"              | Poor                | Poor        | Medium                          |
| B5 Progressive drill-down    | "Tell me about X"           | Excellent           | Excellent   | Medium                          |
| B6 Table of record           | "Give me everything"        | Good                | Poor        | **Low**                         |

---

## C. The standards that actually bear on this page

### C.1 The fold is a budget, and 639px is a small one

- **57% of viewing time is spent above the fold**; 74% in the first two
  screenfuls; the remaining 26% spread over everything below. Within the first
  screenful, **"more than 65% of the viewing time above the fold was
  concentrated in the top half of the viewport"** — so on a 639px window, the
  top ~320px carries roughly two-thirds of two-thirds of all attention.
  (NN/g, _Scrolling and Attention_.)
- **"The average difference in how users treat info above vs. below the fold is
  84%"** — the midpoint of a 102% eyetracking difference and Google's 66% ad
  viewability difference. (NN/g, _The Fold Manifesto_.)
- The fold is not a wall: "Users do scroll, but only if what's above the fold is
  promising enough." The named failure is the **false floor** — a screen that
  looks complete, so nobody scrolls. Relevant here because a measured band
  followed by whitespace reads as an ending.

**Applied:** on a 639px viewport the design question is not "what fits" but
"what earns the top 320px". At most three things can, and one of them is the
page's identity.

### C.2 Glanceability and the single-answer principle

- In HCI, a display is **glanceable** if it "enable[s] users to understand
  information quickly with low cognitive effort"; the glance is characterised as
  "a brief look – typically lasting up to 5 seconds". Matthews et al.'s
  guidelines favour "abstract, simple and minimalistic representations".
- Weather-app user research repeatedly lands in the same place: users check the
  weather "to know what they should wear that day and if they should bring an
  umbrella"; "most users couldn't care less about fancy weather charts or
  complex meteorological jargon".
- The tide-app category has converged on one sentence — rising or falling, next
  event at HH:MM — as the object the whole product is built around.

**Applied:** the page should be answerable in one glance to the question the
audience actually has, and that question is _not_ "what is the significant wave
height". It is "can they go in the water, and is today or Thursday better".
Exactly two answers, so exactly two hero slots.

### C.3 Scanning: design for layer-cake, not F

NN/g's eyetracking taxonomy (_Text Scanning Patterns_):

- **F-pattern** — produced by dense text with no subheadings or hierarchy.
  Comprehension "poor to moderate"; the article calls it the least effective.
- **Spotted** — jumping to visually distinct words, numbers, capitals. Slightly
  better.
- **Layer-cake** — produced by "clear headings and subheadings with contrasting
  visual styling, chunked sections". Comprehension "very good".
- **Commitment** — near-full reading; occurs with high motivation or high stakes.

Guidance: "support them by chunking your content into sections and bulleted
lists, by using meaningful subheadings, and by special visual styling for
keywords."

**Applied:** a data page is scanned in the spotted pattern by default, because
numbers are visually distinct. The way to convert that into layer-cake is
_region headings that name the question each region answers_ — not the data type.
"This week" beats "Forecast". A parent scanning left edges should hit a ladder of
questions, not a ladder of nouns.

The dashboard-specific corollary: "Since the top left area gets more attention,
that's where you want to showcase the most global numbers, or the most relevant
data", and "the further down users get on a page, the less they scan the full
width of the row". (Pencil & Paper, _Dashboard Design UX Patterns_.)

### C.4 Progressive disclosure, done to Nielsen's rules

Nielsen's two requirements:

1. **Get the split right** — "disclose everything that users frequently need up
   front, so that they have to progress to the secondary display only on rare
   occasions", while not putting "too many options [in the primary list] or
   you'll fail to sufficiently focus users' attention".
2. **Label the progression** — the control must be "label[ed] in a way that sets
   clear expectations for what users will find when they progress to the next
   level".

Nielsen explicitly does **not** endorse a fixed percentage; he recommends task
analysis and frequency-of-use data instead.

**Applied — and checked against the repo, where this is already right.** The
notes block is a `<details>` whose `<summary>` carries an `<h2>` reading
**"How to read these numbers"** (`ConditionsNotes.tsx:146-153`, **[R]**), over
five terms — `Tide heights`, `Daylight first`, `Wave heights`,
`The wave forecast`, `Cloud cover`. That is Nielsen's rule 2 satisfied: the
label sets a specific expectation, and the contents match it. **Do not "fix"
this in the redesign.** Note also what it tells you about the block's real
identity: it is a _how to read_ block, not a provenance block — provenance is
already distributed, attached to each panel as its own attribution line. The
brief's description of block 8 as "provenance" is slightly off; it is a glossary.

The rule generalises to any other disclosure a variant introduces: a collapsed
day panel labelled "Thursday in detail" beats one labelled "More".

### C.5 Primary / secondary / tertiary ranking for this inventory

Ranking the eight blocks by _how often the audience's decision turns on them_:

| Rank          | Block             | Why                                                                                                                                                                           |
| ------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary**   | Rip current level | The only line that answers "can the kids go in the water". Named as such in `CONTEXT.md`: "the one thing on `/conditions` that answers whether to put children in the water". |
| **Primary**   | Week panel        | Answers "which day", which is the other half of the audience's question and the only block that supports comparison.                                                          |
| **Secondary** | Measured band     | Answers "what is it like right now" — decisive only for a today trip, and one of its two halves is absent on 15 of 18 areas.                                                  |
| **Secondary** | Area chooser      | Not data; it is the frame. High-consequence, low-frequency (chosen once).                                                                                                     |
| **Secondary** | Day panel         | Detail on a day already chosen. By definition downstream of the week.                                                                                                         |
| **Tertiary**  | Beach list        | Navigation, not data.                                                                                                                                                         |
| **Tertiary**  | Standing notice   | Must be present and near the top for the reason ADR-0009 gives; does not need to be large.                                                                                    |
| **Tertiary**  | Notes             | Provenance. Needed by few readers, but needed absolutely by those few.                                                                                                        |

The uncomfortable finding: **the measured band is the block with the most
engineering behind it and the least decision-weight**, because it answers a
question ("what is it like this second") that only matters if the reader is
leaving in the next hour — and on 15 of 18 areas it is air temperature and wind
alone.

### C.6 The scope control: an 18-item `<select>` that reframes the page

What is there today (read from source, **[R]**, `AreaSelector.tsx`): a labelled
`<select>` with 18 `<option>`s, 288px wide, pill-shaped, with a `<noscript>`
fallback list, sitting in the header row.

The standards:

- **Global filters belong in a fixed, highly visible position** — "a full-page
  filter sidebar or horizontal bar means the filter selection affects the whole
  page — every single chart at once", and global filters "should be positioned
  in a highly visible, fixed top header ... to avoid user confusion". The
  scope's placement is therefore already right.
- **Dropdowns are correct at this cardinality.** NN/g: under ~5 options, radio
  buttons win because "all options [are] permanently visible so that users can
  easily compare them"; "with many options, use either a listbox or a dropdown
  list". 18 is firmly in dropdown territory — a chip row of 18 would eat the
  fold.
- **Hick's Law**: decision time grows logarithmically with option count, and the
  documented mitigation for a long list is grouping — research on "category
  ratio" finds "the number of options under each label is more important in
  reducing choice overload than the number of labels". For 18 San Diego areas
  the obvious grouping is geographic (North County / La Jolla / Bay / Point Loma
  / South Bay), which `<optgroup>` supports natively with no JS.
- **Show the active scope outside the control.** "When filters affect the page as
  a whole, you need to make sure that every element on that page is effectively
  affected by the filtering options, otherwise it risks creating confusion." A
  `<select>` shows its value, but it shows it in the visual register of a form
  field, not of a page title. Putting the area's name into the heading (or an
  adjacent line) is what makes the scope unmistakable when the reader has
  scrolled the control off-screen.

### C.7 Density norms for numeric readouts

- Few's position, following Tufte: maximise the data-to-ink ratio, "getting out
  of the way of the data", but _also_ choose "colors, shapes, and layouts that
  allow the brain's visual processing [to] relate the elements in a way that is
  closest to their fundamental relationship". Density is not the goal; _relation_
  is. Two numbers that belong together should be adjacent, and two that do not
  should not be in the same tile because they happened to arrive from the same
  API.
- The practical floor comes from this repo's own measurement rather than the
  literature: **10px is below the floor for a glyph** ("at 10px a full-colour
  emoji is not a mark; it is a smudge", ADR-0015), and the fix chosen was to
  name rows in words and reserve glyphs for panels. That is the right rule:
  **a glyph marks a region; a cell is named in words.**
- Mobile: "A table can technically fit on a 375px screen and still be useless.
  Fitting just means no horizontal overflow. Readable means a user can scan a
  row, work out what each value refers to, and make a decision off it." The
  documented split is horizontal scroll for 3–5 comparison columns, stacked
  cards beyond that.

**Checked against the repo, and this one is already solved.** The week grid is
not a table — it is `grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7`
(`WeekGrid.tsx:364`), i.e. **one column at 375px**, seven only from 1280. It has
already taken the stacked-cards route the guidance recommends. The measured cell
widths are recorded in the source: **327px at 375, 223px at 1024's four columns,
158.8px at 1280's seven, 195.4px at 1536** (`WeekGrid.tsx`,
`NARROWEST_DAY_BLOCK_PX`, measured 2026-08-28 — dated, but specific). ADR-0023
already moved seven columns from `lg` to `xl` because "88px of content at 1024
was narrower than the text standing in it".

Two consequences that matter for §D:

1. **The phone problem is not the grid's shape, it is the page's total height.**
   Seven stacked 327px cards is a tall object, so at 375px the ordering of
   everything _above_ the week is what decides whether the week is reachable.
2. **The cells are close to their legibility floor at 1280.** The sparkline is
   dropped by a container query below roughly 134px of cell
   (`MIN_USEFUL_SPARK_WIDTH_PX` + 24px padding; "judged legible at 110px and
   illegible at 88"). Any layout that takes horizontal space away from the grid
   at ≥1280 pushes cells toward that floor — see the warning in Variant 3.

### C.8 Accessibility for a colour-coded risk level

The rule is WCAG **1.4.1 Use of Color (Level A)**: colour must not be "the only
visual means of conveying information". The stated test is the greyscale test —
remove all colour and every state must still be identifiable.

How the relevant authorities do it:

- **NWS** — three levels, and the San Diego office's experimental beach page
  states its map is "color-coded to indicate the forecast rip current risk
  level" **[R]**, so colour is definitely in use. **The specific colour mapping
  is not confirmable from text**: a search summary reported grey / yellow / red
  for low / moderate / high, but fetching both `weather.gov/tae/ripcurrentawareness`
  and `weather.gov/ilm/ripcurrents` found the level _definitions_ stated in text
  and **no colour assignment anywhere in the prose** — the colours live only in
  infographics. Treat grey/yellow/red as **[recall, unverified]** and confirm
  visually before citing it as precedent. Critically, the text product ships the
  **definition of each level in the product itself**, after the `&&` separator,
  so the word never travels without its sentence — and the sentences are
  constructed so "Low" cannot be read as "safe": _"The risk for rip currents is
  low, however, life threatening rip currents often occur in the vicinity of
  groins, jetties, reefs, and piers."_
- **AirNow** — four redundant encodings per level: colour, numeric range, name,
  and a health sentence.
- **BeachSafe** — a 1–10 numeric hazard rating rendered as plain text
  (`General Hazard Rating: 4/10`), with **no colour and no band word on the
  page at all**. Maximally accessible and minimally glanceable (**[R]**).
- **Hawaii Beach Safety** — word plus a full advice sentence, with no colour
  dependence whatsoever in the detail view. **But its list and map views fail**:
  the rating is an icon with a `title` attribute and **no `alt`**
  (`hazard/low_small.png`), so on the island comparison table — the exact screen
  where a parent picks between beaches — the rating is functionally unavailable
  to anyone not seeing colour. Worse, the asset's internal word (`low`) and the
  published legend word (`Caution`) **disagree**, so a user who does get the
  tooltip reads a word that appears nowhere in the legend (**[R]**).
- **Volusia County** — escalates by **count** (double red vs red) as well as
  hue, a channel that survives both greyscale and distance (**[R]**).
- **Safeswim** — names "no data" twice over as a first-class state
  (`Data interruption`, `No water quality data`) rather than rendering an
  absence (**[R]**).
- **This repo, today** — `RipLevel.tsx` renders an uppercase eyebrow
  "Rip current risk" and the level in one weight, with a comment recording the
  rule explicitly: _"the level is emphasised by weight and never by colour, so
  `High` and `Low` are set identically and the difference a reader sees is the
  word"_ (`src/components/conditions/RipLevel.tsx:51-56`, **[R]**).

**The honest assessment of the current approach.** Setting all three levels
identically passes 1.4.1 by construction — but it also passes by giving up the
benefit. 1.4.1 requires that colour is not the _only_ cue; it does not forbid
colour. The strongest available design is the AirNow one: **word + sentence
carries the meaning, and colour is a redundant accelerant on top**, so the page
is legible in greyscale and _faster_ in colour. "High" set identically to "Low"
costs a glance that the audience is, by the site's own framing, relying on.

If colour is added, the constraints are: (a) not red/green as the axis — the NWS
grey/yellow/red ramp is already deuteranopia-tolerant because it varies in
lightness as well as hue; (b) the level word always present at full size, never
a colour swatch alone; (c) the definition sentence attached, since NWS ships it
attached; (d) meet 1.4.11 non-text contrast if the colour is carried by a
border, pill or bar rather than by text.

**The finding that should settle the wording debate, whatever is decided about
colour: no authority in this survey ships a green "fine" state.** Hawaii's floor
band is **`Caution`** — "This is the safest level of nearshore conditions", which
is a comparative, not an absolute. Volusia's green reads "low hazard meaning calm
conditions, **exercise caution**". NWS's Low still says "life threatening rip
currents may still occur". BeachSafe's 1–3 band says "supervision still required,
**in particular for children** and poor swimmers". RNLI's entire risk vocabulary
is one sentence printed twice per page: **`Please remember - No Flags = No
Lifeguards`**. Five independent public-safety bodies have converged on refusing
to say "safe", and for a page aimed at parents that convergence is the
strongest single piece of evidence in this report.

**A caution specific to this site.** ADR-0009 and `CONTEXT.md` are explicit that
the site never makes a safety judgement — the rip level is "quoted verbatim and
attributed", the publisher's product. Making the relayed level _look_ like the
site's own alarm (a red banner) is a different claim from relaying it. A
designed treatment that keeps the NWS attribution adjacent and the sentence
intact stays on the right side of that line; a bare red badge does not.

### C.9 One more axis worth naming: decay rate

NPS orders its conditions pages by **how long a statement stays true** — today's
alerts, then this season's closures, then standing policy. This maps onto the
inventory almost perfectly and is a better ordering principle than data type:

- **true for minutes** — measured band
- **true for today** — rip current level, today's tides and daylight
- **true for the week** — week grid
- **true for a chosen day** — day panel
- **true always** — standing notice, beach list, notes

Ordering by decay rate produces the timeline spine automatically, and it
explains why the notes belong last without needing a separate argument.

---

## D. Recommendation — three archetypes to prototype

### The two facts that should drive the prototype

**Fact one: the audience has two questions, not one.** "Can the kids go in the
water today?" and "which day this week should we go?" They are answered by
different blocks (rip level; week grid) and neither subsumes the other. Any
layout that has one hero slot will serve one question and orphan the other.

**Fact two: the review viewport is wide and short — 1536 × 639 is a 2.4:1
window.** Every vertical stack wastes the axis that is abundant to conserve the
axis that is scarce. The current header row already exploits this with three
columns; the redesign's biggest available win is **extending that principle
below the header row**, which no comparable product in the survey does, because
they are all designed phone-first for tall screens.

Three variants follow. Each is described by what it does with all eight blocks,
what it puts above ~639px, and what it does at 375px.

---

### Variant 1 — **Verdict-first** (archetype B1, with B2 below the fold)

_The page answers "can they go in the water" before it answers anything else._

**Above the fold (target: everything by y≈600)**

1. **Title + area name merged.** One line: `Check conditions first — La Jolla`,
   or the area name set as a second line in the heading block. The heading stops
   being decorative and becomes the scope indicator (§C.6).
2. **Area chooser moves up beside the title**, where it is today, but grouped
   into `<optgroup>`s by coast section (§C.6, Hick's law).
3. **Rip current level becomes the hero — built to Hawaii Beach Safety's card
   shape** (§A.19), which is the best-tested version of this in public safety:
   **a heading, the level word, the sentence, and a line saying who it is for.**
   Full content width, the largest type on the page after the h1, carrying the
   level word, **the NWS sentence for that level verbatim**, the attribution,
   and the period it covers. This is the block that gets the AirNow treatment —
   word, sentence, and (proposed) a redundant colour accent (§C.8).
   **Optional second card, worth prototyping as a sub-variant:** Hawaii's and
   Safeswim's two-axis pattern, here as _in the water_ (the rip level) beside
   _on the sand_ (today's lowest daylight tide — the tidepooling answer). Two
   cards side by side is 2×~480px at the review viewport and costs no extra
   height, and it would answer the tidepooling half of the audience's question
   which no current block answers directly.
4. **Standing notice sits directly under the verdict**, not under the title,
   because it is now qualifying a specific claim rather than the page in general
   — which is a stronger and more honest placement than a page-level disclaimer.
5. **Measured band demoted to one line** under the notice: the "and here is what
   the instruments actually read" evidence line. It keeps its timestamp and
   attribution.

**Below the fold**

6. Beach list — merged into the chooser's row as a wrapped chip row, or dropped
   entirely into the chooser as a second `<select>`. It is navigation (§C.5).
7. Week panel.
8. Day panel.
9. Notes — unchanged. It is already a disclosure labelled **"How to read
   these numbers"**, which satisfies Nielsen's labelling rule (§C.4).

**Blocks that move:** rip level (from the chooser's column to page hero);
standing notice (from under the title to under the verdict); measured band (from
header row to a subordinate evidence line); beach list (down, into the chooser).
**Blocks that merge:** title + area name; beach list + chooser.
**Blocks that drop below the fold:** week, day, notes, beach list.

**The risk this variant must be prototyped to answer, and it is a real one:** the
surf zone forecast reaches **26 of 51 beaches** and two-to-three calendar days
(`CONTEXT.md`, ADR-0043/0044). On the other 25, and on day four of the week, the
hero slot has nothing in it. Today the code degrades to the string
`"See the day below"` — acceptable as a small line in a header column,
**unacceptable as a page hero**. Variant 1 is only viable if there is a good
answer for the empty state, and finding out whether there is one is the point of
building it. Safeswim's answer is the one to copy: **name the empty state, and
distinguish its two causes** — _the NWS does not issue a bulletin for this bay_
is a different sentence from _the bulletin has not been published yet_ (§A.20,
and cross-cutting item 8). A hero that says which is not a hole; a hero that
says `See the day below` is.

**At 375px:** this variant is the best of the three. It is already a single
column ordered by decay rate; nothing needs to reflow. The verdict is the first
thing on the screen, which is what a parent in a car park wants.

**Fold arithmetic:** verdict + sentence ≈ 110px, notice ≈ 40px, band ≈ 44px,
header ≈ 130px, site nav ≈ 90px → ~414px, leaving ~225px in which the week's
first row is visible — enough to avoid a false floor (§C.1).

---

### Variant 2 — **Week-first timeline spine** (archetype B2, hard version)

_The page answers "which day should we go" first; now is a column in the week._

**The move that defines it: the measured band stops being a band and becomes the
"today" column of the week grid.** The week already has four rows (daylight,
tides, cloud thirds, modelled wave height); today's column gains the two measured
figures and the timestamp. This is the Apple/Google mechanic — the same rungs
re-rendered per variable — pushed one step further, and it removes an entire
horizontal band from the page.

**Above the fold**

1. **Title, scope and chooser compressed into one 90–110px header row** — the
   area's name in the heading, chooser at the right, standing notice as one line
   beneath the heading. (Keeps what the current layout already achieves.)
2. **Rip current level as a fifth row of the week grid**, not a separate block.
   It is a per-day product, so it belongs on the day axis; it renders in the
   2–3 columns it covers and says so in the rest. This is structurally more
   truthful than a header-row line, which implies it is about "now".
   **This now has a direct precedent:** Windy.app renders a per-day verdict list
   — one row per day, each a status glyph plus a sentence
   (`✅ Good kite forecast: wind 9.5 m/s…`, `ℹ️ Strong wind – experience
required`) — §A.10. A verdict that varies by day belongs on the day axis, and
   somebody already ships it that way.
3. **The week grid itself, starting by y≈250**, tall enough that all five rows
   and all seven columns are visible in one screen.

**Below the fold**

4. Day panel, opened by the week (which `CONTEXT.md` already names as the
   control that picks the day).
5. Beach list, moved to sit _with_ the day panel, since choosing a beach is a
   refinement of a chosen day rather than a precondition.
6. Notes, disclosed.

**Blocks that move:** rip level (into the grid as a row); beach list (down below
the week).
**Blocks that merge:** measured band → today's column of the week grid; title +
area name.
**Blocks that drop below the fold:** day panel, beach list, notes. _Nothing else._

**What this buys:** the whole of the audience's second question is answered in
one screen, with no scrolling and no interaction — the strongest glanceability
result of the three. It also resolves a real conceptual awkwardness the repo has
named itself: "the week and the day are the same instrument at two zoom levels".
Putting "now" into the week makes three zoom levels into one continuum.

**What it costs, stated plainly:** the measured band loses its identity as "the
whole of what this site actually measures" — a distinction the site cares about
(ADR-0056, and `CONTEXT.md`'s Measured band entry: "Everything else on the page
is a prediction or a model"). Folding a measurement into a grid of forecasts
blurs a boundary the site has spent several ADRs drawing.

**But there is a published answer to exactly this, and it changes the odds on
this variant.** Surfline hit the same problem — a modelled surf height and an
observed one on one page — and in April 2025 shipped "Observation Clarity":
rather than assimilating the observation into the forecast, it **draws the
forecast as bars and the observation as a white-dotted line over them**, and
badges measured values `Observed` (§A.6). Applied here: today's cell draws the
modelled wave height as it does on the other six days, with the buoy's measured
height overlaid and marked, and the air reading carrying its own `Recorded`
stamp (cross-cutting item 7). **Overlay is the alternative to separation, and it
keeps the boundary visible while removing the band.** That is what this variant
should be built to test — not "is the trade acceptable" but "does the overlay
make the trade unnecessary".

**At 375px:** the hardest of the three, but not for the reason it first appears.
The grid already collapses to one column at 375 with 327px cells (§C.7), so the
shape is fine — **the problem is that a one-column week is seven tall cards, so
"the week above the fold" is impossible on a phone by construction.** On a phone
this variant degenerates into Variant 1 with a worse header, and the extra
measured figures folded into today's card make that first card taller still.
The phone question this variant must answer is therefore: _what is the first
card, and does it carry the verdict?_ Prototype it with the rip level inside
today's card on phone and as a grid row on desktop, and see whether the
inconsistency is noticeable or invisible.

---

### Variant 3 — **Answer rail and evidence column** (a two-column split, B1 + B2 side by side)

_The one variant designed for a 2.4:1 window rather than adapted to it._

**Structure at ≥1280px: two columns for the whole page, not just the header.**

- **Left rail, ~360–400px, sticky:** everything that answers "right now" —
  the h1 with the area name, the chooser, the rip current verdict with its NWS
  sentence, the measured band stacked vertically (one figure per line rather
  than one line of figures), and the standing notice at the foot of the rail.
  The rail is the "today" answer and it does not scroll away.
- **Right column, the remaining ~1000px:** the time axis — week grid, then day
  panel, then notes. This column scrolls.

**Above the fold, both questions are answered simultaneously.** That is the thing
no surveyed product does and the thing this viewport makes possible: the verdict
and the week are both visible, because they are side by side rather than stacked.

**Where each block goes**

| Block             | Placement                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Title + notice    | Left rail, top and bottom respectively                                                              |
| Area chooser      | Left rail, under the title — a scope control inside the scoped column                               |
| Rip current level | Left rail, hero of the rail                                                                         |
| Measured band     | Left rail, stacked (vertical suits a 380px column better than a horizontal band suits a 1000px row) |
| Beach list        | Left rail, below the chooser as a wrapped link list — it is scope, and scope lives in the rail      |
| Week panel        | Right column, top — above the fold                                                                  |
| Day panel         | Right column, below the week                                                                        |
| Notes             | Right column, foot, disclosed                                                                       |

**Blocks that move:** measured band (from horizontal to vertical, into the rail);
beach list (into the rail, beside the chooser it belongs with); rip level (into
the rail as its hero).
**Blocks that merge:** none — this variant's thesis is that nothing needs to
merge if the width is used.
**Blocks that drop below the fold:** day panel and notes only.

**What it costs.**

- **The rail steals width from the week grid's cells, and the grid's column
  count will not notice.** Tailwind breakpoints resolve against the _viewport_,
  not the container, so at a 1536px viewport `xl:grid-cols-7` still applies
  inside a ~1050px column: seven cells of roughly 135px instead of the measured
  195.4px they get at full width. That is below the 158.8px the source records
  as "the tightest the grid ever is", and near the ~134px at which the cell's
  container query drops the sparkline altogether. **Three ways out, and the
  prototype should pick one deliberately:** cap the rail at ~300px; switch the
  grid to container queries so it drops to four columns inside a narrow parent;
  or accept a sparkline-free week at this width. Silently losing the spark is
  the outcome to avoid, because it would look like a bug rather than a trade.
- A sticky rail is a real accessibility and zoom hazard: at 200% zoom or on a
  short window the rail can exceed the viewport and trap content. It must be
  sticky-with-scroll, never `position: fixed` with hidden overflow.
- It is a desktop-only structure. Below ~1024px it must collapse — and the
  honest collapse is **into Variant 1** (rail contents first, in rail order, then
  the time column). That is a feature for prototyping, not a defect: it means
  Variants 1 and 3 share their phone layout, and the owner is really choosing
  between "one column everywhere" and "two columns on the review machine".
- It is the most work of the three, because it is the only one that needs two
  genuinely different layouts.

**At 375px:** identical to Variant 1.

**Fold arithmetic at 1536×639:** left rail content ≈ h1 60 + chooser 80 + verdict
110 + band 120 + beach list 50 + notice 40 ≈ 460px — comfortably inside the fold.
Right column: the week grid measured at "225px to 333px" for all seven cells
(ADR-0017, in-repo and dated) starts at roughly y≈220 and ends by y≈550. Both
answers land above 639px with room.

---

### Which three, and why not the others

| Prototype               | Archetype | Thesis it tests                                                                                                                                                            |
| ----------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **V1 Verdict-first**    | B1        | Does promoting one relayed judgement to hero make the page better — and is the 25-beach/day-four empty state survivable?                                                   |
| **V2 Week-first spine** | B2        | Is "which day" the real question — and does Surfline's observed-over-forecast overlay let "now" fold into the week grid _without_ blurring the measured/modelled boundary? |
| **V3 Answer rail**      | B1 + B2   | Can a 2.4:1 viewport answer both questions at once, and is a two-layout page worth the cost?                                                                               |

**Not prototyped: B3 dashboard grid.** Eight blocks do not fit 639px at a
readable density; making them fit means shrinking type, and this repo has
already measured where that ends (ADR-0015, 10px glyphs). It would be built only
to be rejected.

**Not prototyped: B4 map-anchored.** The map is the right control for "which
beach" and the audience's live question is "which day". The repo's own
measurements show the map wants 472px of column at the review viewport and drops
to 342px on a phone — it cannot be the hero _and_ leave room for a reading.
Worth revisiting if area-level maps ever become the navigation.

**Not prototyped: B6 table of record.** It survives the fold and fails the
audience. It is the archetype the page should be careful not to drift into as
rows accumulate in the week grid.

**Not prototyped as a variant, but adopt from B5 regardless:** Surfline's
**per-region collapse control** — every graph in its stack has its own `^`, on
the rationale "if the data isn't of interest, just hide it" (§A.6). The notes
block already works this way and is already labelled correctly; the day panel
and the week's lower rows are the candidates for extending it.

### Cross-cutting changes to make in all three variants

These are not variant-specific and should be constant across the prototype so
the owner is comparing structure rather than noise:

1. **The area's name appears in the heading**, not only inside the `<select>`.
   Scope must be readable when the control is scrolled away (§C.6).
2. **`<optgroup>` the 18 areas** by coast section — native, no JS, mitigates
   Hick's law without spending fold (§C.6).
3. **Region headings name questions, not data types** — "This week", "Thursday
   in detail", "How to read these numbers" (already the label in use) — to convert spotted scanning
   into layer-cake (§C.3).
4. **The rip level always ships with the NWS sentence for that level**, never the
   bare word, because that is how the publisher ships it and because the
   sentences are written specifically to stop "Low" reading as "safe" (§A.1,
   §C.8).
5. **Resolve the colour question deliberately**, not by default. Current practice
   (all levels set identically) is safe and costs a glance; the AirNow pattern
   (word + sentence carries meaning, colour is redundant on top) is both
   compliant and faster. Prototype at least one variant with each treatment.
6. **Budget the phone page by height, not by shape.** The week grid already
   stacks correctly at 375px into seven 327px cards (§C.7); what decides whether
   a parent ever reaches it is the cumulative height of everything above it.
   Measure each variant at 375px and state where the week's first card starts.
   **Never hide a numeric block on mobile** — BeachSafe hides its entire
   seven-number "now" strip below `sm`, which is the failure this audience would
   hit hardest, since a parent in a car park is the phone case.
7. **Give each value its own freshness word, and vary the word by kind.** Hawaii
   Beach Safety writes `updated` for a rating, `Recorded` for an instrument
   reading and `Forecast` for a model (§A.19). That separates now from forecast
   _per value_ rather than per section — which is exactly what this page needs,
   because its three layers already interleave and because the measured band's
   whole identity is "this one was actually measured". It is also cheaper than
   any layout change, and it makes the measured/modelled boundary survive any
   rearrangement the prototype settles on.
8. **Make "no reading here" a named state, not an absence.** Safeswim names it
   twice (`Data interruption` vs `No water quality data`, §A.20). This page has
   the same problem at scale — the rip level reaches 26 of 51 beaches, a buoy
   reaches 15, and 15 of 18 areas show air only — and the distinction between
   _this beach has no buoy_ and _the buoy went quiet_ is exactly the one
   Safeswim bothers to draw. Worth checking which of the two the current copy
   says in each case.
9. **If a risk level ever appears in a list or map view, it carries its word.**
   The one measured accessibility failure in this survey is Hawaii's list view,
   where the rating is an icon with `title` and no `alt` — and it fails on the
   comparison screen, which is the screen that matters most (§C.8).
10. **Print `Next update:` as well as the reading's own time.** Windfinder does
    (§A.9), and on a page whose regions go quiet independently behind five
    separate Suspense boundaries it converts "this looks stale" into "this is
    when it changes". Nearly free, since the revalidation interval is already a
    committed constant.

### One idea held back deliberately

**Windy.app makes the audience a control** — an activity picker
(`Kitesurfing / Hiking / SUP / Fishing / …`) that re-weights the whole forecast
(§A.10). It is tempting here, because this audience genuinely splits three ways
— tidepooling, hiking, a co-op meetup — and those three want different figures:
tidepooling wants the lowest daylight tide, hiking wants cloud and heat, a
meetup wants wind and the rip level.

**It is not in any of the three variants, and that is on purpose.** It is a
content-model change, not a layout change: it would have to decide what each
activity emphasises, and that decision is a judgement about suitability, which
ADR-0009 and `CONTEXT.md` forbid this site from making. Prototyping it alongside
three layouts would also confound the comparison — the owner would be judging
two different things at once. **Worth a separate conversation after a layout is
chosen; worth not smuggling into this one.**

---

## E. Gaps — what I could not establish

Listed so they are not mistaken for findings.

Two gaps I listed in an earlier draft are now **closed** and the sections have
been rewritten: Surfline's current page structure (live HTML plus eight current
support articles read through the help centre's JSON API, including the full
table column list), and whether Magicseaweed had a "now" block (**it did**, above
the table — see §A.7).

- **Windy.com's right-hand pane contents.** The pane's existence, edge, ~320px
  width and mutual exclusivity with the bottom detail pane are verified from the
  shipped DOM and the plugin API. **The section order inside it is not**, and is
  not guessed at. Windy server-renders nothing and its own announcement article
  is client-rendered too.
- **Windy.app's native spot screen.** Two of Windy.app's own guides disagree
  about its composition and were not reconciled; whether it has a "now" block
  distinct from the first table column is unknown. The _web_ page and the table's
  row order are source-verified.
- **Google's weather card location control** — the documenting article does not
  say where it sits.
- **Apple Weather's city switcher placement** — recall only, unverified.
- **NOAA Tides & Currents station home page** — the fetched HTML was a portal
  shell without the station identity, so the station page's own reading order is
  not established (the _predictions_ page is).
- **NWS rip-current colour assignments — checked and NOT confirmed.** Three NWS
  pages fetched (`weather.gov/safety/ripcurrent-forecasts`,
  `weather.gov/tae/ripcurrentawareness`, `weather.gov/ilm/ripcurrents`) all state
  the three level definitions in text and **none states a colour**. The San Diego
  beach page confirms a map is "color-coded" but not with what. The
  grey/yellow/red mapping originated in a search-engine summary and survived no
  primary check — do not cite it without looking at an NWS graphic directly.
- **BeachSafe's _current_ reading order.** Everything in §A.16 is the
  October 2024 / January 2025 server-rendered build read from the Wayback
  Machine. The live site has since been rewritten as a client-only SPA (a
  `v3.` subdomain appears in its TLS certificate), and whether the rewrite kept
  the order is unknown.
- **A BeachSafe JSON API.** `api.beachsafe.org.au` exists but its TLS
  certificate does not cover the `api.` subdomain, so it could not be read. No
  public API was established.
- **Hawaii's successor site (`safebeachday.com`)** rendered no live readings in
  the fetched HTML. It may render them client-side; "removed" and "not in the
  HTML" could not be distinguished.
- **Hawaii's official beach-flag wording** (`oceansafety.hawaii.gov`) — 403.
  The green/yellow/red/double-red flag wording that surfaced in search snippets
  is **unverified** and is not used in this report; the Volusia County wording
  in §A.21 _was_ retrieved and is used instead.
- **UK "Beach Wizard"** — no current product by that name was found. No claims
  are made about it. Dutch and other European equivalents were not investigated.
- **RNLI's water-quality and hazards sections.** RNLI's marketing copy describes
  them as part of the beach finder; the rendered Perranporth beach page in the
  2025 capture does not carry them. Either the copy is aspirational or they live
  somewhere not found. Unresolved.
