# Glossary: Ibaraki Flora Map

What words mean **in this project**. Definitions only: the rules that use them are in `CLAUDE.md`, which wins if this file disagrees. Add a term here when it gets a project-specific meaning.

## Data model

| Term                  | Meaning                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **place**             | A venue with one map point: a park, temple, valley, avenue. Owns its plantings, illuminations and closures. ID e.g. `kairakuen`. The older word **spot** (plan.md history, prototype, sheet tab names) means the same thing.       |
| **feature**           | Anything at a place that has a stage: a planting or an illumination. Each has a `kind`.                                                                                                                                            |
| **feature kind**      | `bloom` (flowers), `foliage` (autumn leaves, `kochia-red`) or `illumination`. Not the same as *status kind*.                                                                                                                       |
| **planting**          | One flower or leaf display at one place, with its own usual window and status. ID e.g. `kairakuen-ume`. Species-varieties that bloom weeks apart are separate plantings (`amabiki-kannon-kawazu-zakura`, `amabiki-kannon-sakura`). |
| **species**           | The broad kind of plant from `species.yaml` (`ume`, `sakura`, `momiji`…). About 20, fixed. Not strictly botanical: `momiji` covers several maples. Field: `species`. Formerly *type*.                                              |
| **species-variety**   | Optional free text under a species (`河津桜`, `ヤマザクラ`). Never used for logic. Field: `species_variety`. Formerly *variety*.                                                                                                           |
| **usual window**      | The typical 見頃 period of a planting (例年の見頃), as month + third. A list, so roses can have spring and autumn. In the sheet: `window_start`/`window_end`, `window2_start`/`window2_end`.                                              |
| **month + third**     | `"MM-N"`: N is 1 = 上旬 (1–10), 2 = 中旬 (11–20), 3 = 下旬 (21–end). `"04-2"` = mid-April.                                                                                                                                               |
| **provisional**       | A usual window converted from text or a placeholder and not yet checked against past data.                                                                                                                                         |
| **featured**          | Optional planting flag for a place's flagship flora. Only breaks ties within a pin rank.                                                                                                                                           |
| **illumination**      | A seasonal light-up at a place (イルミネーション, ライトアップ).                                                                                                                                                                                 |
| **edition**           | One season's or year's instance of an illumination (`season: 2026-27`) or a festival (`mito-ume-matsuri-2027`). Dates, hours and fees live on the edition.                                                                         |
| **dates announced**   | `dates_announced: true`: the edition's dates come from this season's official announcement. `false`: they're last season's dates, used as a placeholder.                                                                           |
| **festival**          | A named event (まつり, フェスティバル) linked to one or more places and plantings by ID. Lives outside the place files.                                                                                                                      |
| **festival on**       | Today falls between a festival edition's `from` and `to`.                                                                                                                                                                          |
| **closures**          | A place's regular closed days in its YAML: weekly day off, fixed yearly dates, `dates_closed`, `dates_open`, `periods_open`, with `source_url` and `valid_until`.                                                                  |
| **one-off closure**   | A single closed day (storm, snow, event) in `closures.csv`. Beats the YAML for that date.                                                                                                                                          |
| **source**            | A page or account that reports stage, in `sources.yaml`.                                                                                                                                                                           |
| **status**            | One row in `statuses.csv`: a level for a planting on a date, from a source.                                                                                                                                                        |
| **status kind**       | Where a status came from: `official` (the venue or city), `admin` (R, or an agent reading a photo), `user` (v2), `forecast` (a prediction for a date), `usual` (derived from the usual window). Not the same as *feature kind*.    |
| **raw_text**          | The source's exact words for a status. Empty for X and Instagram rows.                                                                                                                                                             |
| **detail**            | The 分咲き figure or similar (`7分`).                                                                                                                                                                                                  |
| **ID / slug**         | A readable, permanent, lowercase romaji identifier. Never renamed once live.                                                                                                                                                       |
| **municipality slug** | The romaji folder name for a municipality (`mito`, `ibaraki-machi`). The Japanese name lives in the file.                                                                                                                          |
| **geocode precision** | How a place's point was set: `lot` or `block` (GSI geocoder), `manual` (placed by hand by R), `approximate` (neighbourhood only, still to place).                                                                                  |
| **point note**        | Optional free text saying where the point sits ("entrance", "parking lot"). Field: `point_note`.                                                                                                                                   |
| **schema_version**    | Version number at the top of every YAML file.                                                                                                                                                                                      |

