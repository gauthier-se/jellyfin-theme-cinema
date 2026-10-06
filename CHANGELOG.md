# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html): a major version for a change that
needs action from users (a renamed variable, a dropped add-on), a minor one for new styling, and
a patch for fixes.

## [Unreleased]

## [0.2.0] - 2026-10-06

### Added

- A white focus ring for the keyboard on buttons, cards and home tiles, which showed no focus at
  all.
- Tokens for the primary action (`--cn-primary`, `--cn-primary-hover`, `--cn-on-primary`), the
  round glass buttons (`--cn-button`, `--cn-button-hover`), the play disc (`--cn-disc`,
  `--cn-disc-rim`) and the logo's purple (`--cn-accent-2`, `--cn-accent-2-rgb`).
- The now playing bar is frosted like the drawer, with the title in the text colour.
- Episode and track thumbnails round like cards, with the cards' play disc.

### Changed

- Every form action (Save, Add, Add Image) is the white pill of Play and Sign In, instead of the
  purple to blue gradient.
- Watched checks take the accent and favourite hearts the purple, instead of Jellyfin's red. The
  Media Bar heart follows `--cn-accent-2`.
- The logo and the library titles sit on the page gutter, in line with the cards. So do the
  Cinematheque page and title.
- The sign-in glows follow `--cn-accent` and `--cn-accent-2`.

### Fixed

- Action sheets (card menus, the player's settings) had square corners: Jellyfin sets their radius
  with `!important`.
- Sliders (seek, volume, the now playing bar) stayed Jellyfin blue when `--cn-accent` changed.
- Touch screens kept the hover state after a tap on the top bar's buttons and the item page's
  buttons.
- The play button on cards in the touch layouts lost its disc and vanished on light artwork.
- The audio and subtitle pickers on item pages set their text against the edge.
- Hovering the current library in the top bar faded its highlight.
- Media Bar: the Play and Details pills kept Jellyfin's padding instead of their own.
- Jellyfin Enhanced: its drawer entries sat out of line with the others, their margin and corners
  overridden by Jellyfin.

### Removed

- `--cn-gradient-strong`, which only the form actions used.

## [0.1.0] - 2026-10-06

First release, for Jellyfin 12.1 and its modern layout.

### Added

- Core theme: soft black canvas with Jellyfin's purple to blue accent, a top bar with the
  libraries as centred pills and a frosted fade on scroll, rounded cards with a calm hover, home
  tiles for My Media and the Live TV shortcuts, smaller cards in rows and grids, item pages with
  the artwork under the bar and a smaller poster, pill controls, frosted menus and drawer, and a
  compact sign-in card.
- Customisation through `--cn-*` variables.
- Add-ons for Media Bar 3.0, Jellyfin Enhanced 12.x and Cinematheque 0.3.

[Unreleased]: https://github.com/gauthier-se/jellyfin-theme-cinema/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/gauthier-se/jellyfin-theme-cinema/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gauthier-se/jellyfin-theme-cinema/releases/tag/v0.1.0
