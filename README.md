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

`npm run dev` and `npm run build` run the data step first, and `npm run dev` re-runs it whenever a file in `data/` changes. Any data problem stops the build, so bad data never reaches the site. The schema is `src/lib/schema.ts`; fields like `editor_notes` and `checked_against` are private and never written to the JSON.

## Basemap tiles

The map's background (roads, coastline, names) is a Protomaps vector-tile file, `tiles/ibaraki.pmtiles` (143 MB, zoom 0–15). It's git-ignored because of its size; for the live site it will go on Cloudflare R2.

To recreate it, get the `pmtiles` command-line tool from https://github.com/protomaps/go-pmtiles/releases, pick a recent build date from https://build-metadata.protomaps.dev/builds.json, and run:

```
pmtiles extract https://build.protomaps.com/20261125.pmtiles tiles/ibaraki.pmtiles --bbox=139.68,35.73,140.86,36.96 --maxzoom=15
```

Add `--dry-run` first to see the size without downloading. The data is © OpenStreetMap contributors (ODbL): the map must show that attribution.

The tiles have no railways below zoom 12, so the main lines are also copied into `public/rail.geojson`, which the map draws at every zoom. That file is committed (the live build has no tile file to make it from). After downloading a new basemap, refresh it:

```
npm run build-rail
```

## Deploy (Cloudflare Pages)

Connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create → Pages → Connect to Git) with:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |

Node version comes from `.node-version`. Every push to `main` deploys; other branches get preview URLs.
