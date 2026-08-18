/**
 * The seam between the network and the markup, and deliberately the thinnest
 * thing in this slice: read, render.
 *
 * Everything with a judgement in it sits on one side or the other, where it can
 * be tested without a network -- which day counts as today is `lib/tide-day.ts`,
 * composing the reading is `lib/conditions.ts`, and the wording is `TideToday`.
 * What is left here is the one line that cannot be tested offline, so there is
 * almost nothing of it.
 */

import { readTodaysLowestLow } from "@/lib/conditions";
import { TideToday } from "./TideToday";

export async function TidePanel({ slug }: { slug: string }) {
  const view = await readTodaysLowestLow(slug);
  return <TideToday {...view} />;
}
