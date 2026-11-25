# Ibaraki Flora Map — Long-term plan

Started Nov 24, 2026 · @R · reorganised Nov 25, 2026

This is the planning document: goals, roadmap, the reasoning behind decisions, operations, and what's deferred. **The rules themselves (stage scale, visibility, freshness limits, pin ranking, closures, schema, source rules) live in `CLAUDE.md`**, which wins wherever the two disagree. When a decision here becomes a rule, move it to CLAUDE.md and leave only the why here.

## Goal

v1 is a working app in place for the **2027 plum season (late January to February)**, with **spring (cherry, nemophila and azalea, late March to May)** as the real test.

The focus is the plants: bloom status decides whether a place is worth visiting. Festival status is secondary but important: it decides how the visit will go (fees, parking, crowds, light-ups). Illuminations fill December–January, when nothing blooms.

The edge over listing sites is the live status and a map that's pleasant to use, not the listings.

## Scope

v1 has to work with zero users and fit around a day job. Everything deferred depends on users or partners that don't exist yet, or saves time only at a scale that doesn't exist yet.

**In v1**

- **Ibaraki only, 25 hand-picked places** (32 more are listed in the retired staging sheet with `in_v1: no`): the ones with official status updates, plus the rest showing their usual bloom window.
- **Bloom stages, semi-automatic:** a script checks the official pages each day and alerts R when one changes; R confirms the stage. No automatic parsing yet.
- **Festivals and illuminations entered by hand:** festivals for February–May 2027, about 7 illuminations for 2026–27.
- **Web app (installable PWA):** map with ring pins, festival badge, filters, a list, a place page, and a freshness label ("公式 · 2日前" / "例年").
- **Photos:** R's own, the prefecture's photo library (いばらきフォトダウンロード, terms to check), park photos used with permission, and hand-picked Instagram embeds.
- **Japanese and English.**

**Deferred to v2+**

User reports and accounts, push notifications, a forecasting model, an AI auto-repair agent for the watcher, native apps, a park admin page, monetisation, other prefectures, route planning, general events (markets and other non-seasonal events).

## Why the rules are the way they are

**Five stage levels.** Most sources only use three words (咲き始め / 見頃 / 見頃後半), so more in-bloom levels couldn't be filled reliably; five read without a legend; the 見頃 boundary matches how parks and JMA define it (7分, about 80% open). The number of levels is the costly thing to change later, so it's fixed.

**Leaves share the levels and ring colours.** The ring shows the stage, not the plant; the photo shows red or yellow leaves. Kochia counts twice: its green season (July–September) is a bloom planting, its red season (October) a foliage planting. Roses get two windows (spring, autumn).

**Short lead window (14 days).** Showing まもなく months ahead fills the map with grey pins that say nothing. Per-flower lead values can come later if one setting proves wrong.

**No countdowns for flora; countdowns for illuminations.** Bloom start dates move year to year, so a countdown would be a guess presented as a fact. Illumination dates are announced and fixed, so a countdown is honest once they are.

**Freshness limits by stage.** まもなく changes slowly; 咲き始め moves fast toward peak; peaks last about 1–10 days; past peak falls off quickly. Per-species overrides (roses longer, cherry shorter) can come later.

**Thin ring for estimates.** Dashed rings were noisy at pin size; a faded ring is ruled out because a faded 見頃 reads as 咲き始め. Thin keeps the colour and the photo size.

**Illuminations outrank a flower at peak** (changed 25 Nov) during their run: after dark, the light-up is the reason to go.

**Closures belong to the venue, with no rule engine.** A closed park closes its flowers and its lights alike, so one closures block per place. Patterns like 祝日なら翌日 or "2月第1火曜〜金曜" are written out as dates when each season's leaflet is entered, because a runtime rule engine is where silent bugs live. A helper script may suggest the dates from a Japanese holiday library; a person checks them before saving. Upkeep: re-read each venue's leaflet when it's published (about 5–6 venues, roughly 15 minutes a season).

