# Atmospheric sensor spatial representativeness

> **How this file got here.** Supplied as context on 2026-08-19 and committed so
> that `docs/plans/inventory-bounded-by-stations.md` and ADR 0011 cite something
> that exists. It is a **compiled reference, not a primary source**: nobody in
> this repo has checked its citations against WMO-No. 8, ISO 19289,
> EPA-454/R-99-005 or the CFR. Its own §14 lists what to verify before relying
> on it. Statements are tagged `[STANDARD]` where the compiler traced them to a
> cited document and `[DOMAIN]` where they reflect general practice; treat
> `[DOMAIN]` as a default to be checked.
>
> **What this repo uses it for.** One decision: that no citable radius exists, so
> the 10 km bound in ADR 0011 is ours to state and defend rather than to
> attribute. Also §5.5 (validity is per variable) and §7 (aerodrome observations
> do not transfer off-field), both of which are load-bearing there.

---

## 1. The core rule

**There is no standard "valid reporting radius" for an atmospheric sensor.** No
WMO, ISO, EPA, ICAO, or CFR provision assigns a coverage radius to a station. Any
answer of the form "sensor data are valid within X km" is unsupported unless X
was derived for a specific variable, a specific site pair, and a specific
application tolerance.

`[STANDARD]` WMO-No. 8 §1.1.2 defines representativeness as the degree to which
an observation describes the value of the variable _needed for a specific
purpose_. It is explicitly **not a fixed property of the observation**; it
emerges from a joint appraisal of instrumentation, measurement interval, and
exposure against the requirements of a given application.

**Consequence for agents:** a representativeness question is malformed until four
inputs are supplied — (1) the variable, (2) the terrain and land-use relationship
between the two points, (3) the presence of intervening boundaries, (4) the error
tolerance of the downstream use. Do not emit a distance threshold without them.
Ask.

---

## 2. Authoritative sources

| ID                                  | Document                                                                                    | What it governs                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `WMO-8`                             | WMO-No. 8, _Guide to Instruments and Methods of Observation_ (CIMO Guide)                   | Root definition of representativeness (§1.1.2); horizontal scale classification; siting and exposure rules |
| `WMO-8-Annex-1B` / `ISO 19289:2015` | _Air quality — Meteorology — Siting classifications for surface observing stations on land_ | Site Classes 1–5 and the added uncertainty each implies                                                    |
| `WMO-488`                           | _Guide to the Global Observing System_                                                      | Network design, station spacing, observing-system requirements                                             |
| `WMO-306`                           | _Manual on Codes_                                                                           | Report encoding — BUFR, and legacy SYNOP / BUOY / METAR                                                    |
| `WMO-1192`                          | WIGOS Metadata Standard                                                                     | Station metadata, including siting class and exposure, that carries representativeness info                |
| `EPA-454/R-99-005`                  | _Meteorological Monitoring Guidance for Regulatory Modeling Applications_ (Feb 2000)        | §3.1 is the most directly applicable treatment of representativeness in regulatory practice                |
| `40 CFR 51 App. W`                  | _Guideline on Air Quality Models_                                                           | Regulatory modeling requirements; incorporates the above by reference                                      |
| `40 CFR 58 App. D`                  | _Network Design Criteria for Ambient Air Quality Monitoring_                                | Defines spatial scales with explicit dimensions                                                            |
| `40 CFR 58 App. E`                  | _Probe and Monitoring Path Siting Criteria_                                                 | Probe placement; reclassification rules when siting criteria are unmet                                     |
| `ICAO Annex 3`                      | _Meteorological Service for International Air Navigation_                                   | Aerodrome observation reference points                                                                     |
| `EPA-454/B-08-002`                  | _QA Handbook Vol. IV: Meteorological Measurements_                                          | QA/QC, measurement quality objectives                                                                      |

---

## 3. WMO horizontal scale classification

`[STANDARD]` `WMO-8` §1.1, stated with an explicit **factor-of-two uncertainty**:

| Scale             | Horizontal extent | Example phenomena                       |
| ----------------- | ----------------- | --------------------------------------- |
| Microscale        | < 100 m           | Evaporation, agricultural meteorology   |
| Toposcale / local | 100 m – 3 km      | Air pollution, tornadoes                |
| Mesoscale         | 3 – 100 km        | Thunderstorms, sea and mountain breezes |
| Large scale       | 100 – 3,000 km    | Fronts, cyclones, cloud clusters        |
| Planetary         | > 3,000 km        | Long upper-tropospheric waves           |

