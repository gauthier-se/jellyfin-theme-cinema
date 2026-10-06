// Shared helpers for the test tools: paths, credentials, a small API client
// and a guard that keeps them away from any server but a local one.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { entries } from "../../scripts/build.mjs";

export const testDir = join(dirname(fileURLToPath(import.meta.url)), "..");
export const rootDir = join(testDir, "..");
export const dataDir = join(testDir, ".data");
export const composeFile = join(testDir, "compose.yaml");
export const credentialsPath = join(dataDir, "credentials.json");

export const CLIENT_HEADER =
    'MediaBrowser Client="cinema-test", Device="cli", DeviceId="cinema-test", Version="1.0"';

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** Throws unless the URL points at this machine. */
export function assertLocal(url) {
    if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
        throw new Error(`Refusing to write to ${url}: the test tools only change a local server.`);
    }
}

export async function loadCredentials() {
    try {
        return JSON.parse(await readFile(credentialsPath, "utf8"));
    } catch {
        throw new Error(
            "No test server credentials. Run `npm run server:up` then `npm run server:seed`.",
        );
    }
}

/** A fetch wrapper for the Jellyfin API, authenticated with `token` when given. */
export function client(url, token) {
    return async function api(path, { method = "GET", body } = {}) {
        const headers = {
            Authorization: token ? `MediaBrowser Token="${token}"` : CLIENT_HEADER,
        };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const res = await fetch(url + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    };
}

/** Replaces the server's Custom CSS (Dashboard > Branding). */
export async function pushCss(url, api, css) {
    assertLocal(url);
    await api("/System/Configuration/branding", {
        method: "POST",
        body: { LoginDisclaimer: "", CustomCss: css, SplashscreenEnabled: false },
    });
}

/** The core theme followed by every add-on, as the test server runs them all. */
export async function readBundle() {
    const parts = await Promise.all(
        entries.map((entry) => readFile(join(rootDir, "dist", entry), "utf8")),
    );
    return parts.join("\n");
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
