// Compares two folders of shots pixel by pixel and writes the differences.
//
//   npm run compare -- baseline current [--threshold 0.5]
//
// Exits non-zero when a screen differs by more than the threshold, in
// percent of its pixels. Pages with moving parts (the home slideshow, Live
// TV times) always differ a little; read their diff images rather than the
// number.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { testDir } from "./lib/jellyfin.mjs";

const { values: args, positionals } = parseArgs({
    allowPositionals: true,
    options: { threshold: { type: "string", default: "0.5" } },
});
if (positionals.length !== 2) {
    console.error("usage: npm run compare -- <before> <after> [--threshold percent]");
    process.exit(2);
}

const [before, after] = positionals.map((name) => join(testDir, "shots", name));
const diffDir = join(testDir, "shots", `diff-${positionals[0]}-${positionals[1]}`);
await mkdir(diffDir, { recursive: true });

const names = (await readdir(before)).filter((f) => f.endsWith(".png"));
const rows = [];
for (const name of names) {
    let a;
    let b;
    try {
        a = PNG.sync.read(await readFile(join(before, name)));
        b = PNG.sync.read(await readFile(join(after, name)));
    } catch {
        rows.push({ name, percent: Infinity, note: "missing" });
        continue;
    }
    if (a.width !== b.width || a.height !== b.height) {
        rows.push({ name, percent: Infinity, note: "size differs" });
        continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const percent = (100 * changed) / (a.width * a.height);
    if (changed) await writeFile(join(diffDir, name), PNG.sync.write(diff));
    rows.push({ name, percent });
}

const limit = Number(args.threshold);
rows.sort((x, y) => y.percent - x.percent);
for (const { name, percent, note } of rows) {
    const flag = percent > limit ? "DIFF" : "same";
    console.log(`${flag}  ${(note ?? `${percent.toFixed(2)}%`).padStart(12)}  ${name}`);
}
console.log(`\nDiff images in ${diffDir}`);
process.exitCode = rows.some((r) => r.percent > limit) ? 1 : 0;
