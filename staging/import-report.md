# Import report

Generated 2026-11-25 17:23 by scripts/import-sheet.py.

Imported: 25 places, 45 plantings, 7 illuminations, 18 festivals, 12 sources, 23 species.

## Empty fields (fill when known)

- illumination `fukuroda-illumination` 2025-26: no nightly hours
- place `hitachi-fudoki`: `official_url`
- place `ibaraki-flower-park`: closures `valid_until`
- place `kirakuyama`: `official_url`
- place `kirakuyama`: closures `source_url`
- place `kirakuyama`: closures `valid_until`
- illumination `kirakuyama-illumination` 2026-27: dates not announced
- place `kodokan`: `official_url`
- festival `akeno-himawari-matsuri`: akeno-himawari-matsuri-2027 dates not announced
- festival `flower-park-spring-rose`: flower-park-spring-rose-2027 dates not announced
- festival `flower-park-spring-rose`: no dates at all (dates_raw: 2027: 未発表 / 2026: 2026年5月上旬〜6月上旬)
- festival `fukuokazeki-sakura-matsuri`: fukuokazeki-sakura-matsuri-2027 dates not announced
- festival `fukuokazeki-sakura-matsuri`: no dates at all (dates_raw: 2027: 未発表 / 2026: 2026年3月下旬〜4月上旬)
- festival `hitachi-fudoki-sakura-matsuri`: hitachi-fudoki-sakura-matsuri-2027 dates not announced
- festival `hitachi-sakura-matsuri`: hitachi-sakura-matsuri-2027 dates not announced
- festival `hitachi-seaside-flowering`: hitachi-seaside-flowering-2027 dates not announced
- festival `hitachi-seaside-flowering`: no dates at all (dates_raw: 2027: 未発表 / 2026: 未確認（2024年は04-01〜05-31）)
- festival `itako-ayame-matsuri`: itako-ayame-matsuri-2027 dates not announced
- festival `kasama-tsutsuji-matsuri`: kasama-tsutsuji-matsuri-2027 dates not announced
- festival `koga-momo-matsuri`: koga-momo-matsuri-2027 dates not announced
- festival `mito-sakura-matsuri`: mito-sakura-matsuri-2027 dates not announced
- festival `shizumine-yaezakura-matsuri`: shizumine-yaezakura-matsuri-2027 dates not announced
- festival `tsukubasan-ume-matsuri`: tsukubasan-ume-matsuri-2027 dates not announced
- festival `amabiki-ajisai-matsuri`: amabiki-ajisai-matsuri-2027 dates not announced
- festival `kitaibaraki-ajisai-matsuri`: kitaibaraki-ajisai-matsuri-2027 dates not announced
- festival `kitaibaraki-ajisai-matsuri`: no dates at all (dates_raw: 2026: 6/6–7/5 と 6/13–7/6 で掲載が食い違い（公式で確認できず）)
- festival `ryujin-momiji-matsuri`: ryujin-momiji-matsuri-2027 dates not announced
- festival `ryujin-momiji-matsuri`: no dates at all (dates_raw: 2025（第36回）: 11/1–11/30。2026年の情報は未確認)
- festival `hananuki-momiji-matsuri`: hananuki-momiji-matsuri-2027 dates not announced
- festival `sakuragawa-sakura-matsuri`: sakuragawa-sakura-matsuri-2027 dates not announced

## Check

- place `hitachi-civic`: no plantings (illumination only)
- place `kasumigaura-park`: no plantings (illumination only)
- place `kawachi-fureai`: no plantings (illumination only)
- place `kirakuyama`: no plantings (illumination only)
- festival `hitachi-seaside-flowering`: next edition is `hitachi-seaside-flowering-2027`, but a 2026 edition may be running now (dates_raw: 2027: 未発表 / 2026: 未確認（2024年は04-01〜05-31）)
- festival `ryujin-momiji-matsuri`: next edition is `ryujin-momiji-matsuri-2027`, but a 2026 edition may be running now (dates_raw: 2025（第36回）: 11/1–11/30。2026年の情報は未確認)
- source `pref-syun`: covers no v1 planting (place_ids: `None`)

## Source coverage (trim to what each source actually reports)

- `hitachi-seaside-forecast` (国営ひたち海浜公園（全花）): hitachi-seaside-cosmos, hitachi-seaside-kochia-green, hitachi-seaside-kochia-red, hitachi-seaside-narcissus, hitachi-seaside-nemophila, hitachi-seaside-poppy, hitachi-seaside-rose, hitachi-seaside-shibazakura, hitachi-seaside-sunflower, hitachi-seaside-tulip, hitachi-seaside-ume
- `mito-kanko-ume` (水戸の梅まつり（偕楽園・弘道館）): kairakuen-azalea, kairakuen-hagi, kairakuen-momiji, kairakuen-sakura, kairakuen-ume, kodokan-ume
- `flowerpark-news` (いばらきフラワーパーク): ibaraki-flower-park-hydrangea, ibaraki-flower-park-kawazu-zakura, ibaraki-flower-park-rose, ibaraki-flower-park-sunflower
- `itako-ayame-status` (水郷潮来あやめまつり): itako-ayame-ayame, itako-ayame-hanashobu, itako-ayame-kakitsubata
- `sakuragawa-kanko-ajisai` (雨引観音 あじさい祭): amabiki-kannon-hydrangea, amabiki-kannon-kawazu-zakura, amabiki-kannon-sakura
- `shimotsuma-kankou-kokaigawa` (小貝川ふれあい公園（ポピー・コスモス）): kokaigawa-fureai-cosmos, kokaigawa-fureai-nanohana, kokaigawa-fureai-poppy

## Skipped

- source `koga-kanko-momo`: no URL
- source `mito-kanko-sakura`: no URL

## Open issues in the sheet

- #61 Illuminations `kirakuyama-illumination` from: 2026–27 dates not announced. Last season's dates are in last_season_from/to; fill from/to when announced.
- #78 Sources `koga-kanko-momo` url: Status page still to find.
- #83 Sources `mito-kanko-sakura` url: Status page still to find.
- #87 Festivals `sakuragawa-sakura-matsuri` dates_raw: New festival row: dates not found yet (check the official page).
