# Ibaraki Flora Map / 茨城フローラマップ

A map of seasonal flower, autumn-leaf and illumination places in Ibaraki, showing how far along each one is right now. Rules and decisions: `CLAUDE.md`. Terms: `GLOSSARY.md`. Roadmap: `reference/plan.md`.

## Develop

Needs Node 24 (see `.node-version`).

```
npm install
npm run dev        # local site with hot reload (rebuilds data on change)
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run format     # Prettier
npm run build      # type-check and build to dist/
```

## Data

`data/` is the master copy: edit the YAML and CSV files directly. Open data to-dos are in `reference/staging/import-report.md`.

```
npm run check-data   # validate data/ only; lists every problem with file and field
npm run build-data   # validate and write public/data/places.json
```

`npm run dev` and `npm run build` run the data step first, and `npm run dev` re-runs it whenever a file in `data/` or `photos/` changes. Any data problem stops the build, so bad data never reaches the site. The schema is `src/lib/schema.ts`; fields like `editor_notes` and `checked_against` are private and never written to the JSON.

## Photo tool

A page for managing a place's photos: which files from its photo folder are listed in its YAML, their order (the place page's photo strip shows them in this order), `credit`, `license`, and where each photo's 2:1 strip is cut (`focus_y`).

```
npm run photo-tool   # starts the dev server and opens localhost:5173/tools/photo-tool/
```

(Or, with `npm run dev` already running, open `/tools/photo-tool/` yourself.)

1. Put the photos in `photos/places/<prefecture>/<municipality>/<place-id>/` (shrink them to about 2000 px on the long side first: they go into git). The tool picks up new files by itself.
2. Pick the place, **Add** each photo, set credit and license (dropdowns of every value already used in `data/`, or **Add…** for a new one), and click on each photo where its 2:1 strip should sit. The preview shows the strip exactly as the build will cut it.
3. **Save to YAML** rewrites only that place's `photos:` block (the rest of the file stays byte for byte, and the file is re-read at save time, so other edits aren't lost), then runs the data check and shows its result.

The tool never moves, renames or deletes image files. It only runs under the dev server: `tools/` isn't part of `npm run build`, and the save handler (`tools/photo-tool/server.ts`) exists only in `npm run dev`.

## Basemap tiles

The map's background (roads, coastline, names) is a Protomaps vector-tile file, `tiles/ibaraki.pmtiles` (about 35 MB, zoom 0–13; zooming in further enlarges the zoom-13 detail). It's committed to git, and git keeps every old version, so only replace it when needed. For the live site it will go on Cloudflare R2 (it's over Cloudflare Pages' 25 MiB per-file limit).

To recreate it, get the `pmtiles` command-line tool from https://github.com/protomaps/go-pmtiles/releases, pick a recent build date from https://build-metadata.protomaps.dev/builds.json, and run:

```
pmtiles extract https://build.protomaps.com/20261125.pmtiles tiles/ibaraki.pmtiles --bbox=139.68,35.73,140.86,36.96 --maxzoom=13
```

Add `--dry-run` first to see the size without downloading. The data is © OpenStreetMap contributors (ODbL): the map must show that attribution.

The tiles have no railways below zoom 12, so the main lines are also copied into `public/rail.geojson`, which the map draws at every zoom. That file is committed too. After downloading a new basemap, refresh it:

```
npm run build-rail
```

## Test site (GitHub Pages)

For testing only: https://japansnackuncle.github.io/FloraMap/. Every push to `main` rebuilds it (`.github/workflows/pages.yml`). Like any production build it has no debug date bar, so it shows today's status. A second copy with the debug date bar is at https://japansnackuncle.github.io/FloraMap/debug/ (built with `VITE_DEBUG=true`; it shares the main copy's tiles). Real production builds never set `VITE_DEBUG`.

One-time setup on GitHub: Settings → Pages → Build and deployment → Source: "GitHub Actions". Then push to `main`, or run the workflow by hand: Actions → Test site (GitHub Pages) → Run workflow.

## Deploy (Cloudflare Pages)

Connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create → Pages → Connect to Git) with:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |

Node version comes from `.node-version`. Every push to `main` deploys; other branches get preview URLs.
