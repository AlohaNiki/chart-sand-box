/**
 * Patches lightweight-charts production bundle with custom label styles.
 * Run via `npm run postinstall` or manually: `node scripts/patch-lw-charts.mjs`
 *
 * Changes:
 *   - Series label padding: top/bottom 2px, left/right 5px (was 3px / 9px)
 *   - Series label font: 10px Medium 500 (was layout.fontSize regular)
 */

import { readFileSync, writeFileSync } from "fs";

const FILE = "node_modules/lightweight-charts/dist/lightweight-charts.production.mjs";

let src = readFileSync(FILE, "utf8");
let changed = 0;

function patch(description, from, to) {
  if (!src.includes(from)) {
    // Already patched or bundle changed
    if (src.includes(to)) {
      console.log(`  ✓ already applied: ${description}`);
    } else {
      console.warn(`  ✗ pattern not found: ${description}`);
    }
    return;
  }
  src = src.replace(from, to);
  changed++;
  console.log(`  ✓ patched: ${description}`);
}

console.log("Patching lightweight-charts...");

patch(
  "series label padding (top/bottom 2px, horizontal 5px)",
  "t.A=3*s/12,t.I=3*s/12,t.ts=9*s/12",
  "t.A=2,t.I=2,t.ts=5"
);

patch(
  "series label font (10px Medium 500)",
  '.fontSize}_m(){return x(this.F(),this.Ps.fontFamily)}',
  '.fontSize}_m(){return x(10,this.Ps.fontFamily,"500")}'
);

if (changed > 0) {
  writeFileSync(FILE, src);
  console.log(`Done — ${changed} patch(es) applied.`);
} else {
  console.log("Done — nothing to change.");
}
