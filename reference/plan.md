# Ibaraki Flora Map — Immediate, Short, Long-term plan

Started Nov 24, 2026 · @R · reorganised Nov 25, 2026

This is the planning document: goals, roadmap, the reasoning behind decisions, operations, and what's deferred. **The rules themselves (stage scale, visibility, freshness limits, pin ranking, closures, schema, source rules) live in `CLAUDE.md`**, which wins wherever the two disagree. When a decision here becomes a rule, move it to CLAUDE.md and leave only the why here.

## Goal

v1 is a working app in place for the **2027 plum season (late January to February)**, with **spring (cherry, nemophila and azalea, late March to May)** as the real test.

The focus is the plants: bloom status decides whether a place is worth visiting. Festival status is secondary but important: it decides how the visit will go (fees, parking, crowds, light-ups). Illuminations fill December–January, when nothing blooms.

The edge over listing sites is the live status and a map that's pleasant to use, not the listings.

## Scope

v1 has to work with zero users and fit around a day job. Everything deferred depends on users or partners that don't exist yet, or saves time only at a scale that doesn't exist yet.

**In v1**

- **Ibaraki only, 24 hand-picked places** (32 more are listed in the retired staging sheet with `in_v1: no`): the ones with official status updates, plus the rest showing their usual bloom window.
- **Bloom stages, semi-automatic:** a script checks the official pages each day and alerts R when one changes; R confirms the stage. No automatic parsing yet.
- **Festivals and illuminations entered by hand:** festivals for February–May 2027, about 5 illuminations for 2026–27 (park, garden or natural-site light shows only; see 6.15).
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

### Phase 0 – Decisions

- [x] Bloom stage scale, data schema, freshness rules, pin ranking, closures, illuminations (all in CLAUDE.md).
- [x] Repo: https://github.com/JapanSnackUncle/FloraMap (private; set up 25 Nov).
- [x] Working name and domain.

### Phase 1 – Data and core app

The numbered items are CLAUDE.md's "Phase 1: first tasks".

- [x] Place list: 25 v1 places with coordinates, hours, fees, parking (staging sheet).
- [x] Plantings with usual windows from official pages, marked provisional.
- [x] Status sources for the official places.
- [x] Festival editions for February–May 2027, plus 2026–27 illuminations.
- [x] Work through `reference/staging/import-report.md` in the YAML (source coverage, missing URLs and dates). Remaining items wait on announcements or the season.
- [x] Photos: read the prefecture library's terms, inventory R's own shots
- [x] 1. Scaffold: Vite + React + TS, ESLint/Prettier, Vitest (25 Nov).
- [x] 2. Import the sheet to YAML, including structured closures (25 Nov). The sheet is retired; `data/` is the master copy.
- [x] 3. `build-data.ts`: validation, private fields stripped, `places.json` (25 Nov).
- [x] 4. `status.ts`: stage, freshness, illumination, closures and pin rules, with tests (25 Nov).
- [x] 5. Map screen with the places, ring pins, filters, list and place page, using placeholder images.
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
  - [x] 5.9 Phone pass: Not side-by-side, list and place page below like Google Maps and https://platinumaps.jp/d/kyoto-smart-navi
    - Decided 26 Nov (grill-me; rules in CLAUDE.md, Phone layout). Why: three heights cover "looking at the map" (peek), "browsing the list near here" (half) and "reading" (full) without a toggle. The whole sheet drags because that's what phone users try first; handle-only feels broken. The title bar goes because title + chips took 96 px of a 667 px iPhone SE screen. The list counts the whole map screen so it doesn't reshuffle on every drag, and still works at full height when the map is hidden. Phones break "opening never moves the map": on a phone the half sheet would cover a pin tapped in the lower half, so the map pans like Google Maps, but only when the pin is covered or near an edge, so a clearly visible pin doesn't jump. Desktop keeps the old rule (Google Maps desktop doesn't move either). Start at peek: map first. Closing returns to the earlier height so browsing pin by pin from peek doesn't mean dragging down after each place.
    - Build notes: phone breakpoint 768 px, so a phone held sideways (~844 px) keeps the side panel. Centring and panning use MapLibre's `padding` equal to the sheet's height. A `?place=` link opens at half, centred in the uncovered area at about zoom 12. The debug bar folds into a small toggle on phones. Not yet decided: where the language switch ends up (5.10; for now at the end of the chip row).
    - Changed 26 Nov, after using it: the list no longer rests at half (to browse it you pull it to full anyway; a place page at half is still useful, since the map shows above it). A page lowered to peek now closes to the list at peek, not to the list's earlier height: lowering it says "I'm looking at the map", so a full list popping up got in the way. Considered and not built yet: keeping the list's scroll position across opening a place (it resets to the top).
    - Also 26 Nov: the page header has room for two buttons, so a page opened from the list shows both 一覧に戻る (left) and 閉じる (right), and the user picks list or map instead of the app guessing; from a pin there's no list to go back to, so only 閉じる. The full list gets 閉じる too (on the count line's row, not a row of its own), since it hides the map and there was no obvious way back to it except dragging. A map tap on an open page now closes to peek: tapping the map means "I'm looking at the map", the same reason as lowering the page.
  - [x] 5.10 English/Japanese language switcher. 
