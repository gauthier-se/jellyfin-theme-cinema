// Fills the throwaway test server (test/compose.yaml) with everything the
// theme styles: films, series, music, Live TV with a guide, a collection, a
// playlist, resume points, favourites and the plugins it has add-ons for.
// Safe to run again: each step skips what is already there.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
    assertLocal,
    client,
    composeFile,
    credentialsPath,
    dataDir,
    sleep,
    testDir,
} from "./lib/jellyfin.mjs";

const url = `http://127.0.0.1:${process.env.CINEMA_TEST_PORT ?? 8096}`;
const fixtures = JSON.parse(await readFile(join(testDir, "fixtures.json"), "utf8"));
const mediaDir = join(dataDir, "media");
const FFMPEG = "/usr/lib/jellyfin-ffmpeg/ffmpeg";

assertLocal(url);

const docker = (...args) =>
    execFileSync("docker", ["compose", "-f", composeFile, ...args], { stdio: "inherit" });
const ffmpeg = (...args) =>
    docker("exec", "-T", "jellyfin", FFMPEG, "-loglevel", "error", "-y", ...args);
const step = (title) => console.log(`\n== ${title}`);

/** Waits until the API answers three times in a row: right after a restart,
    /health can answer before the server is ready for requests. */
async function waitForServer() {
    let streak = 0;
    for (let i = 0; i < 180 && streak < 3; i++) {
        try {
            const res = await fetch(`${url}/System/Info/Public`);
            streak = res.ok ? streak + 1 : 0;
        } catch {
            streak = 0;
        }
        await sleep(1000);
    }
    if (streak < 3) throw new Error(`${url} did not come up. Is \`npm run server:up\` running?`);
}

/** Test-pattern media: one sample file copied under every title. */
async function createMedia() {
    step("Media files");
    await mkdir(mediaDir, { recursive: true });
    const sample = join(mediaDir, ".sample.mkv");
    if (!existsSync(sample)) {
        // Two audio tracks, so the language tags of Jellyfin Enhanced show.
        ffmpeg(
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=640x360:rate=24",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=550",
            "-t",
            "20",
            "-map",
            "0",
            "-map",
            "1",
            "-map",
            "2",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            "-metadata:s:a:0",
            "language=eng",
            "-metadata:s:a:1",
            "language=fre",
            "-shortest",
            "/media/.sample.mkv",
        );
    }

    for (const movie of fixtures.movies) {
        const dir = join(mediaDir, "movies", movie);
        await mkdir(dir, { recursive: true });
        await copyFile(sample, join(dir, `${movie}.mkv`));
    }

    for (const show of fixtures.shows) {
        const name = show.replace(/ \(\d{4}\)$/, "");
        const dir = join(mediaDir, "shows", show, "Season 01");
        await mkdir(dir, { recursive: true });
        for (let e = 1; e <= fixtures.episodesPerShow; e++) {
            const episode = String(e).padStart(2, "0");
            await copyFile(sample, join(dir, `${name} S01E${episode}.mkv`));
        }
    }

    for (const { artist, album, tracks } of fixtures.music) {
        await mkdir(join(mediaDir, "music", artist, album), { recursive: true });
        for (const [i, title] of tracks.entries()) {
            const file = join("music", artist, album, `${title}.mp3`);
            if (existsSync(join(mediaDir, file))) continue;
            ffmpeg(
                "-f",
                "lavfi",
                "-i",
                `sine=frequency=${330 + i * 110}`,
                "-t",
                "15",
                "-metadata",
                `artist=${artist}`,
                "-metadata",
                `album_artist=${artist}`,
                "-metadata",
                `album=${album}`,
                "-metadata",
                `title=${title}`,
                "-metadata",
                `track=${i + 1}`,
                "-c:a",
                "libmp3lame",
                `/media/${file}`,
            );
        }
    }

    await writeLiveTv();
}

