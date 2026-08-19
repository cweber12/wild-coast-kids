import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NDBC_BOX,
  NWS_BOX,
  SHORE,
  buildTable,
  document,
  inBox,
  ndbcCapabilities,
  nwsCapabilities,
  nwsStationListUrls,
  parseActiveStations,
  probeDate,
  probeNdbc,
  probeNws,
  tableRow,
} from "./probe-observation-stations.mjs";

/**
 * The probe's rules, asserted without the network.
 *
 * What cannot be asserted here is what NOAA publishes: a gate must not reach
 * either endpoint. `--check` is the thing that measures, and it is run by hand.
 * These hold the *reading* still -- what counts as publishing a field, what
 * counts as membership, and that an unclassified station stops the write.
 */

const observation = (fields) => ({
  textDescription: "",
  temperature: { value: null },
  windSpeed: { value: null },
  visibility: { value: null },
  ...fields,
});

describe("what an NWS station is measured to publish", () => {
  it("counts a field present on any one of the observations read", () => {
    // The point of reading six. ATMP-style gaps are per-observation, and a
    // station that answered null once has not stopped publishing temperature.
    const capabilities = nwsCapabilities([
      observation({}),
      observation({ temperature: { value: 22.4 } }),
      observation({}),
    ]);

    expect(capabilities.publishes_air_temp).toBe(true);
  });

  it("does not count an empty sky description as a sky", () => {
    // A station with no sky serves "" rather than omitting the key. Counting it
    // would put every mesonet station in the sky pool, which is the filter the
    // whole air panel hangs off.
    const capabilities = nwsCapabilities([
      observation({ textDescription: "" }),
      observation({ textDescription: "   " }),
    ]);

    expect(capabilities.publishes_sky).toBe(false);
  });

  it("counts a real sky description", () => {
    const capabilities = nwsCapabilities([
      observation({ textDescription: "" }),
      observation({ textDescription: "Partly Cloudy" }),
    ]);

    expect(capabilities.publishes_sky).toBe(true);
  });

  it("separates answering from publishing", () => {
    // SDFRV answers with six observations carrying no values at all. Recording
    // that as "does not deliver" would lose the difference between a station
    // that is down and one that is up and measuring nothing.
    const capabilities = nwsCapabilities([observation({}), observation({})]);

    expect(capabilities.delivers).toBe(true);
    expect(capabilities.publishes_air_temp).toBe(false);
    expect(capabilities.publishes_wind).toBe(false);
  });

  it("treats no observations at all as not delivering", () => {
    expect(nwsCapabilities([]).delivers).toBe(false);
  });
});

describe("what an NDBC station is measured to publish", () => {
  const payload = [
    "#YY  MM DD hh mm WDIR WSPD GST  WVHT  ATMP  WTMP   VIS",
    "#yr  mo dy hr mn degT m/s  m/s     m  degC  degC   nmi",
    "2026 08 19 00 54  280  1.0  1.5    MM  24.5  17.2    MM",
    "2026 08 19 00 24  290  1.5  2.0    MM    MM  17.3    MM",
  ].join("\n");

  it("reads the columns from the header rather than from a fixed offset", () => {
    // A column added upstream shifts every reading one place to the left, which
    // is the failure the wave parser already pins against.
    const shifted = [
      "#YY  MM DD hh mm NEW WDIR WSPD GST  WVHT  ATMP  WTMP   VIS",
      "#yr  mo dy hr mn  --  degT m/s  m/s     m  degC  degC   nmi",
      "2026 08 19 00 54  MM  280  1.0  1.5    MM  24.5  17.2    MM",
    ].join("\n");

    expect(ndbcCapabilities(shifted).publishes_air_temp).toBe(true);
    expect(ndbcCapabilities(shifted).publishes_wind).toBe(true);
  });

  it("counts a field carried on any row, since ATMP lands on some and not others", () => {
    expect(ndbcCapabilities(payload).publishes_air_temp).toBe(true);
    expect(ndbcCapabilities(payload).publishes_wind).toBe(true);
  });

  it("does not count MM as a reading", () => {
    // VIS is MM on every row of every station in this corridor. Counting the
    // marker would put a visibility promise on a station that has never
    // published one.
    expect(ndbcCapabilities(payload).publishes_visibility).toBe(false);
  });

  it("reports no sky, because realtime2 has no sky column", () => {
    // Distinct from "these stations decline to fill it": the product does not
    // carry the field, so no NDBC station can ever win the sky join.
    expect(ndbcCapabilities(payload).publishes_sky).toBe(false);
  });

  it("treats a header with no data rows as not delivering", () => {
    const headerOnly = payload.split("\n").slice(0, 2).join("\n");
    expect(ndbcCapabilities(headerOnly).delivers).toBe(false);
  });
});

