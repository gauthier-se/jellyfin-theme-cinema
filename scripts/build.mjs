// Builds dist/ from src/: inlines @import, flattens nesting and adds vendor
// prefixes for the browsers in package.json, then writes a readable and a
// minified copy of each entry, each with a version banner.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import browserslist from "browserslist";
import { browserslistToTargets, bundle } from "lightningcss";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const targets = browserslistToTargets(browserslist(pkg.browserslist));

/** Entry files, relative to src/; each lands at the same path under dist/. */
export const entries = [
    "cinema.css",
    "addons/media-bar.css",
    "addons/jellyfin-enhanced.css",
    "addons/cinematheque.css",
];

const banner = (entry) =>
    `/*! Cinema ${entry === "cinema.css" ? "" : `(${basename(entry, ".css")} add-on) `}` +
    `v${pkg.version} for Jellyfin 12.1 | MIT | github.com/gauthier-se/jellyfin-theme-cinema */\n`;

function compile(entry, minify) {
    const { code, warnings } = bundle({
        filename: join(root, "src", entry),
        targets,
        minify,
        errorRecovery: false,
    });
    for (const w of warnings) {
        console.warn(`warning: ${relative(root, w.loc.filename)}:${w.loc.line}: ${w.message}`);
    }
    return banner(entry) + code.toString().trim() + "\n";
}

export async function build() {
    await rm(join(root, "dist"), { recursive: true, force: true });
    const outputs = {};
    for (const entry of entries) {
        const out = join(root, "dist", entry);
        await mkdir(dirname(out), { recursive: true });
        outputs[entry] = compile(entry, false);
        await writeFile(out, outputs[entry]);
        await writeFile(out.replace(/\.css$/, ".min.css"), compile(entry, true));
    }
    return outputs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const outputs = await build();
    for (const [entry, css] of Object.entries(outputs)) {
        console.log(`dist/${entry.padEnd(30)} ${(css.length / 1024).toFixed(1)} KiB`);
    }
}
