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

User reports and accounts, push notifications, a forecasting model, an AI auto-repair agent for the watcher, native apps, a park admin page, monetization, other prefectures, route planning, general events (markets and other non-seasonal events).

## Why the rules are the way they are

**Five stage levels.** Most sources only use three words (咲き始め / 見頃 / 見頃後半), so more in-bloom levels couldn't be filled reliably; five read without a legend; the 見頃 boundary matches how parks and JMA define it (7分, about 80% open). The number of levels is the costly thing to change later, so it's fixed.

**Leaves (i.e. autumn leaves) share the levels and ring colors.** As with flowers, the ring shows the stage, the photo shows red or yellow leaves. Kochia is two species: `kochia-green` (summer, bloom labels) and `kochia-red` (October, leaf labels). Roses get two windows (spring, autumn).

**Short lead window (14 days).** Showing まもなく months ahead fills the map with grey pins that say nothing. Per-flower lead values can come later if one setting proves wrong.

**No countdowns for flora; countdowns for illuminations.** Bloom start dates move year to year, so a countdown would be a guess presented as a fact. Illumination dates are announced and fixed, so a countdown is honest once they are.

**Freshness limits by stage.** まもなく changes slowly; 咲き始め moves fast toward peak; peaks last about 1–10 days; past peak falls off quickly. Per-species overrides (roses longer, cherry shorter) can come later.

**One ring width; confirmed vs estimate on the place page** (changed 26 Nov). At first estimates had a thin ring (dashed was noisy at pin size; faded is ruled out because a faded 見頃 reads as 咲き始め). In use the two widths didn't read as a meaning on the map, and pins of two sizes looked uneven, so every ring is now 3 px and the place page says whether each status is confirmed or an estimate. Cost: the map alone no longer shows which pins are backed by a report.

**Illuminations outrank a flower at peak** (changed 25 Nov) during their run: after dark, the light-up is the reason to go.

**Closures belong to the venue, with no rule engine.** A closed park closes its flowers and its lights alike, so one closures block per place. Patterns like 祝日なら翌日 or "2月第1火曜〜金曜" are written out as dates when each season's leaflet is entered, because a runtime rule engine is where silent bugs live. A helper script may suggest the dates from a Japanese holiday library; a person checks them before saving. Upkeep: re-read each venue's leaflet when it's published (about 5–6 venues, roughly 15 minutes a season).

**Featured-species tie-break in v1.** It may never be used, but the logic is cheap to add now and awkward to retrofit into ranking tests later. Candidates: コキア紅葉 and ネモフィラ at ひたち海浜公園.

**Append-only status log.** It becomes the record of actual peak dates, which is the raw material for a forecasting model in v2. Split by year (`statuses/2027.csv`) only if it grows large.

## Operations

**Daily routine in season (target: under ~15 minutes).**

- One **morning digest** by email or LINE rather than an alert per place. (preferably via Claude somehow?)
- **Triggers:** a status goes stale while the place is in season (usual window open, or a forecast says it should be blooming); no update for 3 weeks after the last report; the watcher sees a source page change; a closures block is past its `valid_until`.
- **Each entry shows:** place and flower, last stage and 分咲き figure, days since, source link, and why it's flagged (e.g. "筑波山梅林: no update for 6 days, usually at peak now").
- **R's action:** check the source or the park's social media, then add a status row. If nothing has changed, add a row with the same level and today's date: that confirms it and resets freshness.

**Status dates.** Use the source's own "as of" date, else its publish date, else the watcher's fetch date, and record which.

## Sources and platforms

Official pages stay the main source; social accounts only through official APIs. (The binding rules are in CLAUDE.md.)