## Stages

| Term                             | Meaning                                                                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **level**                        | The stage as a number, 0–4. Stored in status rows.                                                                                                                                                  |
| **stage**                        | The level as shown to users.                                                                                                                                                                        |
| **まもなく / Soon** (0)              | Not open yet, and within the lead window. Leaves: **青葉 / Green**. Replaces the older まだ.                                                                                                            |
| **咲き始め / Starting to Bloom** (1) | Anything before 7分. Leaves: **色づき始め / Turning Color**.                                                                                                                                              |
| **見頃 / Peak** (2)                | 7分 to 満開.                                                                                                                                                                                           |
| **見頃過ぎ / Past Peak** (3)         | 散り始め, 見頃後半, 色あせ: falling or fading, still worth a visit.                                                                                                                                            |
| **シーズン外 / Out of Season** (4)    | Everything else. Hidden by default. Replaces the older 終了 / 落葉.                                                                                                                                     |
| **分咲き**                          | The fraction of flowers open, in tenths (`5分咲き` = half). 満開 = full bloom.                                                                                                                           |
| **mapping rule**                 | How a source's wording becomes a level (CLAUDE.md, Bloom scale).                                                                                                                                    |
| **pin photo**                    | The image inside a pin: a species close-up (`pin_photo` in species.yaml, files in `photos/species/`, cropped by its `crop` box), a planting's own override, or an illumination's first on-location photo. Not a shot of the place. |
| **photo strip**                  | The place page's row of the place's own `photos`, each cut to 2:1 around its `focus_y`, one at a time: swipe sideways, or ‹ › with a mouse. Never species close-ups. |
| **starting days**                | Per species (`starting_days` in species.yaml): how many days of 咲き始め to show before the usual window when there's no report.                                                                        |
| **lead window**                  | The `LEAD = 14` days before 咲き始め starts (or before an illumination starts). The only time まもなく shows.                                                                                               |
| **in season**                    | A feature that isn't シーズン外. The default filter シーズン中 shows these.                                                                                                                                   |

## Illuminations

| Term | Meaning |
|---|---|
| **点灯中 / Lit** | Today is within the edition's dates and has hours. |
| **in its run** | Same as 点灯中, for pin ranking. |
| **まもなく / Soon** (illumination) | Within 14 days of the edition's start. |
| **countdown** | "点灯まで あと5日". Illuminations only, and only when dates are announced. |
| **tonight's hours** | The `hours` range covering today (hours can change partway through the season). |

## Status and freshness

| Term | Meaning |
|---|---|
| **confirmed** | Shown from an official, admin (later, user) status that isn't stale. The place page marks it as confirmed. |
| **estimate** | Shown from anything else: a forecast, a stale fallback, the usual window, or last season's illumination dates. The place page marks it as an estimate; the map draws the same 3 px ring as for confirmed. |
| **fresh / aging / stale** | A status's age against its stage's limits: fresh within the first limit, aging up to the second, stale beyond it. |
| **fallback** | What a stale status is replaced with: newer forecast, then last confirmed stage, then the usual window. |
| **never backwards** | Within a season, the stage shown can't be earlier than the last confirmed report. |
| **no recent info** | The pin style after 3 weeks with no report. |
| **season** | For a planting: its usual window, plus the 咲き始め days and lead window before and the following month after. For an illumination: its edition. "Never backwards" and "no report this season" use this. |

## Map and UI

| Term                      | Meaning                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **pin**                   | A place's photo circle on the map. One per place, fronted by one feature.                                                              |
| **ring**                  | The circle around the pin photo. Its colour is the stage; its fill shows bloom %.                                                      |
| **track**                 | The empty grey ring under a partial fill.                                                                                              |
| **pin choice**            | The one function that picks which feature fronts a place's pin.                                                                        |
| **festival dot**          | Orange dot on a pin while a festival is on.                                                                                            |
| **clock badge**           | "Peak within ~5 days" mark, only when backed by an official report or announced illumination dates.                                    |
| **本日休園 pill**             | "Closed today" label beside the place name in the list and place page. Never on the map.                                               |
| **list**                  | The list of places that match the current filter and sit in the map view: in the side panel on desktop, in the sheet on phones.        |
| **side panel**            | Desktop: the column left of the map holding the list or place page.                                                                    |
| **sheet**                 | Phones: the bottom panel over the map holding the list or place page. Rests at **peek** (grab bar + count line), **half** or **full**. |
| **uncovered area**        | Phones: the part of the map above the sheet. "Centre" and the open-place pan use it.                                                   |
| **place page**            | The detail view for one place: all its features in rolling-year order, sources, ages, dates.                                           |
| **rolling year**          | Ordering from today forward: in season first, then upcoming, then finished.                                                            |
| **filters**               | シーズン中, 見頃のみ, 開催中のイベント, イルミネーション, すべて表示.                                                                                                |
| **debug mode**            | Dev-only date override bar from the prototype.                                                                                         |

