import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

test("the footer is a contentinfo landmark carrying the wordmark", () => {
  render(<Footer />);

  const footer = screen.getByRole("contentinfo");
  expect(footer.textContent).toContain("Wild Coast Kids");
  expect(footer.textContent).toContain("K–8");
});

// The footer sits in layout.tsx, so no page test reaches it — this is the only
// guard on the site-wide line. It said "Charter Eligible · K–8" until the claim
// was withdrawn (#104, docs/plans/charter-claim-withdrawn.md); it comes back
// with the copy that explains it, not before.
test("the footer makes no funding claim", () => {
  render(<Footer />);

  expect(screen.getByRole("contentinfo").textContent).not.toMatch(
    /charter|fund/i,
  );
});
