/**
 * The seam between the network and the wave markup, kept as thin as the tide
 * panel: read, render.
 */

import { readLatestWaves } from "@/lib/conditions";
import { WavesToday } from "./WavesToday";

export async function WavePanel({ slug }: { slug: string }) {
  const view = await readLatestWaves(slug);
  return <WavesToday {...view} />;
}
