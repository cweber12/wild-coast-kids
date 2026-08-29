import { describe, expect, test } from "vitest";
import {
  MOP_MODEL_NOTE,
  MOP_NETWORK,
  mopLineDistanceKm,
  mopLineSource,
} from "./mopLine";

describe("mopLineSource", () => {
  test("names what the identifier is, rather than printing it bare", () => {
    // CDIP gives these no name -- they are numbered south to north behind a
    // county prefix -- so "D0498" alone would read as a callsign turned into
    // prose, which is the failure #87 records.
    expect(mopLineSource("D0498")).toBe("MOP line D0498");
  });
});

describe("mopLineDistanceKm", () => {
  test("keeps a decimal, because every line is inside a kilometre", () => {
    // Rounding to whole kilometres would print "0 km" or "1 km" for all
    // fifteen bound beaches and say nothing.
    expect(mopLineDistanceKm(325)).toBe("0.3");
    expect(mopLineDistanceKm(117)).toBe("0.1");
    expect(mopLineDistanceKm(910)).toBe("0.9");
  });

  test("withholds nothing above a threshold, unlike the measured cards", () => {
    // The buoy and station cards hide a distance under theirs because it is
    // noise beside the reading. This one is the answer to the question the
    // forecast invites: is the model's point nearer than the buoy?
    expect(mopLineDistanceKm(40)).toBe("0.0");
  });

  test("gives null when the binding recorded no distance", () => {
    expect(mopLineDistanceKm(null)).toBeNull();
  });
});

describe("the words the page uses about this feed", () => {
  test("credit both CDIP and the institution behind it", () => {
    // "CDIP" alone is an identifier a reader has no way to expand.
    expect(MOP_NETWORK).toContain("CDIP");
    expect(MOP_NETWORK).toContain("Scripps Institution of Oceanography");
  });

  test("say on the attribution itself that the figure is modelled", () => {
    // ADR-0016 turns on a reader being able to tell the modelled height from
    // the measured one on the same page.
    expect(MOP_MODEL_NOTE).toContain("not a measurement");
  });
});
