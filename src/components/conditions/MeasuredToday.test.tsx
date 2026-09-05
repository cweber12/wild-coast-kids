import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MeasuredToday, type MeasuredReadings } from "./MeasuredToday";
import { SelectedDayProvider, useSelectedDay } from "./selectedDay";
import { DISCLOSURE_TARGET } from "./disclosure";

const NEAR_BUOY = { name: "Scripps Nearshore", distanceM: 1400 };
const FAR_BUOY = { name: "Point Loma South", distanceM: 34_159 };
/** Scripps Pier: the one station the air card names, and the only one it reads. */
const PIER = { name: "Scripps Pier", distanceM: 1_381 };

/** 2026-08-17, 11:13 AM Pacific: a time, not a round hour, so a formatter that dropped the minutes would show. */
const WAVE_TAKEN_AT_MS = Date.UTC(2026, 7, 17, 18, 13);

const WAVE_READING = {
  kind: "reading",
  heightFt: 2.62,
  periodS: 5,
  directionDegT: 278,
  waterTempF: 69.98,
  observedAtMs: WAVE_TAKEN_AT_MS,
} as const;

const AIR_READING = {
  kind: "reading",
  airTempF: 71.42,
  windMph: 8.05,
  gustMph: null,
  windDirDegT: 320,
} as const;

/**
 * The pair, as `MeasuredPanel` hands it over. Overrides go one level down so a
 * test can move a single field without restating both view models -- most of
 * these are about one card while the other stands, which is the property the
 * block is arranged to have.
 */
function readings(
  overrides: {
    waves?: Partial<MeasuredReadings["waves"]>;
    air?: Partial<MeasuredReadings["air"]>;
  } = {},
): MeasuredReadings {
  return {
    waves: {
      beachName: "La Jolla Shores Beach",
      buoy: NEAR_BUOY,
      state: WAVE_READING,
      ...overrides.waves,
    },
    air: {
      beachName: "La Jolla Shores Beach",
      airStation: PIER,
      air: AIR_READING,
      ...overrides.air,
    },
  } as MeasuredReadings;
}

/* =========================================================================
 * The block, and the day it belongs to
 * ========================================================================= */

test("today carries both instruments, and only today", () => {
  render(<MeasuredToday readings={readings()} />);

  expect(screen.getByText("2.6 ft")).toBeDefined();
  expect(screen.getByText("71°F")).toBeDefined();
  expect(screen.queryByText(/Nothing has been measured/)).toBeNull();
});

/**
 * ADR-0010 permits two provenances behind one panel and refuses them behind one
 * sentence. Two cards is how that is kept once each source has its own
 * plain-words line: merging them would produce "about waist high, and warm with
 * a gentle breeze", which is the forbidden shape exactly.
 */
test("the two instruments are two cards, each with its own attribution", () => {
  const { container } = render(<MeasuredToday readings={readings()} />);

  const cards = container.querySelectorAll("section");
  expect(cards).toHaveLength(2);

  const sea = screen.getByText(/NDBC/).textContent ?? "";
  expect(sea).toContain("Scripps Nearshore");
  const air = screen.getByText(/Scripps Pier/).textContent ?? "";
  expect(air).toContain("Temperature and wind");
});

test("one stat group never spans the two sources", () => {
  const { container } = render(<MeasuredToday readings={readings()} />);

  const groups = [...container.querySelectorAll("dl")];
  expect(groups).toHaveLength(2);
  expect(
    [...groups[0].querySelectorAll("dt")].map((n) => n.textContent),
  ).toEqual(["Period", "Water"]);
  expect(
    [...groups[1].querySelectorAll("dt")].map((n) => n.textContent),
  ).toEqual(["Wind"]);
});

/**
 * The block is what the page measures and nothing else. The tide's lowest
 * daylight low is a NOAA prediction and prints in the week grid's today column;
 * CDIP's peak is a model and is drawn hour by hour on the chart's own tab.
 * Either one here would put a computed figure inside a block whose entire claim
 * is that these numbers came off an instrument.
 */
test("nothing predicted or modelled is in the block", () => {
  render(<MeasuredToday readings={readings()} />);

  expect(screen.queryByText(/Lowest daylight tide/)).toBeNull();
  expect(screen.queryByText(/Lowest all day/)).toBeNull();
  expect(screen.queryByText(/Forecast today/)).toBeNull();
  expect(screen.queryByText(/Biggest at/)).toBeNull();
  expect(screen.queryByText(/MOP line/)).toBeNull();
});