- [ ] 6. Other to-do items regarding the core app
  - [x] 6.1 List order logic. Ending soon sinks to bottom for everything, which makes sense for blooms. But for fixed events like illuminations, ending soon is a reason to go now. Also, the order does not care about confirmed events vs projections. 11/26: it seems like active illuminations are always on top now, no matter what. 
    - Decided 28 Nov (rule in CLAUDE.md, "Pin choice per place"). The list keeps sharing one order with pin choice, group pins and name collisions, so the list's top row and the map always agree. Reasoning: a visitor wants "worth going now, and can I trust it", so stage comes first and confirmed beats estimate within a stage. A lit illumination is the night-time 見頃, so it shares that tier; in late February a mid-run illumination shouldn't outrank 偕楽園's confirmed ume. End dates were dropped from the order both ways: for blooms they're guesses from the usual window, and for illuminations "ends soon" is better said by a label than by position. Freshness uses the fresh/aging buckets, not exact age (1 vs 2 days means nothing to a visitor); illuminations get no reports, so announced dates count as fresh. A planting with a report beats an illumination on a tie: someone checked the flowers, the illumination is just on schedule (otherwise ID decides, e.g. kairakuen-illumination over kairakuen-momiji only because i < m). Kept: 咲き始め higher % (real report data, matches the ring) and まもなく sooner start ("next up" beats alphabetical).
    - Accepted: while statuses.csv is empty, every announced lit illumination lists above every estimated 見頃, which is the effect noticed on 11/26. It fixes itself as reports come in.
    - Parked: a 終了間近 tag on lit illuminations with announced dates in their last 3 (or 7) days, list and place page only. A popularity/fame tie-break for the 名所 (schema change; ties fall to ID until then).
  - [x] 6.2 Map icon legend (pin borders, coming soon, event happening, etc)
    - 28 Nov: pin look settled first, in the photo tool's Pins tab: まもなく keeps its photo in colour (grey read as finished), 咲き始め a deeper pink #E0457B (the pale pink arc was hard to see), 4 px ring that grows the pin, lit gold #E6B333 with a glow, blue festival dot (orange vanished against autumn rings), paler leaf 見頃過ぎ, clock badge not drawn for now.
    - 28 Nov, legend grilled; rules in CLAUDE.md ("Legend"). Why:
      - 凡例 is the standard word on Japanese maps (地理院地図, hazard maps). Bottom-left because bottom-right has MapLibre's ⓘ credit, and that corner already rides above the phone sheet.
      - Rows show only when in use: the leaves row would be useless ~10 months a year, and in April there's no gold or festival to explain. Judged on the filter, not the screen, so it doesn't change while panning. Whole sequences, because the order is what explains the colours.
      - Labels only: R's call, smallest; the place page carries the detail.
      - Phones: fit to content up to half, so the map stays visible beside the key.
      - Desktop: a card, open on load, so newcomers see it without a click; it stays open while using the map so pins can be compared with it. Not in history: with places opening and closing under it, Back would sometimes close a place and sometimes the card.
    - 28 Nov, after a first look: group pin dropped from the legend (tapping one explains it); desktop card now grows out of the button, its title row gone (278 × 229 px on 11/28 at 1280 × 800); phones lower the sheet with the legend still in it before the list appears.
    - 28 Nov, phones: the floating 凡例 button replaced by tabs on the sheet's count line (一覧 | 凡例), rules in CLAUDE.md. Why: the button sat over pins and repeated 凡例 with the sheet's header; a tab is always visible at peek; no history step because sheet heights aren't in the history either. Dropped: the legend over a place page (a page replaces the tabs; it names every stage in words anyway). × or a map tap always goes to peek; ← and Back return to the tab and height the page was opened from. The last tab stays underlined at peek, and dragging up shows it.
    - Next: R looks at the card's size on desktop and decides what to do after (e.g. whether to pad the opening view so 古河公方公園 and the southwest don't start under it).
    - Parked: a popup on first visit; a row for "no recent info"; an always-on desktop legend that collapses (considered, replaced by the card open on load).
    - Open: what "no recent info" looks like on the map (still grey, which now means over).
  - [x] 6.3 Small visual issue: when de-selecting a pin, the pin's text and text background disappear, and then the text reappears if nothing is colliding with it. But I would like this the other way: disappear the background, but not the text, and then if the text is colliding with something, disappear the text. Small visual change but it makes it more smooth.
  - [x] 6.4 moved to places/plantings todo section
  - [x] 6.5 title above current happenings section (26 Nov: シーズン中, larger than the other section headings)
  - [x] 6.6 confirmed/estimate plantings indicator: moved to status pipeline
  - [x] 6.7 Make the map change language too when the language is switched
  - [x] 6.8 Make loading faster tabled to phase 2
  - [x] 6.9 Single top bar for desktop for title, filters, language
  - [x] 6.10 Aesthetic polishes. Curved edges, subtle drop shadows (Google / Apple Maps as reference)
    - Done 2026-11-28: shadows instead of border lines (`--shadow-edge`, `--shadow-float`), rounded map controls, pink-tint selected chip, inset list dividers, hover/focus states, softer phone sheet.
    - Parked: a floating side panel (Apple Maps style); it would change what "visible map area" means for the list.
    - Second pass 28 Nov: no stage tag on シーズン外 rows (the heading says it), secondary text 11→12 px and status lines 13→14 px, app name at the left of the desktop bar, opening view fitted to the places instead of all of Ibaraki (`START_BOUNDS`), photo arrows 28 px and see-through. Links and practical info moved to the status pipeline.
    - Third pass 28 Nov: stage tags tinted (pale stage colour, dark text: white on 咲き始め pink and 点灯中 gold was hard to read). Count line 「一覧（Nか所）」 / "List (N places)" without the total, which only changed with the filter; か所 instead of 件 because these are places, not search hits (group hover is just "+2" in both languages: the group pin makes the meaning clear there).
  - [x] 6.11 Photo tool: Species tab for species close-ups (`pin_photo` file, license, credit, `crop` circle).
    - Decided 27 Nov (grill-me; rules in CLAUDE.md, Photos). Why: cropping by typing `{ x, y, size }` and rebuilding is guesswork; a circle on the photo shows exactly what the round pin shows. Files are found by name (`<species id>.jpg`), checked by the build, so a hand edit can't point nemophila at tulip.jpg, and the tool needs no file picker. The previews show real-size pins (54 px, 44 px phone) in every stage, because a close-up that reads well large can turn to mush at 44 px or once greyed for まもなく.
    - Parked: planting `pin_photo` overrides in the tool (none exist yet; add when 河津桜 or 八重桜 needs one).
  - [x] 6.12 Clock icon: put the hands in the outer circle, no inner circle
  - [x] 6.13 specs for links that appear on place details: moved to status pipeline
  - [x] 6.14 adjust pin english name aesthetics. 1 line? 2 lines?
    - Decided 2026-11-28 (rule in CLAUDE.md, "Place names"): English names over 16 characters break at a space onto two lines; Japanese stays one line.
    - Why: the old one-line rule existed because MapLibre and the HTML label wrapped differently. Choosing the break in code and giving both the same text removes that, and long English names (up to 28 characters, over 3 pin widths) lost too many collisions on one line. A character count over pixel width because it's deterministic and testable. Shorter line on top so the name widens away from the pin, like its taper.
    - Parked: hand-marked breaks for Japanese names (a schema change), if a real name such as 日立シビックセンター新都市広場 looks bad.
