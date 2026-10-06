// Rebuilds on every change under src/ and pushes the result into the test
// server's branding. Reload the browser to see it.

import { watch } from "node:fs";
import { join } from "node:path";
import { build } from "./build.mjs";
import { client, loadCredentials, pushCss, readBundle, rootDir } from "../test/lib/jellyfin.mjs";

const credentials = await loadCredentials();
const api = client(credentials.url, credentials.token);

async function update() {
    try {
        await build();
        await pushCss(credentials.url, api, await readBundle());
        console.log(`${new Date().toLocaleTimeString()}  pushed to ${credentials.url}`);
    } catch (error) {
        console.error(`${new Date().toLocaleTimeString()}  ${error.message}`);
    }
}

let timer;
watch(join(rootDir, "src"), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(update, 150);
});
await update();
console.log("Watching src/ (Ctrl+C to stop)");
