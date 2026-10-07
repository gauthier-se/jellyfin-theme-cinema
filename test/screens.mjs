// The screens `npm run shots` captures. Each has a name, a viewport, and a
// `visit` that brings the page to the state to photograph.

/** Looks up the ids the screens link to, from what the seed created. */
export async function resolveIds(api, userId) {
    const first = async (query) =>
        (await api(`/Items?Recursive=true&Limit=1&SortBy=SortName&${query}`)).Items[0]?.Id;
    const server = (await api("/System/Info")).Id;
    const views = (await api(`/UserViews?userId=${userId}`)).Items;
    const view = (type) => views.find((v) => v.CollectionType === type)?.Id;
    const series = await first("IncludeItemTypes=Series");
    const season = (await api(`/Shows/${series}/Seasons?userId=${userId}`)).Items[0]?.Id;

    return {
        server,
        movie: await first("IncludeItemTypes=Movie&HasBackdrop=true"),
        series,
        season,
        episode: await first(`IncludeItemTypes=Episode&ParentId=${season}`),
        person: (await api("/Persons?limit=50")).Items.find((p) => p.ImageTags?.Primary)?.Id,
        album: await first("IncludeItemTypes=MusicAlbum"),
        playlist: await first("IncludeItemTypes=Playlist"),
        movies: view("movies"),
        tvshows: view("tvshows"),
        music: view("music"),
        boxsets: view("boxsets"),
        playlists: view("playlists"),
    };
}

const details = (id, ids) => `#/details?id=${id}&serverId=${ids.server}`;
const library = (type, id) => `#/${type}?topParentId=${id}&collectionType=${type}`;

const open =
    (hash, wait = 3500) =>
    async (page) => {
        await page.goto(`/web/${hash}`);
        await page.waitForTimeout(wait);
    };

const click = (selector) => async (page) => {
    await page.locator(selector).first().click();
    await page.waitForTimeout(800);
};

// The Live TV row shows only while a programme airs: the seed's guide runs
// 11 hours from seeding, so run `npm run server:seed` again past that.
const liveTvRow = async (page) => {
    await open("#/home", 8000)(page);
    await page.locator('a.raised[href*="livetv?tab="]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
};

const toolbarButton = (icon) =>
    `.MuiAppBar-root .MuiToolbar-root + .MuiToolbar-root button:has(svg[data-testid="${icon}"])`;

/**
 * Screens run in order within a viewport, so one may build on the page the
 * previous one left (card-menu opens the menu of the card card-hover found).
 * @type {{ name: string, viewport: "desktop" | "mobile", anonymous?: boolean,
 *          visit: (page, ids) => Promise<void> }[]}
 */
export const screens = [
    { name: "home", viewport: "desktop", visit: open("#/home", 8000) },
    {
        name: "home-rows",
        viewport: "desktop",
        visit: async (page) => {
            await open("#/home", 8000)(page);
            await page.mouse.wheel(0, 700);
            await page.waitForTimeout(1500);
        },
    },
    { name: "home-livetv", viewport: "desktop", visit: liveTvRow },
    {
        name: "card-hover",
        viewport: "desktop",
        visit: async (page) => {
            await open("#/home", 8000)(page);
            await page.mouse.wheel(0, 700);
            await page.waitForTimeout(1000);
            await page
                .locator(".homeSectionsContainer .card[data-type=Movie] .cardScalable")
                .first()
                .hover();
            await page.waitForTimeout(800);
        },
    },
    {
        name: "card-menu",
        viewport: "desktop",
        visit: async (page) => {
            const card = page.locator(".homeSectionsContainer .card[data-type=Movie]").first();
            await card.locator("button[data-action=menu]").click();
            await page.waitForTimeout(800);
        },
    },
    {
        name: "user-menu",
        viewport: "desktop",
        visit: async (page) => {
            await open("#/home", 3000)(page);
            await click(".MuiAppBar-root .MuiAvatar-root")(page);
        },
    },
    {
        name: "movies",
        viewport: "desktop",
        visit: (page, ids) => open(library("movies", ids.movies))(page),
    },
    { name: "movies-sort", viewport: "desktop", visit: click(toolbarButton("SortByAlphaIcon")) },
    {
        name: "shows",
        viewport: "desktop",
        visit: (page, ids) => open(library("tv", ids.tvshows))(page),
    },
    {
        name: "collections",
        viewport: "desktop",
        visit: (page, ids) => open(library("boxsets", ids.boxsets))(page),
    },
    {
        name: "movie",
        viewport: "desktop",
        visit: (page, ids) => open(details(ids.movie, ids))(page),
    },
    {
        name: "series",
        viewport: "desktop",
        visit: (page, ids) => open(details(ids.series, ids))(page),
    },
    {
        name: "episode",
        viewport: "desktop",
        visit: (page, ids) => open(details(ids.episode, ids))(page),
    },
    {
        name: "person",
        viewport: "desktop",
        visit: (page, ids) => open(details(ids.person, ids))(page),
    },
    {
        name: "album",
        viewport: "desktop",
        visit: (page, ids) => open(details(ids.album, ids))(page),
    },
    {
        name: "playlist",
        viewport: "desktop",
        visit: (page, ids) => open(details(ids.playlist, ids))(page),
    },
    {
        name: "live-tv-guide",
        viewport: "desktop",
        visit: (page, ids) =>
            open(`#/livetv?collectionType=livetv&tab=1&serverId=${ids.server}`, 5000)(page),
    },
    { name: "search", viewport: "desktop", visit: open("#/search?query=the", 4000) },
    {
        // The video plays behind a transparent page: a background painted by
        // the theme would hide it.
        name: "player",
        viewport: "desktop",
        visit: async (page, ids) => {
            await open(details(ids.movie, ids))(page);
            await page.locator(".itemDetailPage:not(.hide) .btnPlay").first().click();
            await page.waitForTimeout(6000);
        },
    },
    { name: "settings", viewport: "desktop", visit: open("#/mypreferencesmenu") },
    { name: "settings-playback", viewport: "desktop", visit: open("#/mypreferencesplayback") },
    {
        name: "cinematheque",
        viewport: "desktop",
        visit: open("#/home?cinematheque=directors", 6000),
    },
    { name: "login", viewport: "desktop", anonymous: true, visit: open("#/login", 2500) },

    { name: "mobile-home", viewport: "mobile", visit: open("#/home", 8000) },
    {
        name: "mobile-home-rows",
        viewport: "mobile",
        visit: async (page) => {
            await open("#/home", 8000)(page);
            await page.mouse.wheel(0, 900);
            await page.waitForTimeout(1500);
        },
    },
    { name: "mobile-home-livetv", viewport: "mobile", visit: liveTvRow },
    { name: "mobile-drawer", viewport: "mobile", visit: click(".MuiAppBar-root button") },
    {
        name: "mobile-movies",
        viewport: "mobile",
        visit: (page, ids) => open(library("movies", ids.movies))(page),
    },
    {
        name: "mobile-series",
        viewport: "mobile",
        visit: (page, ids) => open(details(ids.series, ids))(page),
    },
    {
        // No backdrop: the portrait sits at the top of the page, under the bar
        name: "mobile-person",
        viewport: "mobile",
        visit: (page, ids) => open(details(ids.person, ids))(page),
    },
    { name: "mobile-search", viewport: "mobile", visit: open("#/search?query=the", 4000) },
];
