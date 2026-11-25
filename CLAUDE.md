# CLAUDE.md: Ibaraki Flora Map

A map of photogenic seasonal places in Ibaraki Prefecture (flowers, autumn leaves, illuminations) showing **how far along each one is right now**. It's a web app (installable PWA) in Japanese and English. Owner: R, building this alongside a day job. Target: soft launch for the 2027 plum season (late Jan–Feb), with spring (cherry, nemophila, azalea) as the real test.

The edge over existing listing sites is the live status and user-friendly map, not necessarily the listings. Keep that in mind when trading things off.

**This file is the source of truth for rules.** Where `reference/plan.md` or `reference/prototype.html` disagree with it, this file wins.

**Glossary:** `GLOSSARY.md` defines project terms (place, planting, edition, estimate, season…). Read it when a term is unclear, and add to it when a term gets a project-specific meaning.

**Terminology:** the word is **place** everywhere (code, IDs, folders, UI, docs). `reference/plan.md`, the prototype and the sheet's tab names still say "spot"; read it as place.

## Reference material (in `reference/`, exported from claude.ai)


| File                        | What it is                                                                                                   | How to treat it                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference/plan.md`         | "Ibaraki Flora Map — Long-term plan": goals, roadmap, reasoning behind the rules, operations, parked ideas    | **Planning document.** Holds no rules. When a decision becomes a rule, it goes here in CLAUDE.md and plan.md keeps only the why.                                                                                                     |
| `reference/draft-list.xlsx` | "Ibaraki flower spots — draft list": 79 place × flower rows, 25 places with details, Status sources, Festivals 2027 | Original export. Superseded by `staging/draft-list-clean.xlsx`; don't read either at runtime.                                                                                                                                        |
| `reference/prototype.html`  | Single-file prototype with a debug date bar                                                                  | **Reference for behaviour and look** (stage logic, pin rings, filters, illuminations). Its labels are older (まだ/終了, 点灯前/本日休み). Its bloom windows, statuses and photos are **made up**. Never copy its data into `data/`. |

If a file is missing, ask R to export it rather than guessing at its contents.

## Stack (R trusts this choice; flag anything that turns out wrong)

- **Front end:** Vite + React + TypeScript, MapLibre GL JS.
- **Basemap:** Protomaps (light style). PMTiles for Japan/Kanto go on Cloudflare R2. MapTiler Streets is the fallback only if labels or polish fall short (ask first; it's paid).
- **Data:** YAML and CSV in this repo, built into static JSON at build time. No database, no server.
- **Hosting:** Cloudflare Pages.
- **Watcher (Phase 3):** Python on a GitHub Actions cron.
- **PWA:** manifest + service worker (offline shell; data cached with a short TTL).

## Repo layout (target)

```
data/
  places/<prefecture>/<municipality>/<place-id>.yaml
                              # one place + its plantings, illuminations and closures
                              # e.g. places/ibaraki/mito/kairakuen.yaml
  festivals/<prefecture>/<festival-id>.yaml
                              # by prefecture only: a festival can span municipalities
  sources.yaml                # every status source
  species.yaml                # ~20 broad species, ja/en names
  statuses.csv                # append-only status log
  closures.csv                # append-only one-off venue closures
scripts/
  build-data.ts               # YAML/CSV -> public/data/*.json, with validation
  clean_sheet.py              # retired: load/save for the staging sheet
  build-clean-sheet.py        # retired one-off: reference/draft-list.xlsx -> staging sheet
  import-sheet.py             # retired one-off: staging sheet -> data/ (run 2026-11-25; locked)
staging/
  draft-list-clean.xlsx       # retired 2026-11-25: archive only, never edit or re-import
  import-report.md            # data to-do list from the import: tick off items as data/ is fixed
watcher/                      # Phase 3
src/
  lib/status.ts               # pure stage/visibility logic (tested)
  ...