**Featured tie-break in v1.** It may never be used, but the logic is cheap to add now and awkward to retrofit into ranking tests later. Candidates: コキア紅葉 and ネモフィラ at ひたち海浜公園.

**Append-only status log.** It becomes the record of actual peak dates, which is the raw material for a forecasting model in v2. Split by year (`statuses/2027.csv`) only if it grows large.

## Operations

**Daily routine in season (target: under ~15 minutes).**

- One **morning digest** by email or LINE rather than an alert per place.
- **Triggers:** a status goes stale while the place is in season (usual window open, or a forecast says it should be blooming); no update for 3 weeks after the last report; the watcher sees a source page change; a closures block is past its `valid_until`.
- **Each entry shows:** place and flower, last stage and 分咲き figure, days since, source link, and why it's flagged (e.g. "筑波山梅林: no update for 6 days, usually at peak now").
- **R's action:** check the source or the park's social media, then add a status row. If nothing has changed, add a row with the same level and today's date: that confirms it and resets freshness.

**Status dates.** Use the source's own "as of" date, else its publish date, else the watcher's fetch date, and record which.

## Sources and platforms

Official pages stay the main source; social accounts only through official APIs. (The binding rules are in CLAUDE.md.)

- **X:** pay-per-use API ($0.005 per post read; roughly ¥700–2,500 a month at peak for 30–50 accounts, near zero off-season). Before applying, read the Developer Agreement clause on "tracking, alerting, or monitoring" and describe the use case to match.
- **Instagram:** Graph API Business Discovery reads public posts of Business/Creator accounts. Still to confirm it returns caption and timestamp (test one park account in the Graph API Explorer). Needs our own professional account, a Facebook Page and Meta app review.
- **Open question:** whether storing anything from X/Instagram is needed at all. The use would be reading posts and photos to judge stage; only the derived level would be kept.
- **Photo-based stage estimates** (a vision model reading a photo) only on photos we own or are sent: local reporters, later a park admin page. These are stored as `admin` status rows, as are R's own observations.
- **Why not Google Maps photos:** no dates on them, and the Maps Platform terms ban extracting or creating content from them.

## Roadmap

About 9 weeks of build before the plum-season soft launch. Week 1 started 24 Nov 2026. Phases 1–4 overlap; spring is the real test.

### Phase 0 – Decisions (week 1)

- [x] Bloom stage scale, data schema, freshness rules, pin ranking, closures, illuminations (all in CLAUDE.md).
- [x] Repo: https://github.com/JapanSnackUncle/FloraMap (private; set up 25 Nov).
- [x] Working name and domain.

### Phase 1 – Data and core app (weeks 1–4)

The numbered items are CLAUDE.md's "Phase 1: first tasks".