/* =========================================================================
 * The sea
 * ========================================================================= */

test("a wave reading leads with the height and puts it in plain words", () => {
  render(<MeasuredToday readings={readings()} />);

  expect(screen.getByText("2.6 ft")).toBeDefined();
  // A height alone tells a surfer what they need and a parent very little, so
  // the plain-language companion survives the move into the day.
  expect(screen.getByText(/about waist high/)).toBeDefined();
  expect(screen.getByText("5 s")).toBeDefined();
});

test("water temperature comes from the same reading, rounded", () => {
  render(<MeasuredToday readings={readings()} />);

  // The buoy publishes 69.98 and nobody swims to two decimal places.
  expect(screen.getByText("70°F")).toBeDefined();
});

test("a buoy reporting no water temperature says so rather than omitting it", () => {
  render(
    <MeasuredToday
      readings={readings({
        waves: {
          state: { ...WAVE_READING, periodS: null, waterTempF: null },
        },
      })}
    />,
  );

  // A buoy that publishes waves and no water temperature is a measured fact
  // about that buoy, not a hypothetical. Both figures state their absence
  // rather than vanishing, because a missing row reads as an oversight and a
  // blank one reads as a calm sea.
  expect(screen.getAllByText("Not reported").length).toBe(2);
  expect(screen.getByText("Water")).toBeDefined();
});

/**
 * The height bands, pinned the way the temperature and wind bands beside them
 * already were. They are this site's own wording for a published measurement
 * rather than a standard, so nothing upstream asserts them and this is the only
 * place they can be.
 *
 * Two of the five were unasserted while this lived on the wave card, and the
 * two were the ends -- flat water and a large sea, which are the readings a
 * parent is most likely to be checking for. Added here rather than left as they
 * were found.
 */
test("every wave height band has its own words", () => {
  const bands: [number, string][] = [
    [0.4, "close to flat"],
    [1.5, "about knee to thigh high"],
    [2.62, "about waist high"],
    [3.8, "overhead for a child"],
    [6.2, "large"],
  ];

  for (const [heightFt, words] of bands) {
    const { unmount } = render(
      <MeasuredToday
        readings={readings({ waves: { state: { ...WAVE_READING, heightFt } } })}
      />,
    );

    expect(screen.getByText(`${words}.`)).toBeDefined();
    unmount();
  }
});

test("the buoy's line states when it read, and no longer claims it was now", () => {
  render(<MeasuredToday readings={readings()} />);

  const line = screen.getByText(/NDBC/).textContent ?? "";
  // Pacific, because the reading is: the buoy is off San Diego and the row is
  // 18:13 UTC. A line printing 6:13 PM would be the test runner's clock.
  expect(line).toContain("11:13 AM");
  // ADR-0054. MAX_WAVE_AGE_MINUTES is 180, so this label stood over readings
  // up to three hours old and asserted the one thing it could not know.
  expect(line).toContain("Measured");
  expect(line).not.toContain("Measured now");
});

test("a quiet buoy is still credited, with no time to state", () => {
  render(
    <MeasuredToday
      readings={readings({
        waves: {
          state: {
            kind: "unavailable",
            detail: "NDBC timed out.",
            drift: false,
          },
        },
      })}
    />,
  );

  // By the buoy's name rather than by /NDBC/: the disclosure this state opens
  // quotes the feed's own message, which names NDBC too.
  const line = screen.getByText(new RegExp(NEAR_BUOY.name)).textContent ?? "";
  // Which buoy was asked is a fact about the beach and survives the outage.
  // The time is not: there is no row, so the line must not invent one.
  expect(line).toContain(NEAR_BUOY.name);
  expect(line).not.toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
});

test("a nearby buoy is credited without a distance", () => {
  render(<MeasuredToday readings={readings()} />);

  const line = screen.getByText(/NDBC/).textContent ?? "";
  expect(line).toContain(NEAR_BUOY.name);
  expect(line).not.toContain("km from this beach");
});

