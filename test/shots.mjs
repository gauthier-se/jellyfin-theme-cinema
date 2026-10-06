// Captures every screen in test/screens.mjs on the test server, with the
// freshly built theme (or another CSS file) pushed into its branding.
//
//   npm run shots                      all screens into test/shots/current
//   npm run shots -- --out baseline    another folder under test/shots
//   npm run shots -- --only movie      screens whose name matches a regex
//   npm run shots -- --css old.css     compare against an older build
//   npm run readme-shots               refresh docs/screenshots (JPEG)

import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { build } from "../scripts/build.mjs";
import { client, loadCredentials, pushCss, readBundle, testDir } from "./lib/jellyfin.mjs";
import { resolveIds, screens } from "./screens.mjs";

const { values: args } = parseArgs({
    options: {
        out: { type: "string", default: "current" },
        only: { type: "string", default: "." },
        css: { type: "string" },
        dest: { type: "string" },
        format: { type: "string", default: "png" },
    },
});

const VIEWPORTS = {
    desktop: { viewport: { width: 1440, height: 900 } },
    mobile: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " +
            "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
};

const credentials = await loadCredentials();
const api = client(credentials.url, credentials.token);
const ids = await resolveIds(api, credentials.userId);

if (args.css) {
    await pushCss(credentials.url, api, await readFile(args.css, "utf8"));
} else {
    await build();
    await pushCss(credentials.url, api, await readBundle());
}

const outDir = args.dest ? join(testDir, "..", args.dest) : join(testDir, "shots", args.out);
const extension = args.format === "jpeg" ? "jpg" : "png";
await mkdir(outDir, { recursive: true });
const only = new RegExp(args.only);
const browser = await chromium.launch();

async function signIn(page) {
    await page.goto("/web/#/login");
    await page.locator("#txtManualName").fill(credentials.username);
    await page.locator("#txtManualPassword").fill(credentials.password);
    await page.locator("#txtManualPassword").press("Enter");
    await page.waitForURL(/#\/home/);
}

let failures = 0;
for (const [viewport, options] of Object.entries(VIEWPORTS)) {
    for (const anonymous of [false, true]) {
        const todo = screens.filter(
            (s) => s.viewport === viewport && !!s.anonymous === anonymous && only.test(s.name),
        );
        if (!todo.length) continue;

        const context = await browser.newContext({ ...options, baseURL: credentials.url });
        const page = await context.newPage();
        if (!anonymous) await signIn(page);

        for (const screen of todo) {
            try {
                // A menu left open by the previous screen would catch clicks.
                await page.keyboard.press("Escape");
                await screen.visit(page, ids);
                await page.screenshot({
                    path: join(outDir, `${screen.name}.${extension}`),
                    type: args.format,
                    quality: args.format === "jpeg" ? 85 : undefined,
                    animations: "disabled",
                });
                console.log(`ok    ${screen.name}`);
            } catch (error) {
                failures++;
                // DEBUG=1 shows Playwright's call log, not just its first line.
                const lines = error.message.split("\n").slice(0, process.env.DEBUG ? 20 : 1);
                console.log(`FAIL  ${screen.name}: ${lines.join("\n")}`);
            }
        }
        await context.close();
    }
}

await browser.close();
console.log(`\nShots in ${outDir}`);
process.exitCode = failures ? 1 : 0;