/** An M3U tuner whose streams go nowhere, and a guide around the current hour. */
async function writeLiveTv() {
    const dir = join(mediaDir, "tv");
    await mkdir(dir, { recursive: true });
    const ids = fixtures.channels.map((_, i) => `ch${i + 1}`);

    const m3u = fixtures.channels.map(
        (name, i) =>
            `#EXTINF:-1 tvg-id="${ids[i]}" tvg-chno="${i + 1}",${name}\nhttp://127.0.0.1:9/${ids[i]}.ts`,
    );
    await writeFile(join(dir, "channels.m3u"), `#EXTM3U\n${m3u.join("\n")}\n`);

    const stamp = (d) => `${d.toISOString().replace(/[-:T]/g, "").slice(0, 14)} +0000`;
    const start = new Date();
    start.setUTCMinutes(0, 0, 0);
    start.setUTCHours(start.getUTCHours() - 1);

    const channels = fixtures.channels.map(
        (name, i) => `  <channel id="${ids[i]}"><display-name>${name}</display-name></channel>`,
    );
    const programmes = ids.flatMap((id, c) =>
        Array.from({ length: 12 }, (_, h) => {
            const from = new Date(start.getTime() + h * 3_600_000);
            const to = new Date(from.getTime() + 3_600_000);
            const title = fixtures.programmes[(h + c * 2) % fixtures.programmes.length];
            return (
                `  <programme start="${stamp(from)}" stop="${stamp(to)}" channel="${id}">` +
                `<title>${title}</title><desc>Test programme.</desc></programme>`
            );
        }),
    );
    await writeFile(
        join(dir, "guide.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n${[...channels, ...programmes].join("\n")}\n</tv>\n`,
    );
}

/** Runs the startup wizard once, then signs in. Returns an authenticated client. */
async function signIn() {
    step("Startup wizard and user");
    const anonymous = client(url);
    const info = await anonymous("/System/Info/Public");
    let credentials;

    if (!info.StartupWizardCompleted) {
        credentials = { url, username: "cinema", password: randomBytes(12).toString("hex") };
        await anonymous("/Startup/Configuration", {
            method: "POST",
            body: {
                UICulture: "en-US",
                MetadataCountryCode: "US",
                PreferredMetadataLanguage: "en",
            },
        });
        await anonymous("/Startup/User");
        await anonymous("/Startup/User", {
            method: "POST",
            body: { Name: credentials.username, Password: credentials.password },
        });
        await anonymous("/Startup/RemoteAccess", {
            method: "POST",
            body: { EnableRemoteAccess: true, EnableAutomaticPortMapping: false },
        });
        await anonymous("/Startup/Complete", { method: "POST" });
    } else {
        credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
    }

    const auth = await anonymous("/Users/AuthenticateByName", {
        method: "POST",
        body: { Username: credentials.username, Pw: credentials.password },
    });
    credentials.token = auth.AccessToken;
    credentials.userId = auth.User.Id;
    await writeFile(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
    return client(url, credentials.token);
}

async function addLibraries(api) {
    step("Libraries and Live TV");
    const existing = new Set((await api("/Library/VirtualFolders")).map((f) => f.Name));
    const libraries = [
        ["Movies", "movies", "/media/movies"],
        ["Shows", "tvshows", "/media/shows"],
        ["Music", "music", "/media/music"],
    ];
    for (const [name, type, path] of libraries) {
        if (existing.has(name)) continue;
        const query = new URLSearchParams({
            name,
            collectionType: type,
            paths: path,
            refreshLibrary: "false",
        });
        await api(`/Library/VirtualFolders?${query}`, {
            method: "POST",
            body: { LibraryOptions: {} },
        });
    }

    const liveTv = await api("/System/Configuration/livetv");
    if (!liveTv.TunerHosts?.length) {
        await api("/LiveTv/TunerHosts", {
            method: "POST",
            body: { Type: "m3u", Url: "/media/tv/channels.m3u", FriendlyName: "Test channels" },
        });
        await api("/LiveTv/ListingProviders?validateListings=false&validateLogin=false", {
            method: "POST",
            body: { Type: "xmltv", Path: "/media/tv/guide.xml", EnableAllTuners: true },
        });
    }
}

/** Installs the plugins Cinema has add-ons for. Returns true if any was new. */
async function installPlugins(api) {
    step("Plugins");
    const installed = new Set((await api("/Plugins")).map((p) => p.Name));
    const repositories = await api("/Repositories");
    const known = new Set(repositories.map((r) => r.Url));
    const added = fixtures.plugins
        .filter((p) => !known.has(p.repository))
        .map((p) => ({ Name: new URL(p.repository).hostname, Url: p.repository, Enabled: true }));
    if (added.length)
        await api("/Repositories", { method: "POST", body: [...repositories, ...added] });

    let changed = false;
    for (const { repository, names } of fixtures.plugins) {
        const manifest = await (await fetch(repository)).json();
        for (const name of names) {
            if (installed.has(name)) continue;
            const plugin = manifest.find((p) => p.name === name);
            const version = plugin?.versions.find((v) => v.targetAbi.startsWith("12"));
            if (!version) throw new Error(`${name}: no Jellyfin 12 build in ${repository}`);
            const query = new URLSearchParams({
                assemblyGuid: plugin.guid,
                version: version.version,
                repositoryUrl: repository,
            });
            await api(`/Packages/Installed/${encodeURIComponent(name)}?${query}`, {
                method: "POST",
            });
            console.log(`installed ${name} ${version.version}`);
            changed = true;
        }
    }
    return changed;
}

async function restart() {
    step("Restart (plugins load at start)");
    await sleep(5000); // let the installs land on disk
    docker("restart", "jellyfin");
    await waitForServer();
}

/** Applies `edit` (current configuration => new one) to a plugin's settings. */
async function configurePlugin(api, name, edit) {
    const plugin = (await api("/Plugins")).find((p) => p.Name === name);
    if (!plugin) return console.warn(`skipped ${name}: not installed`);
    const path = `/Plugins/${plugin.Id}/Configuration`;
    await api(path, { method: "POST", body: edit(await api(path)) });
}

async function configure(api) {
    step("Server and plugin settings");
    const config = await api("/System/Configuration");
    await api("/System/Configuration", {
        method: "POST",
        body: { ...config, ServerName: "Cinema" },
    });
    // No trailers: they make screenshots differ from one run to the next.
    await configurePlugin(api, "Media Bar", (c) => ({
        ...c,
        WebConfig: { ...c.WebConfig, EnableTrailers: false },
    }));
    // Backdrops on for everyone, as on many servers: the theme must cope.
    await configurePlugin(api, "Jellyfin Tweaks", (c) => ({
        ...c,
        EnableBackdropsByDefault: true,
    }));
    await configurePlugin(api, "Jellyfin Enhanced", (c) => ({
        ...c,
        LanguageTagsEnabled: true,
        RatingTagsEnabled: true,
        TagsHideOnHover: false,
    }));
}

async function scan(api) {
    step("Library scan");
    await api("/Library/Refresh", { method: "POST" });
    const tasks = await api("/ScheduledTasks");
    const guide = tasks.find((t) => t.Key === "RefreshGuide");
    if (guide) await api(`/ScheduledTasks/Running/${guide.Id}`, { method: "POST" });

    const wanted = fixtures.movies.length + fixtures.shows.length;
    for (let i = 0; i < 90; i++) {
        const { Items } = await api(
            "/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ImageTags",
        );
        const withArt = Items.filter((item) => item.ImageTags?.Primary).length;
        process.stdout.write(`\r${withArt}/${wanted} titles with artwork`);
        if (withArt >= wanted) break;
        await sleep(5000);
    }
    console.log();
}

/** Resume points, favourites, a collection and a playlist. */
async function addUserData(api) {
    step("Resume points, favourites, collection, playlist");
    const { userId } = JSON.parse(await readFile(credentialsPath, "utf8"));
    const ids = async (query) =>
        (await api(`/Items?Recursive=true&${query}`)).Items.map((item) => item.Id);

    const resume = [
        ...(await ids("IncludeItemTypes=Movie&SortBy=SortName&StartIndex=2&Limit=4")),
        ...(await ids("IncludeItemTypes=Episode&SortBy=SortName&Limit=2")),
    ];
    for (const id of resume) {
        await api(`/UserItems/${id}/UserData`, {
            method: "POST",
            body: { PlaybackPositionTicks: 90_000_000, LastPlayedDate: new Date().toISOString() },
        });
    }

    for (const id of await ids("IncludeItemTypes=Series&SortBy=SortName&Limit=3")) {
        await api(`/UserFavoriteItems/${id}`, { method: "POST" });
    }

    const collections = await ids("IncludeItemTypes=BoxSet");
    if (!collections.length) {
        const silent = await ids("IncludeItemTypes=Movie&SortBy=PremiereDate&Limit=4");
        await api(`/Collections?Name=Silent%20Era&Ids=${silent.join(",")}`, { method: "POST" });
    }

    const playlists = await ids("IncludeItemTypes=Playlist");
    if (!playlists.length) {
        await api("/Playlists", {
            method: "POST",
            body: {
                Name: "Soundtrack",
                Ids: await ids("IncludeItemTypes=Audio"),
                UserId: userId,
                MediaType: "Audio",
            },
        });
    }
}

await waitForServer();
await createMedia();
const api = await signIn();
await addLibraries(api);
if (await installPlugins(api)) await restart();
await configure(api);
await scan(api);
await addUserData(api);
console.log(`\nReady: ${url} (credentials in ${credentialsPath})`);
