# 0001 — Vitest as the test runner

Date: 2026-08-11. Status: accepted.

## Context

The repo has no test runner. CLAUDE.md requires every behavior-changing slice to
ship with a test, and requires a coverage floor, so a runner is a prerequisite
for the gate command rather than a later nicety.

The app is Next.js 16 with the App Router, TypeScript, and ESM config files
throughout. The bundled Next.js docs at `node_modules/next/dist/docs/` document
two supported runners, Jest and Vitest, and both testing guides carry the same
warning: neither can test `async` Server Components, and E2E is recommended for
those.

## Decision

Vitest, with React Testing Library and jsdom. Dependencies as listed in the
bundled guide `01-app/02-guides/testing/vitest.md`: `vitest`,
`@vitejs/plugin-react`, `jsdom`, `@testing-library/react`,
`@testing-library/dom`, `vite-tsconfig-paths`. Path aliases resolve through
`vite-tsconfig-paths` so `@/*` means the same thing in tests as in the app —
one definition, in `tsconfig.json`.

## Consequences

Tests run fast and need no separate transform config, since Vitest handles the
project's TypeScript and JSX directly.

`async` Server Components cannot be unit-tested. This is inherited from the
choice of runner *and* would have been inherited from Jest, so it is a property
of the ecosystem rather than of this decision. It becomes load-bearing the first
time an `async` page or layout is added: that code will be outside the gate's
reach, and closing the gap means adding Playwright. This is recorded so the gap
is a known, dated limitation rather than a surprise.

Vitest config lives in `vitest.config.mts`, separate from `next.config.ts`. Two
build-ish configs coexist; they do not interact, but someone will eventually
wonder why there are two.

The `@/*` alias resolving via `vite-tsconfig-paths` means a change to
`tsconfig.json` paths silently changes test resolution too. That is the intent —
one source of truth — but it is a coupling worth knowing about.