test("a distant buoy discloses how far away it is", () => {
  render(
    <MeasuredToday
      readings={readings({
        waves: { beachName: "Tijana River", buoy: FAR_BUOY },
      })}
    />,
  );

  // 34 km up the coast, because the only buoy south of Point Loma is dead.
  expect(screen.getByText(/about 34 km from this beach/)).toBeDefined();
});

test("a bay beach is told this is expected, not a fault", () => {
  render(
    <MeasuredToday
      readings={readings({
        waves: {
          beachName: "Agua Hedionda Lagoon",
          buoy: null,
          state: {
            kind: "no-buoy",
            reason:
              "every wave buoy sits on the open coast, and ocean swell does not reach into a bay or lagoon, so no buoy describes the water here",
            modelAnswersInstead: false,
          },
        },
      })}
    />,
  );

  expect(
    screen.getByText(/that is what we expect rather than a fault/),
  ).toBeDefined();
  // Not an outage: nothing invites the reader to try again.
  expect(screen.queryByText(/Try again shortly/)).toBeNull();
  expect(screen.getByText(/does not reach into a bay or lagoon/)).toBeDefined();
});

/**
 * The disclosure ADR-0019 was accepted on, which that decision says goes with
 * it if it is "ever removed or weakened". Ten beaches now carry a wave figure
 * that was never measured anywhere, and this is the only place a reader meets
 * that fact before the number.
 *
 * It got stronger in the move rather than weaker. On the card the sentence
 * pointed at a forecast block eighty pixels below it and had a second form for
 * when CDIP had not answered; there is no block below it now, so it names the
 * chart and the week where those modelled heights actually are, and it says so
 * whatever CDIP is doing.
 */
const NO_BUOY_MODELLED = {
  kind: "no-buoy",
  reason:
    "the nearest delivering buoy 46232 is 28.2 km away, further than this site publishes a reading from, so it is not read here; MOP line D0001 answers for the waves at 0.5 km, and it is a model rather than a measurement",
  modelAnswersInstead: true,
} as const;

const MODELLED_BEACH = {
  beachName: "Border Field State Park",
  buoy: null,
  state: NO_BUOY_MODELLED,
};

test("a beach no buoy reaches is told its wave heights are modelled", () => {
  render(<MeasuredToday readings={readings({ waves: MODELLED_BEACH })} />);

  expect(screen.getByText(/nothing here is measured/)).toBeDefined();
  const sentence =
    screen.getByText(/nothing here is measured/).textContent ?? "";
  expect(sentence).toContain("comes from a model of the swell");
  expect(sentence).toContain("not from an instrument in the water");
});

test("the disclosure points at where the modelled heights actually are", () => {
  // It used to say "the wave heights below", which was true when a forecast
  // block sat beneath it on the card. Below this sentence now is the air card.
  render(<MeasuredToday readings={readings({ waves: MODELLED_BEACH })} />);

  const sentence =
    screen.getByText(/nothing here is measured/).textContent ?? "";
  expect(sentence).toContain("on the chart above and in the week above that");
  expect(sentence).not.toContain("below");
});

test("it does not tell an open-coast beach that swell does not reach it", () => {
  // The bay sentence was written for enclosed water. On these ten it states the
  // reason their beach is fine as the reason it is not.
  render(<MeasuredToday readings={readings({ waves: MODELLED_BEACH })} />);

  expect(
    screen.queryByText(/Every wave buoy sits out on the open coast/),
  ).toBeNull();
  expect(screen.queryByText(/what we expect rather than a fault/)).toBeNull();
});

test("the refused buoy and the line that replaced it both reach the reader", () => {
  // Either half alone misleads, and this is the last place the pair can be
  // dropped between `beaches.json` and a person.
  render(<MeasuredToday readings={readings({ waves: MODELLED_BEACH })} />);

  const why = screen.getByText(/nearest delivering buoy 46232/);
  expect(why.textContent).toContain("28.2 km");
  expect(why.textContent).toContain("D0001");
  expect(why.textContent).toContain("model rather than a measurement");
});

test("an unavailable buoy is a sentence with the reason behind a disclosure", () => {
  render(
    <MeasuredToday
      readings={readings({
        waves: {
          state: {
            kind: "unavailable",
            detail:
              "NDBC 46254's newest observation is 214 minutes old, past the 180 minute limit.",
            drift: false,
          },
        },
      })}
    />,
  );

  expect(screen.getByText(/could not get a wave reading/)).toBeDefined();
  expect(screen.getByText(/past the 180 minute limit/)).toBeDefined();
  // No wave number anywhere that could read as a calm sea.
  expect(screen.queryByText("2.6 ft")).toBeNull();
});