`[STANDARD]` `WMO-8` §1.1.2 benchmark: synoptic observations should typically be
representative of an area up to **100 km** around the station; small-scale or
local applications may concern areas of **10 km or less**.

**Interpretation.** A 5 km separation falls at the toposcale/mesoscale boundary.
At that distance, sea breezes, thunderstorms, and slope flows are _resolvable
distinct features_, not sub-grid noise. This is the single most important framing
for the common "is 5 km OK?" question.

---

## 4. Site siting classification

`[STANDARD]` `ISO 19289:2015` / `WMO-8` Annex 1.B exist because real sites
frequently fail the recommended exposure rules. The classification determines a
site's representativeness at small scale, given its surroundings.

- **Class 1** — reference-quality site.
- **Classes 2–4** — intermediate; each carries a stated _additional uncertainty_
  for the affected variable.
- **Class 5** — nearby obstacles make the environment inappropriate for a
  measurement intended to represent a wide area.

Lower class number → higher representativeness over a wide area. Classes are
assigned **per variable** (a site may be Class 2 for temperature and Class 4 for
wind).

**Agent use:** the class-specific added uncertainty is the correct lever when a
numeric error budget is required. Prefer it over inventing a distance-based
degradation factor.

---

## 5. EPA regulatory position (`EPA-454/R-99-005` §3.1)

The most quotable authority for "there is no number." Key positions, paraphrased:

1. Representativeness is an **exact condition** — data either are or are not
   representative under whatever criteria are prescribed.
2. Consequently **no quantitative method exists** to determine representativeness
   absolutely, and there are **no generally accepted analytical or statistical
   techniques** for determining it for meteorological data or sites.
3. Representativeness **depends on proximity** to the area of interest, and is
   **degraded by increasing distance** / increasing size of the area of interest.
4. But it is **"not simply a function of distance."** Data collected _at_ a
   source may still be non-representative — e.g. a coastal source whose
   dispersion is driven by offshore air/sea boundary conditions.
5. **Exclusion of one variable does not exclude all.** Wind speed and direction
   may be unrepresentative while temperature, dew point, and cloud cover remain
   usable from the same station.
6. Representativeness **increases with measurement height**; upper-air
   measurements represent much larger domains than surface measurements.
7. Judgements are **case-by-case and subjective**; the guidance directs that
   qualified meteorologists be involved and that the reviewing authority approve.

Related: under the RMP program (40 CFR Part 68 Subpart B), EPA states it has
**not set specific distance limits** for using a weather station's data at a
stationary source, leaving it to the operator's best judgment.

---

## 6. Numeric thresholds that _do_ exist

Use these; do not extrapolate beyond their stated purpose.

| Value                                                                                  | Source                             | Applies to                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2 km** max horizontal tower separation                                               | `EPA-454/R-99-005` §3.3.3          | Deep-layer absolute temperature method as a surrogate for a vertical temperature profile. Also requires ≥200 m layer depth, ≥60 m measurement height on each tower, **no internal boundary layers** (i.e. not near shorelines), and verification against balloon soundings. |
| **100 m – 0.5 km** (middle scale)                                                      | `40 CFR 58 App. D`                 | Ambient air monitor spatial scale                                                                                                                                                                                                                                           |
| **0.5 – 4.0 km** (neighborhood scale)                                                  | `40 CFR 58 App. D`                 | Ambient air monitor spatial scale, relatively uniform land use                                                                                                                                                                                                              |
| **4 – 50 km** (urban scale)                                                            | `40 CFR 58 App. D`                 | Citywide pollutant conditions                                                                                                                                                                                                                                               |
| **100 km**                                                                             | `WMO-8` §1.1.2                     | Nominal synoptic representativeness                                                                                                                                                                                                                                         |
| **10 km or less**                                                                      | `WMO-8` §1.1.2                     | Nominal small-scale / local application                                                                                                                                                                                                                                     |
| **10 m** standard anemometer height; obstruction distance **≥ 10×** obstruction height | `WMO-8`, `EPA-454/R-99-005` §3.2.1 | Surface wind siting                                                                                                                                                                                                                                                         |
| **2 m** standard temperature/humidity height                                           | `WMO-8`, `EPA-454/R-99-005` §3.2.2 | Surface temperature siting                                                                                                                                                                                                                                                  |
| **~2.5×** building height                                                              | `EPA-454/R-99-005` §3.2.1.2        | Rule-of-thumb total depth of a building wake                                                                                                                                                                                                                                |
| **90%** data completeness, per quarter                                                 | `EPA-454/R-99-005` §5.3.2          | Acceptability of a regulatory met data record                                                                                                                                                                                                                               |

