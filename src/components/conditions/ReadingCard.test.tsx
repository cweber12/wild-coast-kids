import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadingCard } from "./ReadingCard";

function card(figure?: string | null) {
  return (
    <ReadingCard
      emoji="🐚"
      headingLevel="h3"
      headingId="test-heading"
      title="Lowest tide today"
      context="La Jolla Shores Beach"
      figure={figure}
    >
      <p>the body of the reading</p>
    </ReadingCard>
  );
}

test("the heading names the reading, briefly, because three sit side by side", () => {
  render(card("6:24 AM"));

  const heading = screen.getByRole("heading", { name: "Lowest tide today" });
  expect(heading.id).toBe("test-heading");
});

test("the region is named by the reading and the beach together", () => {
  render(card("6:24 AM"));

  const region = screen.getByRole("region", {
    name: "Lowest tide today · La Jolla Shores Beach",
  });
  expect(region).toBeDefined();
});

/**
 * The glyph sets the subject at a glance and carries nothing a reader who
 * cannot see it would lose — the heading beside it says the same thing in
 * words. This is the pattern `ProgramCards` already follows.
 */
test("the emoji is hidden from assistive technology", () => {
  const { container } = render(card("6:24 AM"));

  const glyph = container.querySelector('[aria-hidden="true"]');
  expect(glyph?.textContent).toBe("🐚");
});

test("the leading figure is rendered when there is one", () => {
  render(card("6:24 AM"));

  expect(screen.getByText("6:24 AM")).toBeDefined();
});

/**
 * The state this exists for. `WindToday` refuses to render an empty primary
 * because "an empty one reads as a fault", and the same is true of a card that
 * keeps the slot and puts nothing in it — a blank where a number goes is read
 * as a broken reading rather than as an absent one.
 */
test("a card with no figure has no empty slot where one would go", () => {
  const { container } = render(card(null));

  expect(container.querySelector(".text-stat")).toBeNull();
});

test("a card given no figure at all behaves the same as one given null", () => {
  const { container } = render(
    <ReadingCard emoji="🌊" headingLevel="h3" headingId="h" title="Waves">
      <p>body</p>
    </ReadingCard>,
  );

  expect(container.querySelector(".text-stat")).toBeNull();
});

test("whatever the reading has to say is rendered beneath", () => {
  render(card("6:24 AM"));

  expect(screen.getByText("the body of the reading")).toBeDefined();
});

/**
 * The figure is the site's `--text-stat`, not a raw Tailwind size. The three
 * panels each reached for `text-4xl` — the same 36px under a different name,
 * which is one of the two names waiting to drift from the other.
 */
test("the figure uses the design system's stat size", () => {
  const { container } = render(card("6:24 AM"));

  const figure = container.querySelector(".text-stat");
  expect(figure?.textContent).toBe("6:24 AM");
});

/**
 * Three cards sit in a row and every one of them is about the same beach, so
 * printing it three times is a constant repeated as noise — the page header and
 * the chooser already say which beach this is. But a landmark named only "Air"
 * strands someone navigating by region, who never read the header. So the beach
 * stays in the accessible name and leaves the layout.
 */
test("the beach reaches the accessible name without being printed three times", () => {
  render(card("6:24 AM"));

  const region = screen.getByRole("region", {
    name: "Lowest tide today · La Jolla Shores Beach",
  });
  expect(region).toBeDefined();

  // Named once, printed nowhere: the beach is absent from the visible text.
  expect(region.textContent).not.toContain("La Jolla Shores Beach");
});

test("a card given no context is named by its title alone", () => {
  const { container } = render(
    <ReadingCard emoji="🌊" headingLevel="h3" headingId="h" title="Waves">
      <p>body</p>
    </ReadingCard>,
  );

  expect(screen.getByRole("region", { name: "Waves" })).toBeDefined();
  expect(container.firstElementChild?.getAttribute("aria-label")).toBe("Waves");
});

/**
 * Three cards of unequal content in one row otherwise leave two ragged
 * surfaces beside the tallest, which reads as three components rather than
 * one band.
 */
test("a card fills the height of the row it sits in", () => {
  const { container } = render(card("6:24 AM"));

  expect(container.firstElementChild?.className).toContain("h-full");
});

/**
 * ADR-0015. The glyph was inline in the heading at 10px, where a full-colour
 * emoji carries nothing; it now stands at 30px on the lead figure's row. Beside the
 * figure rather than above the heading is the whole of why it can be large
 * again: the row already exists and is 36px tall, and a 30px glyph fits inside
 * it, so the size costs nothing at all where the old block above the heading
 * cost 46px.
 */
test("the glyph sits on the figure's row, not as text inside the heading", () => {
  const { container } = render(card("6:24 AM"));

  const heading = screen.getByRole("heading", { name: "Lowest tide today" });
  expect(heading.textContent).not.toContain("🐚");

  const glyph = container.querySelector('[aria-hidden="true"]');
  expect(glyph?.textContent).toBe("🐚");
  expect(glyph?.className).toContain("text-3xl");

  // Same row as the figure, which is what makes the size affordable.
  const figure = container.querySelector(".text-stat");
  expect(glyph?.parentElement).toBe(figure?.parentElement);
});

/**
 * The heading is the accessible name and the glyph is hidden, so moving the
 * glyph out must not change what a screen reader hears. Asserted separately
 * from the layout above: these two can break independently.
 */
test("moving the glyph out leaves the accessible name the words alone", () => {
  render(card("6:24 AM"));

  expect(
    screen.getByRole("heading", { name: "Lowest tide today" }),
  ).toBeDefined();
  expect(
    screen.getByRole("region", {
      name: "Lowest tide today · La Jolla Shores Beach",
    }),
  ).toBeDefined();
});

/**
 * A tide card with no station and a wave card with no buoy both pass
 * `figure={null}`, and those are exactly the states a reader is most likely to
 * be confused by. A card that drops its subject mark when the station goes
 * quiet reads as more broken than it is, so the glyph stays and the row holds
 * it alone.
 */
test("a card with no figure keeps its glyph", () => {
  const { container } = render(card(null));

  const glyph = container.querySelector('[aria-hidden="true"]');
  expect(glyph?.textContent).toBe("🐚");
  expect(glyph?.className).toContain("text-3xl");
  // Still no empty figure slot beside it — that is a separate contract.
  expect(container.querySelector(".text-stat")).toBeNull();
});

/**
 * The raw arbitrary size the old block carried, in a component whose docstring
 * makes the case against exactly that. `text-3xl` is the scale ReservedSlot
 * already uses for a glyph, not a bracket value invented here.
 */
test("the card sets no arbitrary glyph size of its own", () => {
  const { container } = render(card("6:24 AM"));

  expect(container.innerHTML).not.toContain("text-[34px]");
});
