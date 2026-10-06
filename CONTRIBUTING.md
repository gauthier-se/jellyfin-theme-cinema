# Contributing

Thanks for helping. Cinema styles a web client it does not control, so the main risk of any change
is breaking a screen nobody looked at. The workflow below makes looking cheap.

## Set up

You need Node 22 or later and Docker.

```sh
npm install
npx playwright install chromium
npm run server:up
npm run server:seed
```

`server:seed` creates the user, libraries, a fake Live TV tuner with a guide, a collection, a
playlist, resume points and favourites, and installs the plugins the add-ons cover. It is safe to
run again. Delete `test/.data` to start over.

## Make a change

1. Before you edit anything, take reference shots: `npm run shots -- --out before`.
2. `npm run dev`, then edit `src/`. Each save rebuilds and pushes the theme into the test server;
   reload the browser.
3. When you are done: `npm run shots`, then `npm run compare -- before current`. It lists every
   screen by how much it changed and writes diff images to `test/shots/`. Some screens always
   differ a little: the home slideshow picks slides at random and the Live TV guide shows the time.
   Read their diff images rather than the number.
4. `npm run lint` must pass. `npm run format` fixes most of what it reports.
5. If the change shows in the README's screenshots, refresh them with `npm run readme-shots`.

To check a single screen, `npm run shots -- --only movie`; `DEBUG=1` prints the full error when one
fails. The screens are listed in [test/screens.mjs](test/screens.mjs); add one when you style a
page that is not covered yet.

## Code style

- **One file per area** under `src/core/`, imported in cascade order by `src/cinema.css`.
  Plugin support goes in its own file under `src/addons/`, never in the core.
- **Tokens first.** A colour, radius or size that appears twice belongs in
  [src/core/tokens.css](src/core/tokens.css) as a `--cn-*` variable.
- **Nest by component**, but not deeper than three levels.
- **Say why.** A comment above each block explains what it fixes or why the selector looks the way
  it does. The selectors follow Jellyfin's markup, so they are rarely self-explanatory.
- **`!important` only to beat an inline style or another `!important`**, with a comment naming
  it. Raise specificity first (scope the rule under the component or the plugin's container).
- **Rules that would reach the dashboard** stop at `body:not(.dashboardDocument)`: it keeps
  Jellyfin's own look.
- Selectors follow Jellyfin's class names, which are camelCase; the linter allows that.

## Pull requests

Keep each pull request to one change. Include before and after screenshots of the screens it
touches (from `test/shots/`), and the Jellyfin and plugin versions you tested with.

## Releases

1. Update `version` in `package.json` and the `@v…` in the README's import lines.
2. Move the **Unreleased** notes in [CHANGELOG.md](CHANGELOG.md) under the new version.
3. Commit, tag `vX.Y.Z` and push the tag. The release workflow builds `dist/`, checks it matches
   the committed copy, and attaches the files to a GitHub release. jsDelivr serves the tag from
   then on.