Note that **5 km exceeds neighborhood scale** under `40 CFR 58 App. D` and
exceeds the 2 km cap EPA places on the two-tower temperature method.

---

## 7. Per-variable assessment at ~5 km

`[DOMAIN]` unless marked. Verdicts assume no intervening boundary; a coastline,
ridgeline, urban edge, or large water body between the points invalidates the
"usually OK" cases.

| Variable                        | 5 km verdict            | Dominant failure mode                                                                                                                                    |
| ------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Station pressure / MSLP         | **Usually valid**       | Only elevation reduction error; largest decorrelation length of surface variables                                                                        |
| Air temperature                 | **Conditionally valid** | Fails across elevation change (~100 m+), land-use change, coastline; nocturnal cold-air pooling can give 5–10 °C differences over 5 km in valley terrain |
| Dew point / humidity            | **Conditionally valid** | As temperature; plus irrigation, water bodies, TIBL                                                                                                      |
| Wind speed                      | **Weak**                | Surface roughness change, sheltering, streamline compression over terrain                                                                                |
| Wind direction                  | **Weakest**             | Channeling, slope flows, sea-breeze front position. `[STANDARD]` EPA singles out wind direction bias as the hardest complex-terrain siting judgement     |
| Precipitation (convective)      | **Not valid**           | Decorrelation length frequently shorter than the separation itself                                                                                       |
| Precipitation (stratiform)      | **Conditionally valid** | Orographic enhancement gradients                                                                                                                         |
| Ceiling / cloud base            | **Not transferable**    | Point measurement by instrument design                                                                                                                   |
| Visibility / present weather    | **Not transferable**    | Point measurement; fog and convection are highly localized                                                                                               |
| Solar radiation                 | **Conditionally valid** | Cloud field variability; shading                                                                                                                         |
| Stability class / mixing height | **Weak**                | Derived quantity; inherits errors of all inputs                                                                                                          |

`[STANDARD]` `WMO-8` §1.3.3.1: an aviation meteorological observing station must
describe conditions specific to the **aerodrome site**, and `ICAO Annex 3` ties
observations to specific runway/touchdown reference points. Aerodrome
observations should never be transferred off-field.

Network-design corroboration: the UK synoptic network averages ~40 km station
spacing, adequate for frontal and low-pressure systems, but the Met Office states
that smaller-scale features such as thunderstorms may **evade the surface network
altogether** — hence radar and satellite.

---

## 8. Marine stations and buoys

There is **no published representativeness radius for NDBC or any moored-buoy
network.** Distance is usually not the binding constraint; these are:

1. **Anemometer height.** `[STANDARD-adjacent]` Buoy anemometers typically sit at
   ~3–5 m, not the 10 m land standard. Wind speed **must be height-adjusted**
   before comparison with land stations, model output, or other buoys. Failing to
   do this is the most common error.
2. **Wave sheltering.** NDBC has investigated whether moored-buoy winds read low
   in high seas — i.e. a negative bias precisely in the high-wind conditions of
   greatest interest. Do not treat buoy winds as ground truth for extremes
   without checking this.
3. **Homogeneity works in your favor offshore.** Over open ocean with uniform
   fetch and no bathymetric influence, surface variables decorrelate far more
   slowly than over land; 5 km offshore is a much easier case than 5 km inland.
4. **But gradients are sharp where they exist.** 5 km _across_ a coastline, a
   frontal boundary, a bathymetric front, or an SST front (e.g. Gulf Stream) is
   not valid.
5. **Sea surface temperature is not air temperature** and the two decorrelate
   differently.

---

## 9. How the observation pipeline actually assigns spatial validity

Important architectural point — the radius is not attached to the observation:

1. **Observations are reported for the point.** Encoded per `WMO-306` (BUFR;
   legacy SYNOP for land, BUOY for moored/drifting buoys, METAR/SPECI for
   aerodromes). The report makes **no areal claim**.
2. **Metadata carries the representativeness information.** `WMO-1192` (WIGOS)
   records station siting class, exposure, instrument heights, and surroundings.
   This is where an agent should look to justify or challenge a transfer.
