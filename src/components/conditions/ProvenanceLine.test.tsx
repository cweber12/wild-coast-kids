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

/**
 * The regression. This component hardcoded `CARD_MUTED` -- white at 55%, chosen
 * and measured against the reading card's `bg-dark` -- and two callers render
 * it on the page's own cream ground, where that paints 1.03:1. The line was in
 * the DOM, correct, attributed and invisible.
 *
 * The surface is the caller's fact and cannot be inferred here, so it is asked
 * for. The default stays the card, because that is where five of the six call
 * sites are and a default that silently changed them would trade this bug for
 * a quieter one.
 */
test("on the page's own ground it does not use the card's colour", () => {
  const { container } = render(
    <ProvenanceLine source={SOURCE} network="CDIP" surface="page" />,
  );

  const line = container.querySelector("p");
  expect(line?.getAttribute("class")).toContain("text-fog");
  expect(line?.getAttribute("class")).not.toContain("text-white");
});

test("on a card it keeps the colour measured against that card", () => {
  const { container } = render(
    <ProvenanceLine source={SOURCE} network="CDIP" />,
  );

  expect(container.querySelector("p")?.getAttribute("class")).toContain(
    "text-white/55",
  );
});

/**
 * The fifth fact, and the one the caller words rather than this component.
 *
 * A source read off one row states its time and a source read off several
 * states a bound, and which of those is true depends on how the read was
 * composed -- something this component cannot see. So it renders the string it
 * is handed, in one position, and does not decide what the claim is. ADR-0054.
 */
test("an observation time is rendered as the caller worded it", () => {
  render(
    <ProvenanceLine
      source={SOURCE}
      network="NDBC"
      observed="nothing older than 1:48 PM"
    />,
  );

  const line = screen.getByText(/NDBC/).textContent ?? "";
  expect(line).toContain("nothing older than 1:48 PM");
  // The claim survives verbatim. A component that reworded this could turn a
  // bound into a point, which is the one thing the wording is protecting.
  expect(line).not.toContain("Measured now");
});

test("no time is shown when the caller has none to give", () => {
  render(<ProvenanceLine source={SOURCE} network="NDBC" />);

  const line = screen.getByText(/NDBC/).textContent ?? "";
  expect(line).toBe(`${SOURCE} · NDBC`);
});
