/**
 * The verdict behind the `areas` gate row: is `areas.json` still a partition
 * of the inventory?
 *
 * `areas.json` is the one table in this repo a person writes by hand about the
 * beaches — an area name is a fact about San Diego, and nothing upstream
 * publishes one. `beaches.json` beside it is rewritten from the state's
 * resource by `seed-beaches.mjs`. So the two drift for a reason no reviewer
 * would see: a beach arrives upstream, the seed picks it up, and it belongs to
 * no area. Nothing throws. It is simply missing from the chooser.
 *
 * **That is the failure this file exists to make loud**, and it is the same
 * argument `_excluded` and every `*_null_reason` field in the inventory already
 * make: a refusal is recorded, never silent.
 *
 * Pure — it is handed two parsed tables and returns a verdict. The reading and
 * the exit code are `check-areas.mjs`'s, which is ADR-0002's split and the one
 * `sea-side.mjs` and `adr-numbers.mjs` already use.
 */

/**
 * @typedef {{ slug: string, name: string, beaches: string[] }} Area
 * @typedef {{ slug: string, name: string }} InventoryBeach
 */

/**
 * Check that the areas partition the inventory, totally and disjointly.
 *
 * Six properties, and each is a way the two files can disagree:
 *
 * 1. **Every beach has an area.** The one that catches a new beach upstream.
 * 2. **No beach has two.** A copy-paste between two areas.
 * 3. **Every named slug is real.** A rename upstream, or a typo here.
 * 4. **No area is empty.** An area whose last member moved out.
 * 5. **Area slugs are unique.** Two areas that would share a URL.
 * 6. **Both orders run north to south**, matching the inventory's own order.
 *    Checked rather than trusted, because the chooser reads this order
 *    straight through and nothing about a hand-written list keeps it sorted.
 *
 * @param {{ areas: Area[], beaches: InventoryBeach[] }} tables
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function checkAreaPartition({ areas, beaches }) {
  /** @type {string[]} */
  const problems = [];

  const inventoryOrder = new Map(beaches.map((beach, i) => [beach.slug, i]));

  const seenAreaSlugs = new Set();
  for (const area of areas) {
    if (seenAreaSlugs.has(area.slug)) {
      problems.push(`area slug ${JSON.stringify(area.slug)} is used twice`);
    }
    seenAreaSlugs.add(area.slug);

    if (area.beaches.length === 0) {
      problems.push(
        `area ${JSON.stringify(area.slug)} has no beaches; delete it or give it one`,
      );
    }
  }

  /** Which area claimed each beach, so a double claim can name both. @type {Map<string, string[]>} */
  const claims = new Map();
  for (const area of areas) {
    for (const slug of area.beaches) {
      if (!inventoryOrder.has(slug)) {
        problems.push(
          `area ${JSON.stringify(area.slug)} names ${JSON.stringify(slug)}, ` +
            `which is not in beaches.json`,
        );
        continue;
      }
      const existing = claims.get(slug);
      if (existing) existing.push(area.slug);
      else claims.set(slug, [area.slug]);
    }
  }

  for (const [slug, claimedBy] of claims) {
    if (claimedBy.length > 1) {
      problems.push(
        `${JSON.stringify(slug)} is claimed by ${claimedBy.length} areas: ` +
          claimedBy.map((a) => JSON.stringify(a)).join(", "),
      );
    }
  }

  for (const beach of beaches) {
    if (!claims.has(beach.slug)) {
      problems.push(
        `${JSON.stringify(beach.slug)} (${beach.name}) belongs to no area. ` +
          `If it arrived from upstream, name its area in areas.json — it is ` +
          `unreachable from the chooser until you do`,
      );
    }
  }

  // Order, checked last: it is the least serious of the six and its message is
  // the least useful when the ones above are already firing.
  for (const area of areas) {
    const indices = area.beaches
      .map((slug) => inventoryOrder.get(slug))
      .filter((i) => i !== undefined);
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] < indices[i - 1]) {
        problems.push(
          `area ${JSON.stringify(area.slug)} lists ${JSON.stringify(area.beaches[i])} ` +
            `after ${JSON.stringify(area.beaches[i - 1])}, but the inventory has it before. ` +
            `Members run north to south`,
        );
        break;
      }
    }
  }

  const firstIndices = areas.map((area) =>
    Math.min(
      ...area.beaches
        .map((slug) => inventoryOrder.get(slug))
        .filter((i) => i !== undefined),
    ),
  );
  for (let i = 1; i < firstIndices.length; i++) {
    if (
      Number.isFinite(firstIndices[i]) &&
      Number.isFinite(firstIndices[i - 1]) &&
      firstIndices[i] < firstIndices[i - 1]
    ) {
      problems.push(
        `area ${JSON.stringify(areas[i].slug)} is listed after ` +
          `${JSON.stringify(areas[i - 1].slug)}, but its northernmost beach is further ` +
          `north. Areas run north to south`,
      );
      break;
    }
  }

  if (problems.length > 0) {
    return {
      ok: false,
      lines: [
        `areas.json is not a partition of beaches.json (${problems.length} problem${
          problems.length === 1 ? "" : "s"
        }):`,
        ...problems.map((problem) => `  - ${problem}`),
      ],
    };
  }

  return {
    ok: true,
    lines: [
      `areas.json partitions the inventory: ${beaches.length} beaches in ` +
        `${areas.length} areas, total and disjoint, north to south.`,
    ],
  };
}
