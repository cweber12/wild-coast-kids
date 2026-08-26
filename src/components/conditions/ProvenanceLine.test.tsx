import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvenanceLine } from "./ProvenanceLine";

const SOURCE = "La Jolla (Scripps Institution Wharf)";

test("the source and the network are both named", () => {
  render(<ProvenanceLine source={SOURCE} network="NOAA Tides & Currents" />);

  const line = screen.getByText(/NOAA Tides & Currents/).textContent ?? "";
  expect(line).toContain(SOURCE);
  expect(line).toContain("NOAA Tides & Currents");
});

/**
 * A near station is credited without a number, which is what the panels did
 * before and what their own thresholds decide. The line does not invent a
 * distance when the caller withholds one.
 */
test("no distance is shown when the caller withholds one", () => {
  render(<ProvenanceLine source={SOURCE} network="NOAA Tides & Currents" />);

  expect(screen.queryByText(/km/)).toBeNull();
});

/**
 * The caller hands over a rounded number and this component writes the
 * sentence. Handing out the wording as well produced four phrasings of one
 * fact across three components -- "about N km away", "about N km from this
 * beach", "N km from this beach" and "N km away" -- two of them twenty lines
 * apart in the same file. The rounding stays with the caller, where each
 * threshold has its reason recorded.
 */
test("the caller gives a number and this line words it", () => {
  render(
    <ProvenanceLine
      source={SOURCE}
      network="NOAA Tides & Currents"
      distanceKm="12"
    />,
  );

  expect(screen.getByText(/about 12 km from this beach/)).toBeDefined();
});

test("the caller's rounding survives verbatim", () => {
  // "4.7" and "12" are decisions made upstream: the air panel keeps a decimal
  // under ten kilometres precisely so a 1.4 km station and a 10.4 km one stay
  // comparable, and this line must not round that away again.
  render(<ProvenanceLine source={SOURCE} distanceKm="4.7" />);

  expect(screen.getByText(/about 4\.7 km from this beach/)).toBeDefined();
});

/**
 * The clause `TideToday` calls "the difference between a prediction for this
 * shore and the nearest one anybody publishes". A distance alone understates a
 * station that is far away because nothing nearer exists.
 */
test("the reason a distant source was used survives", () => {
  render(
    <ProvenanceLine
      source={SOURCE}
      network="NOAA Tides & Currents"
      distanceKm="12"
      note="the nearest open-coast station publishing predictions"
    />,
  );

  expect(
    screen.getByText(/the nearest open-coast station publishing predictions/),
  ).toBeDefined();
});

test("no note is rendered when there is nothing to explain", () => {
  render(
    <ProvenanceLine
      source={SOURCE}
      network="NOAA Tides & Currents"
      distanceKm="1.4"
    />,
  );

  expect(screen.queryByText(/—/)).toBeNull();
});

/**
 * A card carrying two sources needs to say which figures each one supplied.
 * That is ADR-0010's requirement, and the air panel is why this prop exists.
 */
test("a label says which figures this source supplied", () => {
  render(
    <ProvenanceLine
      label="Sky and visibility"
      source="San Diego International"
      network="NWS"
      distanceKm="10"
    />,
  );

  expect(screen.getByText("Sky and visibility")).toBeDefined();
});

test("no label is rendered when a card has only one source", () => {
  const { container } = render(
    <ProvenanceLine source={SOURCE} network="NOAA Tides & Currents" />,
  );

  expect(container.querySelector("span")).toBeNull();
});
