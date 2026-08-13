import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommunityForm } from "./CommunityForm";

test("every input has an associated label", () => {
  render(<CommunityForm />);

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
  render(<CommunityForm />);

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

test("the section teases the full community page", () => {
  render(<CommunityForm />);

  expect(
    screen
      .getByRole("link", { name: /meet the community/i })
      .getAttribute("href"),
  ).toBe("/community");
});
