import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InterestListForm } from "./InterestListForm";

test("every input has an associated label", () => {
  render(<InterestListForm />);

  expect(screen.getByLabelText("Your name")).toBeDefined();
  expect(screen.getByLabelText("Email")).toBeDefined();
  expect(screen.getByLabelText("Kids' ages")).toBeDefined();
  for (const name of ["Art Classes", "Tidepools", "Hikes", "Science"]) {
    expect(
      screen.getByRole("checkbox", { name: new RegExp(name) }),
    ).toBeDefined();
  }
});

test("submitting swaps the form for the success state", () => {
  render(<InterestListForm />);

  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Robin Parent" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "robin@example.com" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /tidepools/i }));
  fireEvent.click(
    screen.getByRole("button", { name: /join the interest list/i }),
  );

  // The success state must actually replace the form, not merely render:
  // the status is announced and the submit button is gone.
  expect(screen.getByRole("status").textContent).toContain("You're in!");
  expect(
    screen.queryByRole("button", { name: /join the interest list/i }),
  ).toBe(null);
});

test("the form carries no link to the community page", () => {
  render(<InterestListForm />);

  // That link belongs to the landing teaser. Keeping it out of this module
  // is what lets /community render the form without pointing at itself.
  expect(screen.queryByRole("link")).toBe(null);
});

test("the success swap does not change the card's height", () => {
  const { container } = render(<InterestListForm />);
  const card = container.firstElementChild as HTMLElement;

  // jsdom applies no stylesheets, so the seam is the arithmetic the class
  // names encode: Tailwind's spacing scale is n x 4px, and box-sizing is
  // border-box, so the card's min-height has to be the success state's plus
  // the card's own padding. They used to be 560 and 552 — the card sized to
  // the success state rather than to the form, costing the interest-list stop
  // 57px it did not have to spend (issue #37).
  const scale = (className: string, prefix: string) => {
    const found = new RegExp("(?:^| )" + prefix + "-(\\d+)(?: |$)").exec(
      className,
    );
    if (!found) throw new Error(`no ${prefix}- utility in "${className}"`);
    return Number(found[1]) * 4;
  };

  const cardMinHeight = scale(card.className, "min-h");
  const cardPadding = scale(card.className, "p") * 2;

  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Robin Parent" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "robin@example.com" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /join the interest list/i }),
  );

  expect(
    scale(screen.getByRole("status").className, "min-h") + cardPadding,
  ).toBe(cardMinHeight);
});