test("wave drift is named as a bug here rather than a problem at the buoy", () => {
  render(
    <MeasuredToday
      readings={readings({
        waves: {
          state: {
            kind: "unavailable",
            detail: "NDBC 46254: the column layout has drifted.",
            drift: true,
          },
        },
      })}
    />,
  );

  expect(
    screen.getByText(/a bug here rather than a problem at the buoy/),
  ).toBeDefined();
});

/**
 * The two that look alike, kept distinct. `no-buoy` is a permanent fact about
 * the place and `unavailable` is a transient fact about the feed, and
 * collapsing them tells a reader to try again later about something that will
 * never work, or the reverse.
 */
test("a beach with no buoy is never told to come back later", () => {
  const { unmount } = render(
    <MeasuredToday
      readings={readings({
        waves: {
          buoy: null,
          state: {
            kind: "no-buoy",
            reason: "every wave buoy sits on the open coast",
            modelAnswersInstead: false,
          },
        },
      })}
    />,
  );
  expect(screen.queryByText(/Try again shortly/)).toBeNull();
  expect(screen.queryByText(/NDBC/)).toBeNull();
  unmount();

  render(
    <MeasuredToday
      readings={readings({
        waves: {
          state: {
            kind: "unavailable",
            detail: "NDBC 46254 returns 404.",
            drift: false,
          },
        },
      })}
    />,
  );
  // And the transient one does invite a retry, and still names the buoy it
  // could not reach. Matched on the buoy rather than on "NDBC", which the
  // upstream detail in the disclosure also carries.
  expect(screen.getByText(/Try again shortly/)).toBeDefined();
  expect(screen.getByText(/Buoy Scripps Nearshore/)).toBeDefined();
});

/* =========================================================================
 * The air
 * ========================================================================= */

test("the temperature is the air card's largest figure", () => {
  render(<MeasuredToday readings={readings()} />);

  expect(screen.getByText("71°F").className).toContain("text-stat");
});

test("wind is a figure beneath the temperature, not a sentence", () => {
  render(<MeasuredToday readings={readings()} />);

  expect(screen.getByText("Wind")).toBeDefined();
  expect(screen.getByText("8 mph from the north-west")).toBeDefined();
});

/**
 * ADR-0020 took sky and visibility off this card. Asserted as an absence
 * because that is what shipped, and an absence nobody asserts is an absence
 * somebody re-adds — the move into the day is exactly the kind of rewrite where
 * a field comes back by accident.
 */
test("no sky and no visibility appear in the block at all", () => {
  render(<MeasuredToday readings={readings()} />);

  expect(screen.queryByText("Sky")).toBeNull();
  expect(screen.queryByText("Visibility")).toBeNull();
  expect(screen.queryByText(/miles or more/)).toBeNull();
  expect(screen.queryByText(/Miramar/)).toBeNull();
});

test("the air station is named, with its distance", () => {
  // The distance is what tells a reader how near this reading was taken, which
  // is the claim the card is making.
  render(<MeasuredToday readings={readings()} />);

  const air = screen.getByText(/Scripps Pier/).textContent ?? "";
  expect(air).toContain("Temperature and wind");
  expect(air).toContain("about 1.4 km from this beach");
});

test("a gust is shown when the station published one", () => {
  render(
    <MeasuredToday
      readings={readings({ air: { air: { ...AIR_READING, gustMph: 14.2 } } })}
    />,
  );

  expect(screen.getByText("Gusting")).toBeDefined();
  expect(screen.getByText("14 mph")).toBeDefined();
});

test("wind with no direction is still given as a speed", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: { air: { ...AIR_READING, windDirDegT: null } },
      })}
    />,
  );

  expect(screen.getByText("8 mph")).toBeDefined();
});

test("no wind value says so rather than reading as calm", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: { air: { ...AIR_READING, windMph: null, windDirDegT: null } },
      })}
    />,
  );

  expect(screen.getByText("Wind")).toBeDefined();
  expect(screen.getByText("Not reported")).toBeDefined();
});

