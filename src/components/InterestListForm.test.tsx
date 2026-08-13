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
  fireEvent.click(screen.getByRole("button", { name: /join the community/i }));

  // The success state must actually replace the form, not merely render:
  // the status is announced and the submit button is gone.
  expect(screen.getByRole("status").textContent).toContain("You're in!");
  expect(screen.queryByRole("button", { name: /join the community/i })).toBe(
    null,
  );
});

test("the form carries no link to the community page", () => {
  render(<InterestListForm />);

  // That link belongs to the landing teaser. Keeping it out of this module
  // is what lets /community render the form without pointing at itself.
  expect(screen.queryByRole("link")).toBe(null);
});
