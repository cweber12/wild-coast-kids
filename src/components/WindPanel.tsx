/**
 * The seam between the network and the wind-and-visibility markup, kept as thin
 * as the two panels beside it: read, render.
 */

import { readLatestAir } from "@/lib/conditions";
import { WindToday } from "./WindToday";

export async function WindPanel({ slug }: { slug: string }) {
  const view = await readLatestAir(slug);
  return <WindToday {...view} />;
}
