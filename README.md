# Ibaraki Flora Map / 茨城フローラマップ

A map of seasonal flower, autumn-leaf and illumination places in Ibaraki, showing how far along each one is right now. Rules and decisions: `CLAUDE.md`. Terms: `GLOSSARY.md`. Roadmap: `reference/plan.md`.

## Develop

Needs Node 24 (see `.node-version`).

```
npm install
npm run dev        # local site with hot reload
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run format     # Prettier
npm run build      # type-check and build to dist/
```

## Data

`data/` is the master copy: edit the YAML and CSV files directly. At build time they are validated and turned into JSON (`scripts/build-data.ts`, Phase 1 task 3). Open data to-dos are in `staging/import-report.md`.

## Deploy (Cloudflare Pages)

Connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create → Pages → Connect to Git) with:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |

Node version comes from `.node-version`. Every push to `main` deploys; other branches get preview URLs.