describe("membership", () => {
  it("keeps a station inside the box and drops one outside it", () => {
    expect(inBox({ lat: 32.867, lon: -117.257 }, NDBC_BOX)).toBe(true);
    expect(inBox({ lat: 34.5, lon: -120.1 }, NDBC_BOX)).toBe(false);
  });

  it("reads the NDBC listing's lower-case ids as the ids realtime2 serves", () => {
    // Both Scripps Pier stations are listed lower case and served upper case.
    // A case-sensitive match finds neither, which is one half of how they were
    // lost from wave-buoys.json.
    const stations = parseActiveStations(
      '<station id="ljac1" lat="32.867" lon="-117.257" elev="9.3" name="La Jolla" type="fixed"/>',
    );

    expect(stations[0].id).toBe("LJAC1");
  });

  it("carries the type through, since that filter is the other half", () => {
    const stations = parseActiveStations(
      '<station id="46086" lat="32.504" lon="-118.029" elev="0" name="San Clemente Basin" type="buoy"/>',
    );

    expect(stations[0].type).toBe("buoy");
  });

  it("reads a published elevation and keeps an absent one absent", () => {
    const stations = parseActiveStations(
      '<station id="ljpc1" lat="32.867" lon="-117.257" elev="0" name="La Jolla" type="fixed"/>' +
        '<station id="sdbc1" lat="32.714" lon="-117.174" name="San Diego" type="fixed"/>',
    );

    expect(stations[0].elevation_m).toBe(0);
    // Not zero. A station that publishes no elevation has not published sea
    // level, and `shore` is read from this field.
    expect(stations[1].elevation_m).toBeNull();
  });

  it("refuses a listing it parsed nothing out of", () => {
    // An empty result would write a table with no NDBC stations in it and look
    // exactly like a corridor with no stations.
    expect(() => parseActiveStations("<stations></stations>")).toThrow(
      /changed document/,
    );
  });
});

describe("the table", () => {
  const probed = (fields) => ({
    id: "LJAC1",
    name: "9410230 - La Jolla, CA",
    network: "ndbc",
    lat: 32.867,
    lon: -117.257,
    elevation_m: 9.3,
    delivers: true,
    publishes_air_temp: true,
    publishes_wind: true,
    publishes_sky: false,
    ...fields,
  });

  it("refuses to write a station nobody has classified", () => {
    // The failure this whole script exists to end: a station that appears in a
    // listing and is quietly left out, or quietly defaulted, with nothing
    // saying which. `shore` is a judgement, so it stops rather than guesses.
    expect(() => tableRow(probed({ id: "XXXXX" }))).toThrow(
      /not classified in SHORE/,
    );
  });

  it("carries the hand-written shore flag onto the row", () => {
    expect(tableRow(probed()).shore).toBe(true);
    expect(tableRow(probed({ id: "MSDSD" })).shore).toBe(false);
  });

  it("carries a dead note only when the station does not deliver", () => {
    expect(tableRow(probed()).dead_note).toBeUndefined();
    expect(
      tableRow(probed({ delivers: false, dead_note: "HTTP 404" })).dead_note,
    ).toBe("HTTP 404");
  });

  it("orders north to south so two runs produce the same file", () => {
    const table = buildTable([
      probed({ id: "TIXC1", lat: 32.575 }),
      probed({ id: "LJAC1", lat: 32.867 }),
      probed({ id: "KSAN", lat: 32.733, network: "nws" }),
    ]);

    expect(Object.keys(table)).toEqual(["LJAC1", "KSAN", "TIXC1"]);
  });

  it("breaks a latitude tie on the id, since the piers share coordinates", () => {
    const table = buildTable([
      probed({ id: "LJPC1", lat: 32.867 }),
      probed({ id: "LJAC1", lat: 32.867 }),
    ]);

    expect(Object.keys(table)).toEqual(["LJAC1", "LJPC1"]);
  });
});