test("a genuine calm is named as calm, not as a missing reading", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: { air: { ...AIR_READING, windMph: 0, windDirDegT: 0 } },
      })}
    />,
  );

  expect(screen.getByText("Calm")).toBeDefined();
});

/**
 * Regression. The sentence this replaced returned at "The wind is calm" and
 * never reached its gust clause; the first stats version appended one anyway,
 * and the live page rendered "Wind: Calm / Gusting: 2 mph" — a card
 * contradicting itself.
 */
test("a calm wind reports no gust, however the instrument twitched", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: {
          air: { ...AIR_READING, windMph: 0.4, windDirDegT: 0, gustMph: 2.1 },
        },
      })}
    />,
  );

  expect(screen.getByText("Calm")).toBeDefined();
  expect(screen.queryByText("Gusting")).toBeNull();
});

test("a gust with no wind speed at all is not reported either", () => {
  // "Not reported / Gusting 14 mph" would be the same contradiction wearing a
  // different hat: a gust is a property of a wind we do not have.
  render(
    <MeasuredToday
      readings={readings({
        air: {
          air: {
            ...AIR_READING,
            windMph: null,
            windDirDegT: null,
            gustMph: 14.2,
          },
        },
      })}
    />,
  );

  expect(screen.getByText("Not reported")).toBeDefined();
  expect(screen.queryByText("Gusting")).toBeNull();
});

test("a missing temperature says so rather than leaving the card headed by nothing", () => {
  render(
    <MeasuredToday
      readings={readings({ air: { air: { ...AIR_READING, airTempF: null } } })}
    />,
  );

  expect(screen.getByText("No temperature reading")).toBeDefined();
});

test("an unavailable air reading says so and does not blank the card", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: {
          air: {
            kind: "unavailable",
            detail: "NDBC LJAC1 returns 404 for realtime2.",
            drift: false,
          },
        },
      })}
    />,
  );

  expect(screen.getByText("No temperature just now")).toBeDefined();
  expect(screen.getByText(/Why there is no temperature or wind/)).toBeDefined();
  expect(screen.getByText(/Scripps Pier/)).toBeDefined();
});

test("air drift is disclosed as a bug here rather than a problem upstream", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: {
          air: {
            kind: "unavailable",
            detail: "ATMP is published in degF, not degC.",
            drift: true,
          },
        },
      })}
    />,
  );

  expect(
    screen.getByText(/bug here rather than a problem at the station/),
  ).toBeDefined();
});

test("no air station is a permanent fact about the place, with its reason", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: {
          airStation: null,
          air: {
            kind: "no-station",
            reason:
              "the lower endpoint published upstream (32.1327, -117.1332) is outside San Diego County, so no station can be joined to it",
          },
        },
      })}
    />,
  );

  expect(screen.getByText("No station near enough")).toBeDefined();
  expect(screen.getByText(/outside San Diego County/)).toBeDefined();
  // Never invite a reader to retry something that will never work.
  expect(screen.queryByText(/No temperature just now/)).toBeNull();
  expect(screen.queryByText(/Temperature and wind/)).toBeNull();
});

test("the air card says what its figures mean in plain words", () => {
  render(<MeasuredToday readings={readings()} />);

  // 71°F and 8 mph, restated. Never advice: ADR-0009 forbids a verdict, so a
  // Beaufort-style "a gentle breeze" is available and "a good day for it" is
  // not.
  expect(screen.getByText("Mild, with a gentle breeze.")).toBeDefined();
});

test("a calm wind is calm in the words and in the figure", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: { air: { ...AIR_READING, windMph: 0.4, gustMph: 2 } },
      })}
    />,
  );

  expect(screen.getByText("Mild, with no wind.")).toBeDefined();
  expect(screen.getByText("Calm")).toBeDefined();
  expect(screen.queryByText("Gusting")).toBeNull();
});

test("either air figure alone still makes a sentence", () => {
  const { unmount } = render(
    <MeasuredToday
      readings={readings({
        air: { air: { ...AIR_READING, windMph: null, gustMph: null } },
      })}
    />,
  );
  expect(screen.getByText("Mild.")).toBeDefined();
  unmount();

  render(
    <MeasuredToday
      readings={readings({ air: { air: { ...AIR_READING, airTempF: null } } })}
    />,
  );
  expect(screen.getByText("A gentle breeze.")).toBeDefined();
});