- [x] Place list: 25 v1 places with coordinates, hours, fees, parking (staging sheet).
- [x] Plantings with usual windows from official pages, marked provisional.
- [x] Status sources for the official places.
- [x] Festival editions for February–May 2027, plus 2026–27 illuminations.
- [x] Work through `reference/staging/import-report.md` in the YAML (source coverage, missing URLs and dates). Remaining items wait on announcements or the season.
- [ ] Photos: read the prefecture library's terms, inventory R's own shots, email 3–5 parks for permission.
- [x] 1. Scaffold: Vite + React + TS, ESLint/Prettier, Vitest (25 Nov).
- [x] 2. Import the sheet to YAML, including structured closures (25 Nov). The sheet is retired; `data/` is the master copy.
- [x] 3. `build-data.ts`: validation, private fields stripped, `places.json` (25 Nov).
- [x] 4. `status.ts`: stage, freshness, illumination, closures and pin rules, with tests (25 Nov).
- [ ] 5. Map screen with the places, ring pins, filters, list and place page, using placeholder images.
  - [x] 5.1 Map shell: MapLibre with the local Ibaraki basemap, Japanese labels, OpenStreetMap credit (25 Nov). The view is kept in the address bar (#zoom/lat/lng).
  - [x] 5.2 Plain markers: one dot per place at its coordinates, name on hover (25 Nov). The hover label also shows municipality and coordinates, for checking pins.
  - [x] 5.3 Status wiring and a basic debug bar: date picker, ±1/±7 days, season presets, each place's pin and `why` (25 Nov). The debug date is kept in the address bar (`?date=2027-04-16`); the bar is left out of production builds. Season offset and simulated scraper outage wait until there are real status rows to shift.
  - [x] 5.4 Ring pins: placeholder photo, stage colour, 咲き始め fill, full vs thin ring, gold lit, festival dot, clock badge (25 Nov). HTML markers; all places shown until the filters in 5.5.
  - [x] 5.5 Filters: the five chips, シーズン中 by default (25 Nov). A notice with a すべて表示 button shows when nothing matches.
  - [ ] 5.6 List: visible places with stage, source and age, 分咲き, dates, 本日休園, festival tags.
  - [ ] 5.7 Place page: features in page order, hours, fees, parking, closures, festivals, links; back; empty-map tap clears.
  - [ ] 5.8 Names on the map by zoom with collision, and a 日本語/English toggle. Also when multiple pins overlap excessively on the map, group into a single pin with an indicator on the edge of the pin with the number of pins in the group. Clicking the pin will zoom in the map without popping up details.
  - [ ] 5.9 Phone pass: narrow layout, tested on a phone over Wi-Fi.

### Phase 2 – App complete (weeks 4–6)

- [x] Debug date bar in dev builds, showing why each pin was chosen (done early, in 5.3).
- [ ] Place page: timeline, freshness label, source link, directions button, photo and Instagram embed.
- [ ] English/Japanese toggle; installable as a PWA.
- [ ] Connect the repo to Cloudflare Pages (settings in README.md).
- [ ] Self-host the map's label fonts and icons (now loaded from protomaps.github.io), and put the basemap on Cloudflare R2 (`VITE_TILES_URL`).

### Phase 3 – Status pipeline (weeks 4–7)

- [ ] Watcher for the official sources on a daily schedule, plus the morning digest.
- [ ] Watcher checks: flag a status dated outside its planting's season, or one that would go backwards.
- [x] Validation that stages are in the scale (build-data) and display never goes backwards (status.ts).
- [x] Automatic fallback when a status goes stale (status.ts).

### Phase 4 – Polish and field test (weeks 7–9)

- [ ] Visit 2–3 places to test on a phone outdoors.
- [ ] Attribution, source links, disclaimer ("check official site"), privacy policy.
- [ ] Privacy-friendly analytics (e.g. Plausible or Cloudflare Web Analytics).

### Phase 5 – Soft launch for plum season (late January / February)

- [ ] Live for Mito, Tsukuba-san and other plum places; Koga peaches in March.
- [ ] Run the update routine daily (about 10 minutes a day in season).
- [ ] Optional: a video to bring in first users.

### Phase 6 – Spring peak (late March to May)

- [ ] Cherry, nemophila, azalea, roses: the highest-traffic test.
- [ ] Contact parks with a live product to show (starts the v2 park admin page).
- [ ] Decide on v2 from the numbers.

## Ideas parked for later

Not v1 unless a real place needs it.

- **Map:** smaller ring pins or clusters when zoomed out; the pin photo switching to the leading flower (needs a photo per planting); check partial arcs are readable at pin size; photo points at the best viewing spots.
- **Closures:** a 明日休園 pill the day before.
- **Stages:** per-flower LEAD values; per-species freshness limits; official vs user report conflicts (v2, once user reports exist).
- **Data:** the 32 `in_v1: no` places; 桜川市総合運動公園 and SAKURAフェスティバル (parked: no plantings); general events via the `kind` field; other prefectures (the folder layout is ready for them).

## Success metrics and risk

- **Freshness:** at least 90% of in-season official places updated within 48 hours.
- **Usage:** weekly users at peak, taps through to directions, return visits.
- **Workload:** in-season upkeep stays under about 15 minutes a day. If it doesn't, automation moves up in v2.

**Biggest risk:** 9 weeks is tight alongside a day job. If it slips, drop the plum launch and aim for **nemophila in early April**, the date that matters most, since April is Hitachi Seaside's peak month.