- [x] 6.15 Specs that nail down what is a standalone illumination (gets its own "planting"), and what illuminations are merely attached to events (e.g. 花貫渓谷 紅葉ライトアップ). Also the scope of what illuminations to put. The Hitachi Civic Center illumination has no relation to plants or nature. かわちイルミネーション2026 and 第15回 光がつくる“Art”水郷桜イルミネーション are in parks. もみじ谷　ライトアップ is in an actual place where people go for regular 紅葉 viewing.
    - Decided 2026-11-28 (rules in CLAUDE.md, "What counts as an illumination" and "Illumination scope"): an illumination is a light show whose run outlasts the plants it lights, judged per event; a light-up that ends with its plants is a festival. Only park, garden or natural-site illuminations.
    - Why: a light-up of plants as an illumination outranks its own planting, so 偕楽園 showed a gold pin whatever the leaves were doing, and its dates move with the colouring, so a countdown would be a guess. As a festival it gets the event dot and the planting keeps the stage ring. Judging the whole event keeps one branded event as one thing (Moonlight Rose Garden's rose part and LED part aren't split). City displays fall outside a map of seasonal nature.
    - Changes: もみじ谷 ライトアップ → festival `kairakuen-momiji-lightup`; place `hitachi-civic` removed; Flower Park's gap between parts (11/24–27) was already in its closures, so no logic change.