test("no line at all when neither air figure arrived", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: {
          air: {
            ...AIR_READING,
            airTempF: null,
            windMph: null,
            gustMph: null,
          },
        },
      })}
    />,
  );

  // A blank sentence is the same mistake as a blank primary: it reads as a
  // fault rather than as an absence.
  expect(screen.getByText("No temperature reading")).toBeDefined();
  expect(screen.queryByText(/^(Cold|Chilly|Cool|Mild|Warm|Hot)\./)).toBeNull();
  expect(screen.queryByText(/breeze|no wind/)).toBeNull();
});

/**
 * The bands themselves, which are the whole of what these two lines say. They
 * are this site's own wording for published figures rather than a standard, so
 * nothing upstream asserts them and this is the only place they are pinned.
 */
test("every temperature band has its own word", () => {
  const bands: [number, string][] = [
    [48, "Cold"],
    [55, "Chilly"],
    [64, "Cool"],
    [71, "Mild"],
    [79, "Warm"],
    [90, "Hot"],
  ];

  for (const [airTempF, word] of bands) {
    const { unmount } = render(
      <MeasuredToday
        readings={readings({
          air: {
            air: { ...AIR_READING, airTempF, windMph: null, gustMph: null },
          },
        })}
      />,
    );

    expect(screen.getByText(`${word}.`)).toBeDefined();
    unmount();
  }
});

test("every wind band has its own words", () => {
  const bands: [number, string][] = [
    [0.4, "No wind."],
    [2, "Barely any wind."],
    [6, "A light breeze."],
    [11, "A gentle breeze."],
    [16, "A moderate breeze."],
    [22, "A fresh breeze."],
    [28, "A strong breeze."],
    [40, "A hard wind."],
  ];

  // Read with no temperature, so the wind is the whole sentence and reaches
  // the capitalising branch the clause form never does.
  for (const [windMph, words] of bands) {
    const { unmount } = render(
      <MeasuredToday
        readings={readings({
          air: {
            air: { ...AIR_READING, airTempF: null, windMph, gustMph: null },
          },
        })}
      />,
    );

    expect(screen.getByText(words)).toBeDefined();
    unmount();
  }
});

test("every compass point has its own words", () => {
  const bearings: [number, string][] = [
    [0, "north"],
    [45, "north-east"],
    [90, "east"],
    [135, "south-east"],
    [180, "south"],
    [225, "south-west"],
    [270, "west"],
    [315, "north-west"],
    // 359 rounds to 8, which is north again rather than an undefined entry.
    [359, "north"],
  ];

  for (const [windDirDegT, words] of bearings) {
    const { unmount } = render(
      <MeasuredToday
        readings={readings({ air: { air: { ...AIR_READING, windDirDegT } } })}
      />,
    );

    expect(screen.getByText(`8 mph from the ${words}`)).toBeDefined();
    unmount();
  }
});

test("a station past ten kilometres loses the decimal its neighbours keep", () => {
  // The air station runs 0.7 km to 7.4 km across the inventory, so the decimal
  // is most of what the figure says at this range -- and pointless past it.
  render(
    <MeasuredToday
      readings={readings({
        air: { airStation: { name: "Miramar MCAS", distanceM: 10_430 } },
      })}
    />,
  );

  expect(screen.getByText(/about 10 km from this beach/)).toBeDefined();
});

test("a station with no recorded distance is still named", () => {
  render(
    <MeasuredToday
      readings={readings({
        air: { airStation: { name: "Scripps Pier", distanceM: null } },
      })}
    />,
  );

  const line = screen.getByText(/Scripps Pier/).textContent ?? "";
  expect(line).toContain("Temperature and wind");
  expect(line).not.toContain("km from this beach");
});

/* =========================================================================
 * Across both cards
 * ========================================================================= */

/**
 * ADR-0004's 44px floor. A `<summary>` is background-less, so it takes the
 * floor at every breakpoint and carries no `md:min-h-0` -- see `disclosure.ts`.
 *
 * Every summary the block can render rather than a named one, because the
 * failure this repo has is drift: a disclosure added later without the floor.
 * Per ADR-0001 jsdom applies no stylesheets, so this proves the class is
 * referenced, not that the box measures 44px. That stays a human check.
 */
