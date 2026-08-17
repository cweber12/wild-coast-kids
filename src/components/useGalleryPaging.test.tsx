import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useGalleryPaging } from "./useGalleryPaging";

/** The smallest thing that uses the hook the way the gallery does. */
function Harness({ attach = true }: { attach?: boolean }) {
  const { rowRef, page } = useGalleryPaging();

  return (
    <>
      {attach && <div ref={rowRef} data-testid="row" />}
      <button type="button" onClick={() => page(-1)}>
        back
      </button>
      <button type="button" onClick={() => page(1)}>
        forward
      </button>
    </>
  );
}

function renderHarness() {
  render(<Harness />);

  const row = screen.getByTestId("row");

  // jsdom has no layout, so the row cannot really scroll and measures zero.
  // Stubbing both is what lets the assertion be about the distance asked for
  // rather than about jsdom.
  const scrollBy = vi.fn();
  row.scrollBy = scrollBy;
  Object.defineProperty(row, "clientWidth", { value: 900, configurable: true });

  return { scrollBy };
}

test("next pages forward by a screenful", () => {
  const { scrollBy } = renderHarness();

  fireEvent.click(screen.getByRole("button", { name: "forward" }));

  // A screenful, not one item: how many items that is changes with the
  // width, and snap-mandatory pulls the result back onto an item edge, so
  // the control never has to know the count.
  expect(scrollBy).toHaveBeenCalledWith({ left: 900 });
});

test("previous pages back by a screenful", () => {
  const { scrollBy } = renderHarness();

  fireEvent.click(screen.getByRole("button", { name: "back" }));

  expect(scrollBy).toHaveBeenCalledWith({ left: -900 });
});

test("paging a row that is not mounted does nothing rather than throwing", () => {
  render(<Harness attach={false} />);

  // The controls render before the row in the DOM now, so an unattached ref
  // is reachable in a way it was not when they were siblings of the scroller.
  expect(() =>
    fireEvent.click(screen.getByRole("button", { name: "forward" })),
  ).not.toThrow();
});