- [x] 6.16 Bug: on reload, the list starts full and automatically gets pulled down, so we see a brief animation. start with list at peek
### Phase 2 – App complete

- [x] Debug date bar in dev builds, showing why each pin was chosen (done early, in 5.3).
- [ ] Place page: timeline, freshness label, source link, directions button, photo and Instagram embed.
- [ ] English/Japanese toggle; installable as a PWA.
- [x] Self-host the map's label fonts and icons (2026-11-29: `public/basemap/`, see README.md).
- [ ] Make loading faster
	- [x] **Start the map without waiting for `places.json`.** Load both at once. This saves roughly 300–400 ms on every visit. It's a small change.
    - [x] **Fetch hints in `index.html`.** Done 2026-11-29 (`preloadHints` in `vite.config.ts`, builds only): MapLibre's worker script and the opening view's two label fonts now download alongside the app's JavaScript. Measured first: on the test site the worker started only after the JavaScript had run, and the fonts only after the first tiles. Not done: `places.json` (about 0.1 s later than it could start; cheap to add the same way). A "preconnect" for the R2 tiles subdomain may help once it exists (Phase 4).
    - [ ] **A skeleton instead of the white screen.** Put a few lines of CSS and HTML straight into `index.html`: the map's background colour and an empty chip row, or the bottom sheet's grab bar on phones. These show the moment the HTML arrives, before any JavaScript.
    - [ ] **Put the pins on earlier.** At the moment they wait for MapLibre's `load` event, which fires only after every first tile, the 370 KB railway file and the fonts have arrived. They could go on once the style is ready instead. This one is medium effort.
    - [ ] **Service worker (already planned for the PWA).** It saves the app's files on the phone, so later visits skip most of the download and open almost instantly. For repeat visitors this matters more than anything above.

### Phase 3 – Status pipeline

- [ ] Specs for this whole thing, from tracking yaml files for dates to navigating to and searching for,  websites, scraping or interpreting information from the website, writing back to the yaml, keeping a log of everything
- [ ] Statuses and monitoring behavior for events and illuminations (need to flesh out):
	- completed: the event is > N months away. don't check, except for a single check at N months before its typical start date, which will put it into tentative if there is no info, confirmed if there is
	- tentative: no details, but the event is > M months away from its typical start date. check periodically
	- unconfirmed: the even is < M months away from its typical start date, but not confirmed. check frequently
	-  confirmed-notsoon: check less frequently
	-  confirmed-soon: check more frequently
	-  cancelled: stop checks (optional: check sometimes for reinstatement/postponement)
	-  postponed: check regularly for replacement date
- [ ] Statuses and sub-statuses and monitoring behavior for plantings (need to flesh out):
	- out-of-season: don't check
	- soon: either at some time before the typical period, or as determined by a model. check daily
	- starting-to-bloom: check daily
	- peak: check daily
	- past-peak: don't check, switch to out-of-season after some time
	- soon, starting-to-bloom, and peak all get fresh/aging/stale sub-statuses
- [ ] Specs that determine the links that appear for plantings, illuminations, 公式サイト, 開催中のイベント
  - Includes the place page's シーズン外 rows: each repeats the place's official link (ひたち海浜公園: ten identical `hitachikaihin.jp ↗`), which is the loudest thing in that section and duplicates the one under 施設情報. Decide which rows get a link at all. (From 6.10's second pass, 28 Nov.)
- [ ] Finish translating all Japanese text. It's also something for the pipeline as it needs to handle JA -> EN
- [ ] New fields that need to be found and written: dogs allowed (yes or blank (not shown)), disabled parking spaces (yes or blank (not shown))
- [ ] Practical info layout on the place page (施設情報): long values such as ひたち海浜公園's 休業日 run to four dense lines. Decide how hours, closed days and fees are written and laid out once the pipeline writes them. (From 6.10's second pass, 28 Nov.)
- [ ] Watcher for the official sources on a daily schedule, plus the morning digest.
- [ ] Watcher checks: flag a status dated outside its planting's season, or one that would go backwards.
- [ ] Place page: show whether each feature's status is confirmed or an estimate (the map no longer has an indication: every ring is 3 px since 26 Nov). This is here since there are no confirmed planting statuses now, but after this pipeline is done, there will be.
- [x] Validation that stages are in the scale (build-data) and display never goes backwards (status.ts).
- [x] Automatic fallback when a status goes stale (status.ts).

