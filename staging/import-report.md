# Data to-do list

Started as the import report (2026-11-25, `scripts/import-sheet.py`: 25 places, 45 plantings, 7 illuminations, 18 festivals, 12 sources, 23 species). Fix items in `data/` and tick them here.

## Done 2026-11-25

- [x] Source coverage trimmed: `mito-kanko-ume` → 梅 only; `itako-ayame-status` → 花菖蒲 only (it doesn't report アヤメ/カキツバタ separately); `sakuragawa-kanko-ajisai` → アジサイ only; `shimotsuma-kankou-kokaigawa` → ポピー, コスモス.
- [x] `hitachi-seaside-forecast`: old URL was a 404; now the park's 現在の花情報 page.
- [x] ひたち海浜公園 windows from the park's official flower calendars: 梅 01-3–03-2, ポピー 05-2–05-3, バラ 05-2–06-1 and 10-3–11-1, コキア緑 08-2–09-3, コキア紅葉 10-1–10-3, コスモス confirmed.
- [x] Official URLs: 常陸風土記の丘 (hitachifudoki.jp), 弘道館 (kodokan-ibaraki.jp), きらくやま (つくばみらい市観光協会).
- [x] 弘道館: hours corrected (16:30 closing runs to 2/19, not 2/10); closures 12/29–31.
- [x] 常陸風土記の丘: hours and closed days added; they apply to paid areas only, so no closures block.
- [x] きらくやま: closures source and holiday shifts to 2027-03-31.
- [x] フラワーパーク: closed days from the official calendar to 2027-03-31.
- [x] Festival dates: 福岡堰 2026 (4/3–4/7); 竜神峡 2026 (11/1–11/30, on now); 桜川の桜まつり 2026 confirmed (3/5–4/25) and linked to 雨引観音's cherries too; あじさい祭 (雨引観音) fee and light-up.

## Needs R

- [ ] **Remove two sources?** `pref-syun` is a one-off 2026 article, not a running status page. `sakuragawa-kanko-ajisai` is a festival page with no dated status.
- [ ] **Two candidate sources found** (new sources need R's OK): 弘道館's own 見頃情報 (kodokan-ibaraki.jp) for `kodokan-ume`; 桜川市観光協会's 桜の開花状況 page for 桜川's cherries.
- [ ] **ひたち海浜公園 芝桜** isn't on the park's official flower calendars: keep, or drop the planting?
- [ ] **Rename `hitachi-seaside-forecast`** to e.g. `hitachi-seaside-flower-info` now that its URL changed (IDs aren't live yet).

## Still open (fill when known)

- [ ] きらくやま 2026–27 illumination dates (not announced).
- [ ] きらくやま closures after 2027-03-31 (5/3 holiday → 5/4 is also a holiday; rule unclear).
- [ ] フラワーパーク closures after 2027-03-31 (calendar shows none for April–June yet).
- [ ] Status sources still to find: 古河桃まつり (`koga-kanko-momo`), 水戸の桜まつり (`mito-kanko-sakura`).
- [ ] Status sources to check in season: フラワーパーク アジサイ/ヒマワリ/河津桜 posts; 下妻 site didn't load.
- [ ] 2026 dates not found: 春バラ (フラワーパーク: bloom page only, no event range), フラワリング (ひたち海浜公園), あじさい祭り (北茨城: start 6/13, no end found).
- [ ] 2027 festival dates: none announced yet except 水戸の梅まつり (2/11–3/22). Check from January.
- [ ] ダイゴライト 2025-26 hours: not found (low priority; the 2026-27 edition has hours).
- [ ] Illumination-only places (no plantings): hitachi-civic, kasumigaura-park, kawachi-fureai, kirakuyama. Fine as is; listed for awareness.