test("every disclosure this block can render composes the touch-target floor", () => {
  const renders = [
    render(
      <MeasuredToday
        readings={readings({
          waves: {
            buoy: null,
            state: {
              kind: "no-buoy",
              reason: "every wave buoy sits on the open coast",
              modelAnswersInstead: false,
            },
          },
          air: {
            airStation: null,
            air: { kind: "no-station", reason: "no station near enough" },
          },
        })}
      />,
    ),
    render(
      <MeasuredToday
        readings={readings({
          waves: {
            state: {
              kind: "unavailable",
              detail: "NDBC 46254's newest observation is 214 minutes old.",
              drift: false,
            },
          },
          air: {
            air: {
              kind: "unavailable",
              detail: "NDBC LJAC1 returns 404 for realtime2.",
              drift: false,
            },
          },
        })}
      />,
    ),
  ];

  const summaries = renders.flatMap((r) => [
    ...r.container.querySelectorAll("summary"),
  ]);

  expect(summaries).toHaveLength(4);
  for (const summary of summaries) {
    expect(summary.className).toContain(DISCLOSURE_TARGET);
  }
});

/**
 * ADR-0015's glyph vocabulary, which came with the cards. 💨 rather than 🌬️:
 * the wind face is the obvious Unicode choice and putting a face on a page of
 * instrument readings was the objection to it.
 */
test("each card keeps the glyph its subject was given", () => {
  const { container } = render(<MeasuredToday readings={readings()} />);

  const glyphs = [...container.querySelectorAll('[aria-hidden="true"]')].map(
    (node) => node.textContent,
  );
  expect(glyphs).toEqual(["🏄", "💨"]);
});

/**
 * One card going quiet must not take the other with it. They are two networks
 * and two failure modes, and this is the property that let the three cards sit
 * on their own Suspense boundaries in the band this block replaces.
 */
test("a quiet buoy leaves the air standing, and the reverse", () => {
  const { unmount } = render(
    <MeasuredToday
      readings={readings({
        waves: {
          state: {
            kind: "unavailable",
            detail: "NDBC 46254 returns 404.",
            drift: false,
          },
        },
      })}
    />,
  );
  expect(screen.getByText("71°F")).toBeDefined();
  expect(screen.getByText(/could not get a wave reading/)).toBeDefined();
  unmount();

  render(
    <MeasuredToday
      readings={readings({
        air: {
          air: {
            kind: "unavailable",
            detail: "NDBC LJAC1 returns 404 for realtime2.",
            drift: false,
          },
        },
      })}
    />,
  );
  expect(screen.getByText("2.6 ft")).toBeDefined();
  expect(screen.getByText("No temperature just now")).toBeDefined();
});

/**
 * The guarantee that used to be structural.
 *
 * This block reports instruments, and an instrument answers for one instant:
 * now. It sat *outside* `SelectedDayProvider` in the tree so that there was no
 * day in scope for it to read — "a later change cannot quietly make these
 * figures follow Thursday, because there is nothing to follow".
 *
 * The provider moved out to `app/conditions/layout.tsx` when the tool grew a
 * second route, so a chosen day survives a move from an area to one of its
 * beaches (ADR-0047). The whole page is inside it now and the tree no longer
 * says anything, so the claim is asserted instead of arranged — which is the
 * stronger form of it: the block is rendered with a day chosen and with none,
 * and the markup must be identical.
 *
 * **The probe is what stops this being a test that can only pass.** Choosing a
 * day has to actually reach the context, or "the markup did not change" is true
 * for the wrong reason. So a sibling inside the same provider prints the chosen
 * day, and the test requires it to change before it requires the block not to.
 */
function DayProbe() {
  const { selected, choose } = useSelectedDay();
  return (
    <button onClick={() => choose("2026-09-10")}>
      probe:{selected ?? "none"}
    </button>
  );
}