### Phase 4 – Polish and field test 

- [ ] **By early January 2027** (about a month of slack before plum season): set up production hosting. Tabled until then on 2026-11-29; the GitHub Pages test site covers testing meanwhile.
    - New Cloudflare account for this project (not the one hosting R's wife's site): separate billing, free-tier limits and API tokens, and the project can be handed on alone.
    - Buy a domain in that account (Cloudflare Registrar, at cost; no `.jp` there). Before launch, because installed PWAs and shared `?place=` links are tied to the address. No "ibaraki" in the name if other prefectures may come.
    - Connect the repo to Cloudflare Pages (settings in README.md) on that domain.
    - Basemap on Cloudflare R2 (`VITE_TILES_URL`) on a `tiles.` subdomain, with a CORS rule for the app's address (r2.dev is rate-limited and not for production).
- [ ] Once it's running on Cloudflare, test and look at Cloudflare's analytics for performance. Also run own diagnostics. Improve if necessary/practical.
- [ ] Visit 2–3 places to test on a phone outdoors.
- [ ] Attribution, source links, disclaimer ("check official site"), privacy policy.
- [ ] Privacy-friendly analytics (e.g. Plausible or Cloudflare Web Analytics).

### Phase 5 – Soft launch for plum season (late January / February)

- [ ] Live for Mito, Tsukuba-san and other plum places; Koga peaches in March.
- [ ] Social media accounts: X, Instagram
- [ ] Run the update routine daily (about 10 minutes a day in season).
- [ ] Optional: a video to bring in first users.
- [ ] Email individual places about using photos

### Phase 6 – Spring peak (late March to May)

- [ ] Cherry, nemophila, azalea, roses: the highest-traffic test.
- [ ] Contact parks with a live product to show (starts the v2 park admin page).
- [ ] Decide on v2 from the numbers.
- [ ] Add more blooms for less crowded seasons, like chrysanthemum in the fall.

## Places/plantings to add for v1 (not sure )

- [ ] Sairenji 西蓮寺: ginkgo, sakura, red spider lily
- [ ] Kasama Inari Shrine: chrysanthemum, wisteria
- [ ] Kasumigaura park: tulips https://www.city.tsuchiura.lg.jp/kasumigaurasogokoen/ohana-joho/tulip-kaika-jokyo/
- [ ] 偕楽園 has 桜 listed, but it's not in the park proper. It's outside of the park, across the train tracks, in a place called 偕楽園 桜山. 
- [ ] Tsukuba Science Expo Memorial Park: ginkgo, sakura
## Ideas parked for later

Not v1 unless a real place needs it.

- **Stages:** per-flower LEAD values; per-species freshness limits; official vs user report conflicts (v2, once user reports exist).
- **Filters/Menu UI:** Filter by species (drop-down list?), menu, position of language switcher icon
- **Data:** the 32 `in_v1: no` places; 桜川市総合運動公園 and SAKURAフェスティバル (parked: no plantings); general events via the `kind` field; city illuminations (streets, plazas, stations: e.g. ヒタチ スターライト, removed 2026-11-28, in git history); other prefectures (the folder layout is ready for them).
- **Look-ahead**: similar to the debug mode, users can select a date in the future, up to a reasonable limit (couple weeks to a month), to see what's happening on that date. UI will indicate that blooms are predictions.
- **Platforms:** Android and iOS apps
- **In-app search function:** As more places get added, it would be handy for users. Search for places, species, event names
- **Sakura split:** split sakura into different species that have vastly different flowering periods. the main upshot I can think of now is that kawazu, which is a much brigher pink, gets its own icon
- **Agentic place finder/analyzer** Finds places, or if given a place, finds the relevant info so a yaml file of that place and its plantings can be fully written

## Success metrics and risk

- **Freshness:** at least 90% of in-season official places updated within 48 hours.
- **Usage:** weekly users at peak, taps through to directions, return visits.
- **Workload:** in-season upkeep stays under about 15 minutes a day. If it doesn't, automation moves up in v2.

**Biggest risk:** 9 weeks is tight alongside a day job. If it slips, drop the plum launch and aim for **nemophila in early April**, the date that matters most, since April is Hitachi Seaside's peak month.