## Sources and operations

| Term | Meaning |
|---|---|
| **official source** | A page run by the venue, municipality, prefecture or their tourism association. |
| **aggregator** | A third-party listing site (Weathernews, Walkerplus, るるぶ…). For checking our data only. |
| **checked_against** | Sheet column: aggregator links used to check a value. Private, never shown. |
| **candidate source** | A source found but not yet approved by R (`checked: candidate`). |
| **watcher** | The Phase 3 daily script that fetches official sources and flags changes. |
| **morning digest** | The one daily email/LINE message listing what needs a manual check. |

## Project and workflow

| Term | Meaning |
|---|---|
| **v1 / v2** | v1: the scope in plan.md, for the 2027 plum and spring seasons. v2: anything deferred. |
| **in_v1** | Staging-sheet column: whether a row was imported for v1. |
| **staging sheet** | `reference/staging/draft-list-clean.xlsx`. Used to clean the original data, imported to `data/` on 2026-11-25, now an archive only. |
| **Issues tab** | The staging sheet's list of problems to resolve; a row's cell is highlighted until it's marked resolved. |
| **reference** | The claude.ai exports in `reference/`. Read-only background. |
| **soft launch** | Going live for the 2027 plum season (late Jan–Feb). |
| **photo tool** | Dev-only page at `/tools/photo-tool/` (`npm run photo-tool`) for a place's `photos`: order, credit, license, `focus_y`. Writes only the YAML's `photos:` block. Its Species tab sets each species' `pin_photo` in species.yaml (file by name, license, credit, `crop` circle). |

## Web development

General web terms and tools, and where this project uses them. *(Planned)* means it isn't in the project yet.

Three words also mean something else above: a MapLibre **source** is not a status source, MapLibre **clustering** is what makes our grouped pins, and **glyphs** here are font files, not pin art.

### Languages and file formats

| Term | Meaning |
|---|---|
| **HTML / CSS** | A page's structure and its styling. `index.html` is the one page; styles are in `src/styles.css`. |
| **TypeScript (TS)** | JavaScript with static types. The build strips the types, because browsers only run JavaScript. |
| **TSX** | TypeScript that can contain HTML-like markup (JSX). Used for React components. |
| **JSON / GeoJSON** | JSON is the data format the app loads (`places.json`). GeoJSON is JSON for map shapes and points (`public/rail.geojson`). |
| **YAML / CSV** | The hand-edited formats in `data/`. The app never reads them directly. |
| **WebP** | A compact image format for the web. Pin photos are resized to it. |

### Tools and libraries

| Term | Meaning |
|---|---|
| **Node.js** | Runs JavaScript outside the browser: our scripts and dev tools. Version in `.node-version`. |
| **npm** | Node's package manager. `package.json` lists the libraries and commands (`npm run dev`); `package-lock.json` pins exact versions; installed files go in `node_modules/`. |
| **dependency / dev dependency** | A library the app itself uses, as opposed to one only needed to build or check it. |
| **Vite** | The dev server and build tool. Config: `vite.config.ts`. |
| **Vite plugin** | Extra behaviour added to Vite. Ours rebuild data when it changes and serve the local map tiles. |
| **React** | The UI library: the screen is described as a function of the current data and state. |
| **MapLibre GL JS** | The library that draws the interactive map. |
| **Protomaps** | The basemap: map data in PMTiles plus a ready-made light style (`@protomaps/basemaps`). |
| **zod** | Checks that data matches a schema, and derives the TypeScript types from it (`src/lib/schema.ts`). |
| **sharp** | Image library used to crop and resize pin photos at build time. |
| **Vitest** | Runs the unit tests (`*.test.ts`). |
| **ESLint** | The linter: flags likely mistakes in code. |
| **Prettier** | The code formatter. |

### Building and running