test("the measured block does not follow the chosen day", () => {
  const { container } = render(
    <SelectedDayProvider>
      <DayProbe />
      <MeasuredToday readings={readings()} />
    </SelectedDayProvider>,
  );

  const blockOf = (html: string) =>
    html.slice(html.indexOf("</button>") + "</button>".length);

  expect(screen.getByText("probe:none")).toBeDefined();
  const beforeBlock = blockOf(container.innerHTML);

  fireEvent.click(screen.getByRole("button"));

  // The provider is live: the choice reached a sibling in the same tree. Without
  // this the assertion below would hold whether or not a day was ever chosen.
  expect(screen.getByText("probe:2026-09-10")).toBeDefined();
  expect(blockOf(container.innerHTML)).toBe(beforeBlock);
});

/**
 * An area reports what its beaches share, so a product they do not share gets a
 * card saying so rather than a figure from one of them.
 *
 * Two sentences, because `absent` and `mixed` are two different facts. Thirteen
 * of the eighteen areas have no wave buoy anywhere in them and two have beaches
 * that bind different ones; a reader owed "there is none here" must not be told
 * "they disagree", and the reverse would be worse — it would imply the area has
 * no instrument when in fact it has several.
 */
test("an area with no buoy anywhere says so, and does not blame disagreement", () => {
  render(
    <MeasuredToday
      readings={{
        waves: {
          agreement: "absent",
          areaName: "Mission Bay – West",
          beaches: 8,
          distinct: 0,
          without: 8,
        },
        air: readings().air,
      }}
    />,
  );

  expect(
    screen.getByText(/No beach in Mission Bay – West has a wave reading/),
  ).toBeDefined();
  expect(screen.queryByText(/different sources/)).toBeNull();
  // The other card still stands: one withheld product must not cost the other.
  expect(screen.getByText("71°F")).toBeDefined();
});

test("an area whose beaches disagree names how many, and how many sources", () => {
  render(
    <MeasuredToday
      readings={{
        waves: {
          agreement: "mixed",
          areaName: "Torrey Pines",
          beaches: 2,
          distinct: 2,
          without: 0,
        },
        air: readings().air,
      }}
    />,
  );

  expect(
    screen.getByText(
      /The 2 beaches in Torrey Pines read 2 different sources for a wave reading/,
    ),
  ).toBeDefined();
});

/**
 * The other shape of `mixed`, and the one the count was wrong about.
 *
 * Nine of La Jolla's ten beaches read buoy 46254 and `childrens-pool` reads
 * none. That is one source and one gap, and this card said "2 different
 * sources" over it on the default area's own page — because `areaSources` put
 * `null` in the set with the identifiers, and because the test above this one
 * asserted the sentence against a `distinct` nobody had read off the data.
 *
 * These numbers are the real ones, and `MeasuredPanel.test.tsx` asserts the
 * same sentence against `areaSources`' actual output rather than against a
 * fixture, which is the half that could have caught it.
 */
test("an area where some beaches have none says that, not that they disagree", () => {
  render(
    <MeasuredToday
      readings={{
        waves: {
          agreement: "mixed",
          areaName: "La Jolla",
          beaches: 10,
          distinct: 1,
          without: 1,
        },
        air: readings().air,
      }}
    />,
  );

  expect(
    screen.getByText(
      /Only 9 of the 10 beaches in La Jolla have a wave reading, and they share one source/,
    ),
  ).toBeDefined();
  // The claim that was false: they read one buoy, not two.
  expect(screen.queryByText(/different sources/)).toBeNull();
});

/**
 * The withheld card is the card it replaces, not a new one. ADR-0015 makes the
 * glyph a closed vocabulary, so a second glyph for waves would be a second word
 * for one thing — and a different heading rank would put a hole in the outline.
 * A first draft of this component invented both.
 */
test("a withheld card keeps the glyph and rank of the card it stands in for", () => {
  const withReading = render(<MeasuredToday readings={readings()} />);
  const realHeading = screen.getByRole("heading", { name: "Waves and water" });
  expect(realHeading.tagName).toBe("H2");
  withReading.unmount();

  render(
    <MeasuredToday
      readings={{
        waves: {
          agreement: "absent",
          areaName: "Coronado",
          beaches: 3,
          distinct: 0,
          without: 3,
        },
        air: readings().air,
      }}
    />,
  );

  const withheldHeading = screen.getByRole("heading", {
    name: "Waves and water",
  });
  expect(withheldHeading.tagName).toBe("H2");
  expect(withheldHeading.id).toBe("waves-today-heading");
  expect(screen.getByText("🏄")).toBeDefined();
});
