#!/usr/bin/env node
/**
 * `npm run check:db` — asserts that public.sessions is what
 * supabase/migrations/0001_sessions.sql says it is.
 *
 * Entry-point plumbing only: load config, print, exit. Both the talking and the
 * verdict live in db-check.mjs, where they are unit-tested against a stub fetch
 * (ADR-0002, same split as run-gates.mjs and check-built-css.mjs).
 *
 * Not a gate row: gates.mjs treats `skip` as unconditional, so a row needing
 * credentials could never run even locally — issue #75. Until that changes this
 * is a command you run, and whose output belongs in the PR body.
 *
 * It writes probe rows and deletes them again. See `gatherObservations`.
 */
import { existsSync } from "node:fs";
import { gatherObservations, judge } from "./db-check.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.SUPABASE_URL;

const { ok, lines } = judge(
  await gatherObservations({
    fetch,
    url,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
);

console.log(`\n  public.sessions — ${url ?? "no project URL configured"}\n`);
console.log(lines.join("\n"));
console.log("");

process.exit(ok ? 0 : 1);
