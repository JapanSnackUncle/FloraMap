# Glossary: Ibaraki Flora Map

What words mean **in this project**. Definitions only: the rules that use them are in `CLAUDE.md`, which wins if this file disagrees. Add a term here when it gets a project-specific meaning.

## Data model

| Term | Meaning |
|---|---|
| **place** | A venue with one map point: a park, temple, valley, avenue. Owns its plantings, illuminations and closures. ID e.g. `kairakuen`. The older word **spot** (plan.md history, prototype, sheet tab names) means the same thing. |
| **feature** | Anything at a place that has a stage: a planting or an illumination. Each has a `kind`. |
| **feature kind** | `bloom` (flowers), `foliage` (autumn leaves, red kochia) or `illumination`. Not the same as *status kind*. |
| **planting** | One flower or leaf display at one place, with its own usual window and status. ID e.g. `kairakuen-ume`. Species-varieties that bloom weeks apart are separate plantings (`amabiki-kannon-kawazu-zakura`, `amabiki-kannon-sakura`). |
| **species** | The broad kind of plant from `species.yaml` (`ume`, `sakura`, `momiji`…). About 20, fixed. Not strictly botanical: `momiji` covers several maples. Field: `species`. Formerly *type*. |
| **species-variety** | Optional free text under a species (`河津桜`, `ヤマザクラ`). Never used for logic. Field: `species_variety`. Formerly *variety*. |
| **usual window** | The months a planting is normally worth seeing, as month + third. A list, so roses can have spring and autumn. In the sheet: `window_start`/`window_end`, `window2_start`/`window2_end`. |
| **month + third** | `"MM-N"`: N is 1 = 上旬 (1–10), 2 = 中旬 (11–20), 3 = 下旬 (21–end). `"04-2"` = mid-April. |
| **provisional** | A usual window converted from text or a placeholder and not yet checked against past data. |
| **featured** | Optional planting flag for a place's flagship flora. Only breaks ties within a pin rank. |
| **illumination** | A seasonal light-up at a place (イルミネーション, ライトアップ). |
| **edition** | One season's or year's instance of an illumination (`season: 2026-27`) or a festival (`mito-ume-matsuri-2027`). Dates, hours and fees live on the edition. |
| **dates announced** | `dates_announced: true`: the edition's dates come from this season's official announcement. `false`: they're last season's dates, used as a placeholder. |
| **festival** | A named event (まつり, フェスティバル) linked to one or more places and plantings by ID. Lives outside the place files. |
| **festival on** | Today falls between a festival edition's `from` and `to`. |
| **closures** | A place's regular closed days in its YAML: weekly day off, fixed yearly dates, `dates_closed`, `dates_open`, `periods_open`, with `source_url` and `valid_until`. |
| **one-off closure** | A single closed day (storm, snow, event) in `closures.csv`. Beats the YAML for that date. |
| **source** | A page or account that reports stage, in `sources.yaml`. |
| **status** | One row in `statuses.csv`: a level for a planting on a date, from a source. |
| **status kind** | Where a status came from: `official` (the venue or city), `admin` (R, or an agent reading a photo), `user` (v2), `forecast` (a prediction for a date), `usual` (derived from the usual window). Not the same as *feature kind*. |
| **raw_text** | The source's exact words for a status. Empty for X and Instagram rows. |
| **detail** | The 分咲き figure or similar (`7分`). |
| **ID / slug** | A readable, permanent, lowercase romaji identifier. Never renamed once live. |
| **municipality slug** | The romaji folder name for a municipality (`mito`, `ibaraki-machi`). The Japanese name lives in the file. |
| **geocode precision** | How a place's point was set: `lot` or `block` (GSI geocoder), `manual` (placed by hand by R), `approximate` (neighbourhood only, still to place). |
| **point note** | Optional free text saying where the point sits ("entrance", "parking lot"). Field: `point_note`. |
| **schema_version** | Version number at the top of every YAML file. |

## Stages

| Term | Meaning |
|---|---|
| **level** | The stage as a number, 0–4. Stored in status rows. |
| **stage** | The level as shown to users. |
| **まもなく / Soon** (0) | Not open yet, and within the lead window. Leaves: **青葉 / Green**. Replaces the older まだ. |
| **咲き始め / Starting to Bloom** (1) | Anything before 7分. Leaves: **色づき始め / Turning Color**. |
| **見頃 / Peak** (2) | 7分 to 満開. |
| **見頃過ぎ / Past Peak** (3) | 散り始め, 見頃後半, 色あせ: falling or fading, still worth a visit. |
| **シーズン外 / Out of Season** (4) | Everything else. Hidden by default. Replaces the older 終了 / 落葉. |
| **分咲き** | The fraction of flowers open, in tenths (`5分咲き` = half). 満開 = full bloom. |
| **mapping rule** | How a source's wording becomes a level (CLAUDE.md, Bloom scale). |
| **lead window** | The `LEAD = 14` days before a usual window starts. The only time まもなく shows. |
| **in season** | A feature that isn't シーズン外. The default filter シーズン中 shows these. |

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
| **confirmed** | Shown from an official, admin (later, user) status that isn't stale. Drawn with a full ring. |
| **estimate** | Shown from anything else: a forecast, a stale fallback, the usual window, or last season's illumination dates. Drawn with a thin ring. |
| **fresh / aging / stale** | A status's age against its stage's limits: fresh within the first limit, aging up to the second, stale beyond it. |
| **fallback** | What a stale status is replaced with: newer forecast, then last confirmed stage, then the usual window. |
| **never backwards** | Within a season, the stage shown can't be earlier than the last confirmed report. |
| **no recent info** | The pin style after 3 weeks with no report. |
| **season** | For a planting: its usual window, plus the lead window before and the following month after. For an illumination: its edition. "Never backwards" and "no report this season" use this. |

## Map and UI

| Term | Meaning |
|---|---|
| **pin** | A place's photo circle on the map. One per place, fronted by one feature. |
| **ring** | The circle around the pin photo. Its colour is the stage; its fill shows bloom %. |
| **track** | The empty grey ring under a partial fill. |
| **full ring / thin ring** | Confirmed / estimate. |
| **pin choice** | The one function that picks which feature fronts a place's pin. |
| **festival dot** | Orange dot on a pin while a festival is on. |
| **clock badge** | "Peak within ~5 days" mark, only when backed by an official report or announced illumination dates. |
| **本日休園 pill** | "Closed today" label beside the place name in the list and place page. Never on the map. |
| **list** | The bottom list of places that match the current filter. |
| **place page** | The detail view for one place: all its features in rolling-year order, sources, ages, dates. |
| **rolling year** | Ordering from today forward: in season first, then upcoming, then finished. |
| **filters** | シーズン中, 見頃のみ, 開催中のイベント, イルミネーション, すべて表示. |
| **debug mode** | Dev-only date override bar from the prototype. |

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