reference/                    # exports listed above
GLOSSARY.md                   # project terms
```

## Data rules

- **IDs:** readable, permanent slugs, e.g. `kairakuen`, `kairakuen-ume`, `mito-ume-matsuri`. Never rename one once it's live.
- **`data/` is the master copy** (since 2026-11-25). Edit the YAML/CSV directly; the staging sheet is an archive. Open data to-dos live in `staging/import-report.md`.
- **Private fields:** `editor_notes`, `checked_against` and `window_raw` are for R and the build checks only; never show them in the app.
- **Hierarchy:** a place file nests what belongs only to that place: plantings (with photos), illuminations (with editions) and closures. Festivals, sources and statuses are separate and link by ID: a festival lists `place_ids`, a source lists the plantings it covers, and status rows use `planting_id`.
- **Folders:** prefecture and municipality folders use romaji slugs (`ibaraki/mito/`); the Japanese name lives in the file (`municipality: 水戸市`). The build fails if the folder and the file's `prefecture`/`municipality` disagree. The folder is not part of the ID: if a municipality merges or is renamed, move the file and keep the ID.
- **Place IDs are unique across all prefectures** (build fails on duplicates).
- **Every place** has `prefecture` and `municipality` from day one.
- **Coordinates:** one point per place (main entrance or viewing area). `geocode_precision` is `lot` or `block` (from the GSI geocoder), `manual` (placed by hand by R) or `approximate` (neighbourhood only, still to place). Optional free-text `point_note` says where the point is ("entrance", "parking lot").
- **Features have a `kind`:** `bloom`, `foliage` or `illumination`. A place can hold several.
  - **bloom/foliage:** broad `species` (from species.yaml) + optional free-text `species_variety`, plus `usual_window` as month + third (`"04-2"` = mid-April). The sheet only gives text like "4月上旬". Convert it, and mark every converted window `provisional: true` until checked against past data. Optional `featured: true` marks a place's flagship flora (see Pin choice).
  - Windows are a list, so roses (spring, autumn) and kochia can have two. Species-varieties that bloom weeks apart at one place (河津桜 and ソメイヨシノ) are separate plantings. Kochia is two plantings: green (bloom) and red (foliage).
  - **illumination:** an edition per season with `from`/`to` dates, nightly `hours` by date range (かわち's change on 1/13), and `dates_announced: true|false`. Closed days are not stored here (see Closures). Rain cancellation (きらくやま) is a note only.
- **Photos** belong to plantings, not places; `credit` and `license` are required.
- **Bilingual fields:** `name_ja`, `name_en`, `name_kana` for places; hours and fees as free text per language in v1. Fees that change during a festival go on the festival edition.
- **closures.csv** is append-only: `place_id, date, reason, source`. A row beats the place YAML for that date.
- **statuses.csv** is append-only. Columns: `planting_id, date, level, kind, source_id, raw_text, detail, note`. One level per planting per row: breakdowns by part (早咲き/遅咲き, 紅梅/白梅, park areas) go in `note`; a part that matters on its own becomes its own planting. `kind` is official / admin / user / forecast / usual. `admin` = from R or an agent reading a photo (R transcribing an official page is still `official`). Forecasts are rows with `kind: forecast`. official, admin and user rows are confirmed; forecast and usual are estimates.
- **Rows from X or Instagram:** store the post ID, post time and derived level only. **`raw_text` stays empty.** Both platforms require stored post content to be deleted when the original is. (Open question from R: whether storing anything from X/Instagram is needed at all; the purpose would be reading photos to judge stage.)
- Dates are ISO (`2027-02-22`) in Japan time. Each YAML file has a `schema_version`.
- Empty optional fields are fine: hide them in the UI, never show "unknown", never guess a value.

## Status and display logic (port from the prototype, then unit-test)

**Bloom scale (levels 0–4):** まもなく / 咲き始め / 見頃 / 見頃過ぎ / シーズン外. In English: Soon / Starting to Bloom / Peak / Past Peak / Out of Season. Leaves use 青葉 / 色づき始め / 見頃 / 見頃過ぎ / シーズン外. In English: Green / Turning Color / Peak / Past Peak / Out of Season.

- Mapping rule: anything before 7分 = 咲き始め; 7分 to 満開 = 見頃; 散り始め / 見頃後半 / 色あせ = 見頃過ぎ.

**Visibility:**

- **まもなく only in the 14 days before the usual start** (`LEAD = 14`, a single constant).
- Outside the lead window an off-season feature is **シーズン外**.
- **シーズン外 is hidden from the map and list by default.** A すべて表示 filter shows everything, with "次回 例年 2月下旬〜" text.
- **No countdowns for flora** (no "あと12日"): start dates move every year. Show the usual window as text.
- **Illuminations get countdowns** ("点灯まで あと5日"), but only when `dates_announced: true`. With last season's placeholder dates, show no countdown.

**Freshness** (fresh / aging limits in days): まもなく 7/14, 咲き始め 3/6, 見頃 4/8, 見頃過ぎ 3/6.

- Fresh: solid ring. Aging: solid ring, with the age shown prominently.
- Stale fallback order:
  1. a forecast newer than the last report;
  2. else the last confirmed stage, shown with a thin ring;
  3. the usual window only if there's been no report this season: before the window = まもなく, inside = 見頃, first third of a month after = 見頃過ぎ, then シーズン外. All thin.
- **Season:** a planting's usual window plus its lead window before and the following month after. For an illumination, the season is its edition. Reports from outside the current season never carry into it.
- **Never go backwards** within a season. Never advance a stale status on a guess: only a forecast, or the usual window when there's no report, may set the level. After 3 weeks of silence, show "no recent info". Statuses older than 60 days are ignored.
- A status's date is the source's own "as of" date, else its publish date, else the fetch date; record which.

**Illumination states:** まもなく (within 14 days of start, with a countdown if announced) / 点灯中 (show tonight's hours) / シーズン外 (otherwise). English: Soon / Lit / Out of Season. An illumination has no closed state of its own: closed days come from the place (see Closures).

**Closures:** belong to the venue, not to a feature. Place YAML `closures` holds only a weekly day off, fixed yearly dates, explicit `dates_closed` / `dates_open` and `periods_open`, plus `source_url` and `valid_until`. One-off closures go in append-only `data/closures.csv`. Precedence: closures.csv > dates_open/periods_open > dates_closed/fixed_dates > weekly. **No rule engine** (no runtime 祝日 shift or "first Tuesday" logic: those are written out as dates). Display: 本日休園 pill next to the place name in the list and place page; never on the map. A lit illumination at a closed place keeps its gold pin; only the list and place page show 本日休園. 不定休/unknown → no pill, "公式サイトで確認".

**Pin and filter rules:**

- **Pin choice per place** (one function, fixed order): illumination in its run > 見頃 > 咲き始め > 見頃過ぎ > まもなく (sooner start first; includes illuminations before their start) > シーズン外. Tie-break within a rank: `featured` first, then more of that stage still ahead (見頃: later peak end; 咲き始め: higher %; 見頃過ぎ: later season end). `featured` never moves a feature to a different rank. Venue closed days never affect the pin.
- **Place page order:** illuminations in their run, then plantings and illuminations in a rolling year from today: in season first (earliest start on top), then upcoming by start date, finished ones last. On 4/15 at ひたち海浜公園: スイセン first, 梅 last.
- Clicking an empty part of the map clears the selection.
- **Clock badge** ("peak within ~5 days"): only where an **official report**, or an illumination's **announced** dates, backs it. Never from a usual window alone.
- **Filters:** シーズン中 (default: everything except シーズン外), 見頃のみ, 開催中のイベント, イルミネーション, すべて表示.

**Map UI:**

- Photo pins. **The ring colour is the stage**: まもなく #E7E5E4 (empty track, greyed photo), 咲き始め #E58FAD (fills clockwise with bloom % from the 分咲き figure; about a third when the source gives words only, which is the norm for leaves), 見頃 #B0245C, 見頃過ぎ #9E7F89 (photo partly faded). Leaves: #E9A23B / #C2410C / #8C6A4F. Lit illumination: gold #D4A017.
- Place names below pins; which names show depends on zoom level, and a name is dropped if it would bump into another pin or name (MapLibre label collision).
- **Full ring = confirmed; thin ring = estimate** (usual window, forecast, stale fallback, or last season's illumination dates). Same photo size, smaller pin. Not dashed, not faded (a faded 見頃 reads as 咲き始め).
- Orange dot = festival on.
- **No status text and no kanji on pins** (place names aside).
- Source, age, 分咲き figure and dates go in the list and on the place page.

**Debug mode:** keep the prototype's date override in dev builds (date picker, ±1/±7 days, season presets, season offset, simulated scraper outage). It's how R checks behaviour across the year. Don't ship it enabled in production.

## Source and legal rules (do not break these)

- **Official pages first** (Status sources tab). Watcher fetches politely: daily, identifying user agent, respect robots.txt.
- **X:** official API only (pay-per-use). **No scraping.** Store post ID, time and derived level only.
- **Instagram:** only the Graph API Business Discovery endpoint, once R confirms it returns caption and timestamp. **No scraping.**
- **Never use Google Maps / Places photos or reviews, or Gemini's Maps grounding,** to judge bloom stage or to fill our data. The Maps Platform terms ban extracting content or creating content from it.
- **Aggregators** (Weathernews, Walkerplus, Jorudan, るるぶ, いこーよ) are for checking our data only. Never scrape or republish them.
- **Photos:** only ones R owns or has permission for, each with credit and license fields. Instagram/X posts may be shown only through official embeds.

## Phase 1: first tasks

1. **Done 2026-11-25.** Scaffold the repo (Vite + React + TS, ESLint/Prettier, Vitest). Cloudflare Pages settings are in `README.md`; connecting the repo in the dashboard is R's step.
2. **Done 2026-11-25** (see `staging/import-report.md`). `scripts/import-sheet.py`: turn `staging/draft-list-clean.xlsx` into `data/places/ibaraki/<municipality>/*.yaml` (25 places, with closures), `festivals/ibaraki/*.yaml`, `sources.yaml`. Mark converted windows `provisional: true`. Skip sources with no URL (koga-kanko-momo, mito-kanko-sakura) until one is found. Report anything that didn't map cleanly instead of guessing.
3. `scripts/build-data.ts` with schema validation (zod or JSON Schema): unknown species, bad dates, missing prefecture, folder/field mismatch, duplicate IDs → build fails.
4. `src/lib/status.ts`: port the prototype's stage, visibility, freshness and ranking logic as pure functions, with tests covering lead window, season rollover, never-backwards, stale fallback, illumination countdowns, venue closures precedence, featured tie-break and badge rules.
5. Map screen with the places, ring pins, filters, list and place page, using placeholder images until real photos exist.

Later phases (status pipeline, polish, launch) are in `reference/plan.md`.

## Keeping complexity down

- Build only for cases a real place needs now. If a rule can't be explained in one sentence, it's too complex for v1: push back and ask R.
- Prefer data over logic: expand patterns into explicit date lists at data-entry or build time; the app only checks lists.
- Each decision (pin choice, visibility, closures) lives in one pure function with a written precedence order. No second place nudges the result.
- Every bug found on a real date becomes a test fixture ("on 2027-04-16, hitachi-seaside pin = ネモフィラ").
- In debug mode, each pin and status can show why it was chosen.
- When unsure, show less: no guessed values, and invalid data fails the build.

## Working style

- R prefers **direct, precise answers** and honest evaluation. Say plainly when something is a bad idea.
- R knows programming in general and version control, but is new to web development (only a small static site before). Skip explaining git or basic programming; do explain web-specific tools, terms and conventions (build steps, npm, bundlers, service workers, CORS, caching…) briefly, in plain terms, the first time they come up.
- Ask before: adding paid services, changing the bloom scale or schema, renaming IDs, or adding any new data source.
- When data is uncertain, leave the field empty and list it for R. **Never invent dates, hours, fees or coordinates.**
- UI strings in both Japanese and English from the start (`ja` default).
- Keep commits small and described. Don't commit API keys (use Cloudflare/GitHub secrets).