| Term | Meaning |
|---|---|
| **dev server** | The local server from `npm run dev`, for working on the site. `.claude/launch.json` lets Claude start it. |
| **hot reload (HMR)** | The dev server updates the open page when a file is saved, usually without a full reload. |
| **build** | `npm run build`: check data and types, then produce the files that get published. |
| **bundle** | The JavaScript and CSS the build combines and shrinks from many source files. |
| **type check** | TypeScript verifying types without running the code (`tsc`). Vite alone doesn't do this. |
| **build time / runtime** | While the site is being built, as opposed to while it's running in someone's browser. |
| **dist/** | The build's output folder: the whole published site. |
| **public/** | Files copied into `dist/` unchanged and served from the site root. |
| **preview (`npm run preview`)** | Serves the built `dist/` locally. Different from a preview URL. |
| **environment variable** | A setting passed in from outside the code. `VITE_TILES_URL` sets where the map tiles load from. Anything prefixed `VITE_` is visible to site visitors, so never a secret. |

### Frontend concepts

| Term | Meaning |
|---|---|
| **component** | A reusable piece of React UI (`src/components/`). |
| **state** | Values that change while the app runs; React redraws what depends on them. |
| **hook** | A React function starting with `use`, for state and other behaviour (`usePhone`). |
| **pure function** | Same inputs always give the same output, with no side effects. `status.ts` is built this way. |
| **fetch** | The browser's way of requesting a file or data over the network. |
| **History API** | Lets the app change the address and respond to Back without reloading the page (`selectedPlace.ts`). |
| **query parameter** | The `?name=value` part of an address (`?place=<id>`). |
| **media query** | A test of the screen, such as width under 768 px, used to switch layouts. |
| **viewport** | The visible area of the page in the browser. |
| **dev tools** | The browser's built-in inspector (F12): console, network requests, element styles, phone emulation. |
| **console** | The dev tools tab where errors and log messages appear. |

### Map terms

| Term | Meaning |
|---|---|
| **basemap** | The background map: roads, coastline, names. |
| **vector tiles** | The map cut into squares per zoom level, sent as shapes and drawn by the browser rather than as pictures. |
| **PMTiles** | A whole tile set in one file. The browser fetches only the parts it needs. |
| **HTTP range request** | A request for only some bytes of a file. PMTiles depends on it. |
| **style** | MapLibre's description of how the map looks: which data is drawn, in what order and colours. |
| **source / layer** | In MapLibre, a source is a set of map data; a layer is one way of drawing it. |
| **symbol layer** | A layer of text and icons. It handles label collision. |
| **label collision** | MapLibre hiding a name that would overlap another. |
| **clustering (Supercluster)** | MapLibre's built-in merging of nearby points. Behind grouped pins. |
| **HTML marker** | A map item made of ordinary page elements placed over the map, as our pins are. |
| **glyphs / sprite** | Font files for map labels, and one image holding the map's small icons. |
| **zoom level** | How far in the map is. Each step up doubles the scale. |
| **geocoder** | A service that turns an address into coordinates (we used GSI's). |
| **OSM / ODbL** | OpenStreetMap, the source of the basemap data, and its licence, which requires visible credit. |

### Hosting and delivery

| Term | Meaning |
|---|---|
| **static site** | Plain files served as they are, with no server code or database. |
| **Cloudflare Pages** *(planned)* | The host. Builds and publishes the site on each push to `main`. |
| **Cloudflare R2** *(planned)* | File storage where the large map tile file will live. |
| **deploy** | Publishing a new version of the site. |
| **preview URL** *(planned)* | A temporary address Cloudflare gives a branch other than `main`. |
| **cache** | A saved copy reused to avoid downloading again. |
| **TTL** | How long a cached copy is used before it's checked again. |
| **CORS** | A browser rule: a page may read files from another domain only if that domain allows it. Will matter for tiles on R2. |
| **CDN** | A network of servers that delivers files from somewhere near the visitor. |
| **PWA** *(planned)* | A website that can be installed like an app. |
| **web app manifest** *(planned)* | A file giving the installed app its name, icon and display settings. |
| **service worker** *(planned)* | A background script that intercepts requests, so the app can open offline. |
| **app shell** *(planned)* | The page, code and styles needed to open the app, without the data. |
| **GitHub Actions / cron** *(planned)* | GitHub's automated job runner, and a timed schedule for it. Will run the watcher. |
| **API** | A defined way for one program to request data from another (X API, Instagram Graph API). |
| **robots.txt** | A site's file saying what automated programs may fetch. |
| **user agent** | The name a browser or program sends to identify itself. |