describe("the document", () => {
  const table = buildTable([
    {
      id: "LJAC1",
      name: "9410230 - La Jolla, CA",
      network: "ndbc",
      lat: 32.867,
      lon: -117.257,
      elevation_m: 9.3,
      delivers: true,
      publishes_air_temp: true,
      publishes_wind: true,
      publishes_sky: false,
    },
    {
      id: "KSAN",
      name: "San Diego International Airport",
      network: "nws",
      lat: 32.73361,
      lon: -117.18306,
      elevation_m: 4,
      delivers: true,
      publishes_air_temp: true,
      publishes_wind: true,
      publishes_sky: true,
    },
  ]);

  it("counts the air pool from the capability flags rather than restating a number", () => {
    // The count in the prose is derived, so it cannot disagree with the table
    // underneath it -- which is exactly what went wrong in wave-buoys.json.
    expect(document(table)._what_was_measured).toMatch(
      /2 publish air temperature and wind together/,
    );
    expect(document(table)._what_was_measured).toMatch(/1 publish sky/);
  });

  it("states the fixed-station filter in the provenance", () => {
    // The criterion that lost the piers. Unstated, it is exactly the same
    // failure again with a different network.
    expect(document(table)._provenance).toMatch(/type "fixed"/);
  });

  it("carries caveats, which the caveats gate then requires something to load", () => {
    expect(document(table).unresolved.length).toBeGreaterThan(0);
    for (const entry of document(table).unresolved) {
      expect(typeof entry).toBe("string");
      expect(entry.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("the shore classification", () => {
  it("puts a bay station in the marine layer, which is the decided case", () => {
    // Measured before deciding: excluding the bay costs Ocean Beach, Sunset
    // Cliffs and the Coronado beaches six to eight kilometres each, because the
    // ocean side of Point Loma has no low station of its own.
    expect(SHORE.KSAN).toBe(true);
    expect(SHORE.E9951).toBe(true);
  });

  it("keeps a hilltop out of it however close it is", () => {
    // Mt. Soledad at 102 m is nearer to half these beaches than anything at sea
    // level, and reads several degrees warmer for exactly that reason.
    expect(SHORE.MSDSD).toBe(false);
    expect(SHORE.DMHSD).toBe(false);
    expect(SHORE.D3101).toBe(false);
  });

  it("classifies every station, including the ones that publish nothing", () => {
    // A station excluded by capability today can be included by capability
    // tomorrow, and the flag it would then need is a judgement nobody would be
    // there to make.
    for (const id of ["SDBC1", "NPQC1", "TIQC1", "SDFRV", "E3219"]) {
      expect(SHORE[id], `${id} is unclassified`).toBeTypeOf("boolean");
    }
  });
});

describe("the boxes", () => {
  it("keeps the NWS box wider than the corridor, as the county list needs", () => {
    expect(NWS_BOX.maxLat).toBeGreaterThan(NDBC_BOX.maxLat);
    expect(NWS_BOX.maxLon).toBeGreaterThan(NDBC_BOX.maxLon);
  });
});

describe("the generated date", () => {
  it("is the date where the beaches are, not where the clock is", () => {
    // 01:59 UTC on the 19th is 18:59 on the 18th in San Diego. Stamping the UTC
    // date -- which seed-beaches.mjs still does -- makes any evening run claim a
    // day that has not started in the county the file describes, and makes this
    // table read a day newer than the sibling tables probed beside it.
    expect(probeDate(new Date("2026-08-19T01:59:22Z"))).toBe("2026-08-18");
  });

  it("agrees with UTC when the two are the same day", () => {
    expect(probeDate(new Date("2026-08-18T16:00:00Z"))).toBe("2026-08-18");
  });

  it("is what the document records", () => {
    const table = buildTable([
      {
        id: "KSAN",
        name: "San Diego International Airport",
        network: "nws",
        lat: 32.73361,
        lon: -117.18306,
        elevation_m: 4,
        delivers: true,
        publishes_air_temp: true,
        publishes_wind: true,
        publishes_sky: true,
      },
    ]);

    expect(document(table, new Date("2026-08-19T01:59:22Z")).generated).toBe(
      "2026-08-18",
    );
  });
});

/**
 * The fetching half.
 *
 * Stubbed rather than left as plumbing, on the same grounds the wave fetch
 * policy was: what a 404 means, which stations are in the candidate set, and
 * whether a failed lookup is reported are rules, and none of them can be
 * asserted against a publisher that is having a good day.
 */
const beachAt = (lat, lon) => ({
  segment: { upper: { lat, lon }, lower: { lat, lon } },
});

const stationFeature = (id, lat, lon, elevation) => ({
  geometry: { coordinates: [lon, lat] },
  properties: {
    stationIdentifier: id,
    name: id,
    elevation: elevation === null ? null : { value: elevation },
  },
});

const jsonReply = (body) => ({ ok: true, status: 200, json: async () => body });

/** A fetch that answers on the first pattern the URL contains, else 404s. */
function routes(handlers) {
  return vi.fn(async (url) => {
    for (const [pattern, respond] of handlers) {
      if (url.includes(pattern)) return respond(url);
    }
    return { ok: false, status: 404 };
  });
}

const GRID_STATIONS = "https://api.weather.gov/gridpoints/SGX/55,22/stations";
const gridpointReply = () =>
  jsonReply({ properties: { observationStations: GRID_STATIONS } });

describe("probing the National Weather Service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops a listed station whose coordinates fall outside the county box", async () => {
    // The listing is a union over gridpoints, and a gridpoint on the county
    // edge lists stations well outside it. Keeping them would put a station in
    // another state into a San Diego beach's candidate set.
    vi.stubGlobal(
      "fetch",
      routes([
        ["/points/", gridpointReply],
        [
          "/gridpoints/",
          () =>
            jsonReply({
              features: [
                stationFeature("KSAN", 32.73361, -117.18306, 4),
                stationFeature("KFAR", 40.1, -105.2, 1600),
              ],
            }),
        ],
        ["/observations", () => jsonReply({ features: [] })],
      ]),
    );

    const probed = await probeNws([beachAt(32.85, -117.25)]);

    expect(probed.map((station) => station.id)).toEqual(["KSAN"]);
  });

  it("keeps a station that 404s, marked, rather than dropping it", async () => {
    // The listed-but-dead trap this repo has now measured six times. A dropped
    // station looks identical to one that was never listed, so the next probe
    // cannot tell that anything changed.
    vi.stubGlobal(
      "fetch",
      routes([
        ["/points/", gridpointReply],
        [
          "/gridpoints/",
          () =>
            jsonReply({
              features: [stationFeature("KSAN", 32.73361, -117.18306, 4)],
            }),
        ],
        ["/observations", () => ({ ok: false, status: 404 })],
      ]),
    );

    const [probed] = await probeNws([beachAt(32.85, -117.25)]);

    expect(probed.delivers).toBe(false);
    expect(probed.dead_note).toMatch(/404/);
    expect(probed.dead_note).toMatch(/quietly vanished/);
  });

  it("carries the published elevation through, since shore is read from it", async () => {
    vi.stubGlobal(
      "fetch",
      routes([
        ["/points/", gridpointReply],
        [
          "/gridpoints/",
          () =>
            jsonReply({
              features: [
                stationFeature("MSDSD", 32.81418, -117.24088, 102.108),
              ],
            }),
        ],
        [
          "/observations",
          () =>
            jsonReply({
              features: [
                {
                  properties: {
                    temperature: { value: 22 },
                    windSpeed: { value: 8 },
                    textDescription: "",
                  },
                },
              ],
            }),
        ],
      ]),
    );

    const [probed] = await probeNws([beachAt(32.85, -117.25)]);

    expect(probed.elevation_m).toBe(102.108);
    expect(probed.publishes_air_temp).toBe(true);
    expect(probed.publishes_sky).toBe(false);
  });

  it("reports a gridpoint it could not resolve instead of quietly shrinking the pool", async () => {
    // Upstream publishes at least one beach endpoint outside the county and one
    // the API has no grid for. A silent skip would shrink the candidate set
    // invisibly, which is the exact failure this script exists to end.
    const lines = [];
    const error = vi
      .spyOn(console, "error")
      .mockImplementation((line) => lines.push(line));

    vi.stubGlobal(
      "fetch",
      routes([
        ["/points/32.1327", () => ({ ok: false, status: 404 })],
        ["/points/", gridpointReply],
      ]),
    );

    await nwsStationListUrls([
      beachAt(32.1327, -117.1332),
      beachAt(32.85, -117.25),
    ]);

    expect(lines.some((line) => line.includes("no gridpoint for"))).toBe(true);
    error.mockRestore();
  });

  it("refuses a discovery that resolved no gridpoint at all", async () => {
    // An empty candidate set writes a table with no stations in it and reads
    // exactly like a county that has none.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      routes([["/points/", () => ({ ok: false, status: 500 })]]),
    );

    await expect(nwsStationListUrls([beachAt(32.85, -117.25)])).rejects.toThrow(
      /broken discovery/,
    );
    error.mockRestore();
  });
});

describe("probing NDBC", () => {
  const listing =
    '<station id="ljac1" lat="32.867" lon="-117.257" elev="9.3" name="La Jolla" type="fixed"/>' +
    '<station id="46254" lat="32.868" lon="-117.267" elev="0" name="SCRIPPS Nearshore" type="buoy"/>' +
    '<station id="tiqc1" lat="32.568" lon="-117.131" name="Oneonta Slough" type="fixed"/>' +
    '<station id="lixa2" lat="58.54" lon="-135.047" elev="9.1" name="Little Island, AK" type="fixed"/>';

  const rows = [
    "#YY  MM DD hh mm WDIR WSPD ATMP",
    "#yr  mo dy hr mn degT m/s  degC",
    "2026 08 19 00 54  280  1.0 24.5",
  ].join("\n");

  const serving = (realtime2) =>
    vi.fn(async (url) =>
      url.includes("activestations")
        ? { ok: true, status: 200, text: async () => listing }
        : realtime2(url),
    );

  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes the fixed stations in the corridor and leaves the buoys to their own table", async () => {
    // The criterion that lost both Scripps Pier stations, now applied by code
    // rather than by whoever last ran a probe. A buoy inside the box is left
    // out, and so is a fixed station in Alaska.
    const error = quiet();
    vi.stubGlobal(
      "fetch",
      serving(async () => ({ ok: true, status: 200, text: async () => rows })),
    );

    const probed = await probeNdbc();

    expect(probed.map((station) => station.id).sort()).toEqual([
      "LJAC1",
      "TIQC1",
    ]);
    error.mockRestore();
  });

  it("asks realtime2 for the upper-case id the listing gave in lower case", async () => {
    // realtime2 404s on the lower-case form the listing publishes, so a
    // case-sensitive probe would record both pier stations as dead.
    const error = quiet();
    const fetchMock = serving(async () => ({
      ok: true,
      status: 200,
      text: async () => rows,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await probeNdbc();
    const asked = fetchMock.mock.calls.map(([url]) => url);

    expect(asked.some((url) => url.endsWith("/LJAC1.txt"))).toBe(true);
    expect(asked.some((url) => url.endsWith("/ljac1.txt"))).toBe(false);
    error.mockRestore();
  });

  it("keeps a 404 station marked rather than dropping it", async () => {
    const error = quiet();
    vi.stubGlobal(
      "fetch",
      serving(async () => ({ ok: false, status: 404 })),
    );

    const probed = await probeNdbc();

    expect(probed.every((station) => station.delivers === false)).toBe(true);
    expect(probed[0].dead_note).toMatch(/404/);
    error.mockRestore();
  });

  it("refuses a listing that did not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );

    await expect(probeNdbc()).rejects.toThrow(/HTTP 503/);
  });
});
