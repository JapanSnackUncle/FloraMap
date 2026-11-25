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

## Deploy (Cloudflare Pages)

Connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create → Pages → Connect to Git) with:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |

Node version comes from `.node-version`. Every push to `main` deploys; other branches get preview URLs.