3. **Spatial extension happens downstream**, in objective analysis and data
   assimilation, where _representativeness error_ is a formally budgeted term
   added to instrument error in the observation error covariance matrix. This is
   where a defensible, quantified 5 km answer is actually produced.
4. **Areal validity attaches to forecasts and analyses**, not observations —
   marine forecast zones, coastal waters zones, land forecast zones, gridded
   analyses.

---

## 10. Decision procedure

```
1. Identify the VARIABLE. Resolve per-variable; never in aggregate.       [§7]
2. Identify the APPLICATION and its error tolerance.
3. Compare SURFACE CHARACTERISTICS at both points:
     - surface roughness (z0), albedo/Bowen ratio, land use
     - elevation difference
     - vegetation / canopy height
4. Check for INTERVENING BOUNDARIES:
     - coastline / large water body  -> likely FAIL (TIBL, sea breeze)
     - ridgeline or valley wall      -> likely FAIL for wind, temperature
     - urban/rural edge              -> likely FAIL for temperature, wind
     - none, uniform terrain         -> proceed
5. Check MEASUREMENT HEIGHT. Higher = more representative.               [§5.6]
6. Check SITE CLASS at the source station, per variable.                 [§4]
7. If the answer must be defensible (regulatory / litigation / safety):
     -> require a SITE-SPECIFIC COMPARISON STUDY (§11).
     -> do NOT cite a published radius; none exists.
```

---

## 11. The defensible method when a number is required

Run a **paired-site comparison study**, not an appeal to authority:

- Co-located or paired observations over a period covering the relevant regimes
  (minimum one year for regulatory dispersion work per `EPA-454/R-99-005` §5.3.1;
  five years of NWS data or one year of site-specific data per
  `40 CFR 51 App. W`).
- Report **per variable**: bias, RMSE, correlation, and conditional performance
  stratified by stability class, wind sector, season, and time of day. Aggregate
  statistics hide exactly the regimes that matter.
- Stratify by regime. A station that correlates at r = 0.95 annually may be
  useless during nocturnal drainage flow or sea-breeze hours.
- State the tolerance the application requires and compare against it explicitly.

---

## 12. Anti-patterns

Flag or refuse these:

- Citing a "standard radius" of 5 km / 10 km / 25 km. **No such standard
  exists.**
- Treating distance as the sole criterion. EPA: representativeness is _not simply
  a function of distance_.
- Validating a station wholesale. Validity is **per variable**.
- Transferring aerodrome (METAR) ceiling/visibility off-field.
- Comparing buoy winds to land or model winds without 10 m height adjustment.
- Transferring anything across a coastline, ridgeline, or urban boundary without
  justification, at any distance.
- Using annual-mean agreement to justify use during a specific event.
- Assuming a site meets exposure rules without checking its siting class or
  metadata.
- Inferring convective precipitation at a point from a gauge kilometres away.

---

## 13. Glossary

- **Representativeness** — degree to which an observation describes the variable
  value needed for a specific purpose (`WMO-8` §1.1.2). Purpose-relative, not
  intrinsic.
- **Representativeness error** — the component of observation error arising from
  a point measurement standing in for an area/volume; budgeted explicitly in data
  assimilation.
- **Decorrelation length** — separation at which the correlation of a field falls
  to a specified threshold. Variable-, season-, and regime-dependent.
- **z0 (surface roughness length)** — governs the wind profile; a primary
  determinant of whether wind data transfer between sites.
- **TIBL (Thermal Internal Boundary Layer)** — forms when stable marine air
  advects over heated land; a hard barrier to coastal representativeness.
- **Siting class** — 1–5 rating per `ISO 19289` / `WMO-8` Annex 1.B, with stated
  added uncertainty per class.
- **Simple / intermediate / complex terrain** — in EPA usage, defined by
  comparing terrain height to stack-top and plume height, not by absolute relief.

---

## 14. Open items / verify before relying

- Exact per-class added-uncertainty values in `ISO 19289` were not retrieved
  here; consult the standard directly if a numeric error budget is needed.
- `WMO-8` is revised periodically (2008, 2014, 2018, 2021+ editions). Section
  numbering shifts between editions — verify §1.1.2 / Annex 1.B numbering against
  the edition in use.
- Jurisdiction matters. EU (Air Quality Directive), UK (Met Office observing
  standards), and national met services impose their own siting and
  representativeness criteria that may be stricter than the above.
- Decorrelation-length figures in §7 are `[DOMAIN]` defaults and should be
  replaced with region-specific empirical values where available.
