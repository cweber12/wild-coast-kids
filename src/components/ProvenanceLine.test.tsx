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

test("a distance is shown when the caller gives one", () => {
  render(
    <ProvenanceLine
      source={SOURCE}
      network="NOAA Tides & Currents"
      distance="about 12 km away"
    />,
  );

  expect(screen.getByText(/about 12 km away/)).toBeDefined();
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
      distance="about 12 km away"
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
      distance="1.4 km away"
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
      distance="10 km away"
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
