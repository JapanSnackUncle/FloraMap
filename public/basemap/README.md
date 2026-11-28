# Basemap fonts and icons

Copied unchanged from [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets),
commit `028c18f713baecad011301ff7a69acc39bcc2ae7` (2025-10-31), so the map doesn't depend on
protomaps.github.io. Only what the light style uses:

- `fonts/Noto Sans Regular|Medium|Italic/`: label glyphs (all 256 ranges each). SIL Open Font
  License, `fonts/OFL.txt` (ships with the site, as the license requires).
- `sprites/light*.{json,png}`: map icons, from `sprites/v4/`. Derived from the MIT-licensed
  [tangrams/icons](https://github.com/tangrams/icons/blob/master/LICENSE.md).

To update: download the repo again (its README links a ZIP), replace these files, and change the
commit above. A new `@protomaps/basemaps` major version may need a new `sprites/vN/`.
