# Changelog

## 0.0.3

- Fix broken screenshot on the marketplace listing by switching to an absolute raw.githubusercontent.com URL. Exclude `.github/` and the screenshot folder from the VSIX so the package size drops from 2.1 MB to ~14 KB.

## 0.0.2

- Updated README: added screenshot of three cascaded VSCode windows with distinct Plumage colors, replaced retired marketplace badges with working ones, moved source-build instructions to a dedicated section.

## 0.0.1

- Initial release. Automatically colors the title bar, activity bar, side bar, and status bar of each VSCode window based on a hash of the workspace path. Theme-aware (light / dark), 14 hand-picked hues, with Shuffle and Pick Color commands for manual override.
