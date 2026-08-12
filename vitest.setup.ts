import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Explicit because Vitest runs without globals here; without it, renders leak
// into the next test and queries start matching the previous test's DOM.
afterEach(cleanup);