- **X:** pay-per-use API ($0.005 per post read; roughly ¥700–2,500 a month at peak for 30–50 accounts, near zero off-season). Before applying, read the Developer Agreement clause on "tracking, alerting, or monitoring" and describe the use case to match.
- **Instagram:** Graph API Business Discovery reads public posts of Business/Creator accounts. Still to confirm it returns caption and timestamp (test one park account in the Graph API Explorer). Needs our own professional account, a Facebook Page and Meta app review.
- **Open question:** whether storing anything from X/Instagram is needed at all. The use would be reading posts and photos to judge stage; only the derived level would be kept.
- **Photo-based stage estimates** (a vision model reading a photo) only on photos we own or are sent: local reporters, later a park admin page. These are stored as `admin` status rows, as are R's own observations. I don't see why a vision model can't be used on a photo that R manually pulls from social media. Essentially, it's the same as R making a judgment based on the photo, which seems legal.
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
  - [x] 5.6 List: visible places with stage, source and age, 分咲き, dates, 本日休園, festival tags.
  - [x] 5.7 Place page: features in page order, hours, fees, parking, closures, festivals, links; back; empty-map tap clears.
  - [x] 5.8 Names on the map by zoom with collision. Also when multiple pins overlap excessively on the map, group into a single pin (showing the marquee Place) with an indicator on the edge of the pin with the number of pins in the group. Clicking the pin will zoom in the map without popping up details.
    - Decided 26 Nov (grill-me; rules in CLAUDE.md, Map UI). Why: the threshold is one pin width (54 px; first set to 40, which left split pins three-quarters overlapped), so pins merge once they cover each other by about half and split when they only touch; it's one constant so it can be tuned. The selected place breaks out of its group because opening a place never moves the map, so its pin must stay visible. Names have no zoom floor: one collision rule with rank priority already thins them when zoomed out. The festival dot shows on a group so you know to zoom in; the clock badge doesn't, because it belongs to one planting's forecast. Tapping zooms only to the split level, so each tap goes one step deeper. The group hover says "+N件" so it's clear a click zooms in instead of opening the shown place.
    - Build notes: MapLibre GeoJSON clustering and a symbol layer for names; ring pins stay HTML markers, and each point reserves its pin's area so names avoid pins. The closest pair (平和通り / 日立シビックセンター, 170 m) splits around zoom 15, hence no grouping above 16. No split animation in v1.
    - 27 Nov: grouping switched from our own greedy rule (best pin takes everything within 54 px of itself) to MapLibre's built-in clustering. The greedy rule let a place jump groups when zooming (弘道館 left 偕楽園 for ひたち海浜公園, a 2-2 split); chaining overlapping pins was rejected because a dense area (Tokyo) would merge into one huge group. MapLibre builds groups from the zoomed-in level outwards, so groups only merge. Cost: groups change at whole zoom levels only, so just below a level they can be up to twice as spread out as needed. R then lowered the radius from 54 to 45: pins may overlap slightly, but groups don't form as early at quarter and half zoom steps, which looked jarring.
  - [ ] 5.9 Phone pass: Not side-by-side, list and place page below like Google Maps and https://platinumaps.jp/d/kyoto-smart-navi
    - Decided 26 Nov (grill-me; rules in CLAUDE.md, Phone layout). Why: three heights cover "looking at the map" (peek), "browsing the list near here" (half) and "reading" (full) without a toggle. The whole sheet drags because that's what phone users try first; handle-only feels broken. The title bar goes because title + chips took 96 px of a 667 px iPhone SE screen. The list counts the whole map screen so it doesn't reshuffle on every drag, and still works at full height when the map is hidden. Phones break "opening never moves the map": on a phone the half sheet would cover a pin tapped in the lower half, so the map pans like Google Maps, but only when the pin is covered or near an edge, so a clearly visible pin doesn't jump. Desktop keeps the old rule (Google Maps desktop doesn't move either). Start at peek: map first. Closing returns to the earlier height so browsing pin by pin from peek doesn't mean dragging down after each place.
    - Build notes: phone breakpoint 768 px, so a phone held sideways (~844 px) keeps the side panel. Centring and panning use MapLibre's `padding` equal to the sheet's height. A `?place=` link opens at half, centred in the uncovered area at about zoom 12. The debug bar folds into a small toggle on phones. Not yet decided: where the language switch ends up (5.10; for now at the end of the chip row).
    - Changed 26 Nov, after using it: the list no longer rests at half (to browse it you pull it to full anyway; a place page at half is still useful, since the map shows above it). A page lowered to peek now closes to the list at peek, not to the list's earlier height: lowering it says "I'm looking at the map", so a full list popping up got in the way. Considered and not built yet: keeping the list's scroll position across opening a place (it resets to the top).
    - Also 26 Nov: the page header has room for two buttons, so a page opened from the list shows both 一覧に戻る (left) and 閉じる (right), and the user picks list or map instead of the app guessing; from a pin there's no list to go back to, so only 閉じる. The full list gets 閉じる too (on the count line's row, not a row of its own), since it hides the map and there was no obvious way back to it except dragging. A map tap on an open page now closes to peek: tapping the map means "I'm looking at the map", the same reason as lowering the page.
  - [ ] 5.10 English/Japanese language switcher
- [ ] 6. Other to-do items regarding the map (UI, display, logic, data) that I need to think about
  - [ ] 6.1 List order logic. Ending soon sinks to bottom for everything, which makes sense for blooms. But for fixed events like illuminations, ending soon is a reason to go now. Also, the order does not care about confirmed events vs projections. 11/26: it seems like active illuminations are always on top now, no matter what. 
  - [ ] 6.2 Pin border legend (stage, illumination, etc)
  - [ ] 6.3 Small visual issue: when de-selecting a pin, the pin's text and background disappear, and then the text reappears if nothing is colliding with it. But I would like this the other way: disappear the background, but not the text, and then if the text is colliding with something, disappear the text. Small visual change but it makes it more smooth.
  - [ ] 6.4 偕楽園 has 桜 listed, but it's not in the park proper. It's outside of the park, across the train tracks, in a place called 偕楽園 桜山. 
  - [x] 6.5 title above current happenings section (26 Nov: シーズン中, larger than the other section headings)
  - [ ] 6.6 Place page: show whether each feature's status is confirmed or an estimate (the map no longer does: every ring is 3 px since 26 Nov)

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
- [ ] Add more blooms for less crowded seasons, like chrysanthemum in the fall.

## Ideas parked for later

Not v1 unless a real place needs it.

- **Closures:** a 明日休園 pill the day before.
- **Stages:** per-flower LEAD values; per-species freshness limits; official vs user report conflicts (v2, once user reports exist).
- **Data:** the 32 `in_v1: no` places; 桜川市総合運動公園 and SAKURAフェスティバル (parked: no plantings); general events via the `kind` field; other prefectures (the folder layout is ready for them).
- **Look-ahead**: similar to the debug mode, users can select a date in the future, up to a reasonable limit (couple weeks to a month), to see what's happening on that date. UI will indicate that blooms are predictions.

## Success metrics and risk

- **Freshness:** at least 90% of in-season official places updated within 48 hours.
- **Usage:** weekly users at peak, taps through to directions, return visits.
- **Workload:** in-season upkeep stays under about 15 minutes a day. If it doesn't, automation moves up in v2.

**Biggest risk:** 9 weeks is tight alongside a day job. If it slips, drop the plum launch and aim for **nemophila in early April**, the date that matters most, since April is Hitachi Seaside's peak month.
