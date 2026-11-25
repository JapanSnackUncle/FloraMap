"""One-off: reference/draft-list.xlsx -> staging/draft-list-clean.xlsx.

Restructures the draft sheet into one tab per record type (Places, Plantings,
Illuminations, Illumination hours, Festivals, Sources, lookups) keyed by ID,
converts what converts cleanly, keeps the original wording beside every
converted value, and lists everything else in an Issues tab for R to fix by
hand. Nothing is guessed: unclear values stay blank.

The clean sheet is a staging step. Once its Issues are resolved, the importer
turns it into data/ YAML and the sheet is retired.

Usage:  python scripts/build-clean-sheet.py [--force]
Refuses to overwrite an existing output (it may hold hand edits) unless --force.
"""

import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean_sheet  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "reference" / "draft-list.xlsx"
OUT = ROOT / "staging" / "draft-list-clean.xlsx"

PREFECTURE = "ibaraki"

# ---------------------------------------------------------------- lookups

MUNICIPALITIES = {
    "水戸市": "mito", "ひたちなか市": "hitachinaka", "つくば市": "tsukuba",
    "石岡市": "ishioka", "古河市": "koga", "笠間市": "kasama", "潮来市": "itako",
    "桜川市": "sakuragawa", "北茨城市": "kitaibaraki", "那珂市": "naka",
    "つくばみらい市": "tsukubamirai", "日立市": "hitachi", "下妻市": "shimotsuma",
    "筑西市": "chikusei", "大子町": "daigo", "常陸太田市": "hitachiota",
    "高萩市": "takahagi", "河内町": "kawachi", "土浦市": "tsuchiura",
    "茨城町": "ibaraki-machi", "東海村": "tokai", "常陸大宮市": "hitachiomiya",
    "牛久市": "ushiku", "結城市": "yuki", "行方市": "namegata",
    "稲敷市": "inashiki", "鹿嶋市": "kashima",
}

# type_id, name_ja, name_en, default kind
FLOWER_TYPES = [
    ("ume", "梅", "Plum", "bloom"),
    ("sakura", "桜", "Cherry blossom", "bloom"),
    ("hanamomo", "ハナモモ", "Flowering peach", "bloom"),
    ("nanohana", "菜の花", "Rapeseed", "bloom"),
    ("narcissus", "スイセン", "Daffodil", "bloom"),
    ("tulip", "チューリップ", "Tulip", "bloom"),
    ("nemophila", "ネモフィラ", "Nemophila", "bloom"),
    ("shibazakura", "芝桜", "Moss phlox", "bloom"),
    ("azalea", "ツツジ", "Azalea", "bloom"),
    ("wisteria", "藤", "Wisteria", "bloom"),
    ("peony", "ボタン", "Tree peony", "bloom"),
    ("poppy", "ポピー", "Poppy", "bloom"),
    ("rose", "バラ", "Rose", "bloom"),
    ("iris", "花菖蒲・アヤメ類", "Iris", "bloom"),
    ("hydrangea", "アジサイ", "Hydrangea", "bloom"),
    ("lotus", "ハス", "Lotus", "bloom"),
    ("sunflower", "ヒマワリ", "Sunflower", "bloom"),
    ("hagi", "萩", "Bush clover", "bloom"),
    ("cosmos", "コスモス", "Cosmos", "bloom"),
    ("hamanasu", "ハマナス", "Beach rose", "bloom"),
    ("kochia", "コキア", "Kochia", "bloom"),
    ("momiji", "紅葉", "Autumn leaves", "foliage"),
    ("ginkgo", "イチョウ", "Ginkgo", "foliage"),
]

# raw flower text -> (type, variety, kind, planting-id suffix, window slot)
FLOWERS = {
    "梅": ("ume", "", "bloom", "ume", 1),
    "スイセン": ("narcissus", "", "bloom", "narcissus", 1),
    "チューリップ": ("tulip", "", "bloom", "tulip", 1),
    "ネモフィラ": ("nemophila", "", "bloom", "nemophila", 1),
    "芝桜": ("shibazakura", "", "bloom", "shibazakura", 1),
    "ポピー": ("poppy", "", "bloom", "poppy", 1),
    "バラ": ("rose", "", "bloom", "rose", 1),
    "バラ（春）": ("rose", "", "bloom", "rose", 1),
    "バラ（秋）": ("rose", "", "bloom", "rose", 2),
    "ヒマワリ": ("sunflower", "", "bloom", "sunflower", 1),
    "ヒマワリ（八重）": ("sunflower", "八重", "bloom", "sunflower", 1),
    "ヒマワリ（晩秋）": ("sunflower", "晩秋", "bloom", "sunflower", 1),
    "コキア（緑）": ("kochia", "緑", "bloom", "kochia-green", 1),
    "コキア（紅葉）": ("kochia", "紅葉", "foliage", "kochia-red", 1),
    "コスモス": ("cosmos", "", "bloom", "cosmos", 1),
    "ツツジ": ("azalea", "", "bloom", "azalea", 1),
    "萩": ("hagi", "", "bloom", "hagi", 1),
    "紅葉": ("momiji", "", "foliage", "momiji", 1),
    "桜": ("sakura", "", "bloom", "sakura", 1),
    "イチョウ": ("ginkgo", "", "foliage", "ginkgo", 1),
    "アジサイ": ("hydrangea", "", "bloom", "hydrangea", 1),
    "ボタン": ("peony", "", "bloom", "peony", 1),
    "河津桜": ("sakura", "河津桜", "bloom", "kawazu-zakura", 1),
    "桜（ソメイヨシノ・シダレ・ボタン）": ("sakura", "ソメイヨシノ・シダレ・ボタン", "bloom", "sakura", 1),
    "ハナモモ": ("hanamomo", "", "bloom", "hanamomo", 1),
    "大賀ハス": ("lotus", "大賀ハス", "bloom", "lotus", 1),
    "藤": ("wisteria", "", "bloom", "wisteria", 1),
    "花菖蒲": ("iris", "花菖蒲", "bloom", "hanashobu", 1),
    "アヤメ": ("iris", "アヤメ", "bloom", "ayame", 1),
    "カキツバタ": ("iris", "カキツバタ", "bloom", "kakitsubata", 1),
    "ヤマザクラ": ("sakura", "ヤマザクラ", "bloom", "yamazakura", 1),
    "八重桜": ("sakura", "八重桜", "bloom", "yaezakura", 1),
    "シダレザクラ": ("sakura", "シダレザクラ", "bloom", "shidarezakura", 1),
    "菜の花": ("nanohana", "", "bloom", "nanohana", 1),
    "ハマナス": ("hamanasu", "", "bloom", "hamanasu", 1),
    "桜（河津桜〜八重桜）": ("sakura", "河津桜〜八重桜", "bloom", "sakura", 1),
}

# Spots-tab names that differ from the Spot details name of the same place
PLACE_ALIASES = {
    "古河公方公園": "koga-kubo-park",
    "竜神峡・竜神大吊橋": "ryujin-otsuribashi",
    "偕楽園（もみじ谷）": "kairakuen",
}

GEOCODE = {"番地": "lot", "街区": "block", "町字（概略）": "approximate"}

# Domains treated as official (publisher of the place/festival, or government)
OFFICIAL_DOMAINS = (
    "pref.ibaraki.jp", "hitachikaihin.jp", "flowerpark.or.jp", "mitokoumon.com",
    "ibaraki-kairakuen.jp", "umematsuri.jp", "lg.jp", "ktr.mlit.go.jp",
    "kankou-sakuragawa.jp", "daigo-kanko.jp", "kogakanko.com",
)

# Festivals 2027 tab: festival name -> (festival_id, place_ids)
FESTIVALS = {
    "水戸の梅まつり（第131回）": ("mito-ume-matsuri", ["kairakuen", "kodokan"]),
    "筑波山梅まつり": ("tsukubasan-ume-matsuri", ["tsukubasan-bairin"]),
    "古河桃まつり": ("koga-momo-matsuri", ["koga-kubo-park"]),
    "水戸の桜まつり": ("mito-sakura-matsuri", ["senbako"]),
    "福岡堰さくらまつり": ("fukuokazeki-sakura-matsuri", ["fukuokazeki"]),
    "日立さくらまつり（第61回=2026）": ("hitachi-sakura-matsuri", ["heiwa-dori"]),
    "常陸風土記の丘・さくらまつり": ("hitachi-fudoki-sakura-matsuri", ["hitachi-fudoki"]),
    "八重桜まつり": ("shizumine-yaezakura-matsuri", ["shizumine"]),
    "SAKURAフェスティバル（桜川市）": ("sakuragawa-sakura-festival", []),
    "笠間つつじまつり": ("kasama-tsutsuji-matsuri", ["kasama-tsutsuji"]),
    "フラワリング（春のフラワーリレー）": ("hitachi-seaside-flowering", ["hitachi-seaside"]),
    "春バラに魅せられる時間": ("flower-park-spring-rose", ["ibaraki-flower-park"]),
    "水郷潮来あやめまつり（第75回=2026）": ("itako-ayame-matsuri", ["itako-ayame"]),
}

# Spots-tab "Festival" text at a place -> festival_id (only where it is the same event)
PLANTING_FESTIVAL = {
    ("kairakuen", "水戸の梅まつり"): "mito-ume-matsuri",
    ("kodokan", "水戸の梅まつり"): "mito-ume-matsuri",
    ("tsukubasan-bairin", "筑波山梅まつり"): "tsukubasan-ume-matsuri",
    ("koga-kubo-park", "古河桃まつり"): "koga-momo-matsuri",
    ("senbako", "水戸の桜まつり"): "mito-sakura-matsuri",
    ("fukuokazeki", "福岡堰さくらまつり"): "fukuokazeki-sakura-matsuri",
    ("heiwa-dori", "日立さくらまつり"): "hitachi-sakura-matsuri",
    ("hitachi-fudoki", "さくらまつり"): "hitachi-fudoki-sakura-matsuri",
    ("shizumine", "八重桜まつり"): "shizumine-yaezakura-matsuri",
    ("kasama-tsutsuji", "笠間つつじまつり"): "kasama-tsutsuji-matsuri",
    ("hitachi-seaside", "フラワリング"): "hitachi-seaside-flowering",
    ("ibaraki-flower-park", "春バラに魅せられる時間"): "flower-park-spring-rose",
    ("itako-ayame", "水郷潮来あやめまつり"): "itako-ayame-matsuri",
}

# Status sources tab, by row order -> (source_id, place_ids it covers)
SOURCES = [
    ("hitachi-seaside-forecast", ["hitachi-seaside"]),
    ("mito-kanko-ume", ["kairakuen", "kodokan"]),
    ("tsukubasan-umematsuri", ["tsukubasan-bairin"]),
    ("flowerpark-news", ["ibaraki-flower-park"]),
    ("koga-kanko-momo", ["koga-kubo-park"]),
    ("pref-syun", []),
    ("kasama-tsutsuji-status", ["kasama-tsutsuji"]),
    ("itako-ayame-status", ["itako-ayame"]),
    ("sakuragawa-kanko-ajisai", ["amabiki-kannon"]),
    ("kitaibaraki-ajisai-status", ["kitaibaraki-ajisai"]),
    ("hitachi-sakura-status", ["heiwa-dori"]),
    ("mito-kanko-sakura", ["senbako"]),
]

# Illuminations, transcribed field by field from the Spot details
# "Illumination 2026–27" column (raw text is kept beside each row).
ILLUMINATIONS = [
    dict(place="ibaraki-flower-park", id="ibaraki-flower-park-illumination",
         name="Moonlight Rose Garden 2026", frm="2026-10-10", to="2027-01-24", announced=True,
         closed_weekdays="tue",
         closed_dates="2026-11-04, 2026-11-25..2026-11-27, 2026-12-30..2027-01-01",
         open_dates="2026-11-03, 2026-12-29", fee="入園料必要",
         notes="第1部 10/10–11/23、第2部 11/28–1/24",
         hours=[("2026-10-10", "2027-01-24", "17:00–20:30", "")]),
    dict(place="fukuroda", id="fukuroda-illumination",
         name="大子来人〜ダイゴライト〜", announced=False,
         last_frm="2025-11-01", last_to="2026-01-12", fee="観瀑トンネル利用料必要",
         hours=[("2025-11-01", "2025-11-30", "日没–20:00", "last season"),
                ("2025-12-01", "2026-01-12", "日没–19:00", "last season")]),
    dict(place="kawachi-fureai", id="kawachi-fureai-illumination",
         name="かわちイルミネーション2026", frm="2026-11-03", to="2027-02-14", announced=True,
         notes="約50万球",
         hours=[("2026-11-03", "2027-01-12", "17:00–21:00", ""),
                ("2027-01-13", "2027-02-14", "17:30–21:30", "")]),
    dict(place="hitachi-civic", id="hitachi-civic-illumination",
         name="Hitachi Starlight Illumination 2026", frm="2026-11-14", to="2027-01-11",
         announced=True, notes="約17万球",
         hours=[("2026-11-14", "2027-01-11", "16:30–22:00", "")]),
    dict(place="kasumigaura-park", id="kasumigaura-park-illumination",
         name="第15回 光がつくる“Art”水郷桜イルミネーション", frm="2026-11-21", to="2027-01-11",
         announced=True, notes="LED約19万球",
         hours=[("2026-11-21", "2027-01-11", "17:00–21:00", ""),
                ("2026-12-31", "2026-12-31", "21:00–翌6:00", "オールナイト")]),
    dict(place="kirakuyama", id="kirakuyama-illumination",
         name="きらくやまイルミネーション", announced=False,
         last_frm="2025-11-28", last_to="2025-12-25", closed_weekdays="mon",
         notes="雨天休み。約10万球",
         hours=[("2025-11-28", "2025-12-25", "16:30–20:30", "last season")]),
]

# ---------------------------------------------------------------- helpers

THIRD = {"上旬": 1, "初旬": 1, "中旬": 2, "下旬": 3}
WINDOW_RE = re.compile(r"(\d{1,2})月(上旬|中旬|下旬|初旬)(?:〜(?:(\d{1,2})月)?(上旬|中旬|下旬))?")


def parse_window(raw):
    """'4月中旬〜5月上旬' -> ('04-2', '05-1', note). Returns (None, None, note) if unclear."""
    s = (raw or "").strip()
    note = ""
    m = re.fullmatch(r"(.+?)（(.+)）", s)
    if m:
        s, note = m.group(1), m.group(2)
    m = WINDOW_RE.fullmatch(s)
    if not m:
        return None, None, ""
    m1, t1, m2, t2 = m.groups()
    start = f"{int(m1):02d}-{THIRD[t1]}"
    if t2:
        end = f"{int(m2 or m1):02d}-{THIRD[t2]}"
    else:
        end = start
    return start, end, note


def split_urls(raw):
    official, other = [], []
    for u in (raw or "").split("\n"):
        u = u.strip()
        if not u:
            continue
        host = urlparse(u).hostname or ""
        (official if any(host == d or host.endswith("." + d) for d in OFFICIAL_DOMAINS) else other).append(u)
    return "\n".join(official), "\n".join(other)


def split_hours(raw):
    hours, closed = [], []
    for part in (raw or "").split("／"):
        part = part.strip()
        if not part:
            continue
        if "休" in part and not re.search(r"\d:\d\d", part):
            closed.append(part)
        else:
            hours.append(part)
    return "／".join(hours), "／".join(closed)


def rows(ws):
    it = ws.iter_rows(values_only=True)
    header = next(it)
    for r in it:
        if any(c is not None for c in r):
            yield dict(zip(header, ("" if c is None else str(c).strip() for c in r)))


# ---------------------------------------------------------------- build

class Book:
    def __init__(self):
        self.wb = openpyxl.Workbook()
        self.wb.remove(self.wb.active)
        self.sheets = {}
        self.issues = []

    def sheet(self, name, columns):
        ws = self.wb.create_sheet(name)
        ws.append(columns)
        self.sheets[name] = (ws, columns)
        return ws

    def add(self, name, record):
        ws, cols = self.sheets[name]
        ws.append([record.get(c, "") for c in cols])
        return ws.max_row

    def issue(self, sheet, row, ref, field, problem, raw=""):
        # Highlights are derived from the Issues tab by clean_sheet.save(); row is unused.
        self.issues.append((sheet, ref, field, problem, raw))


def main():
    if OUT.exists() and "--force" not in sys.argv:
        sys.exit(f"{OUT.relative_to(ROOT)} exists and may hold hand edits. Re-run with --force to overwrite.")

    src = openpyxl.load_workbook(SRC)
    b = Book()

    # ---- Places
    place_cols = ["place_id", "in_v1", "name_ja", "name_en", "name_kana", "prefecture",
                  "municipality", "municipality_slug", "address", "lat", "lng",
                  "geocode_precision", "hours_ja", "closed_ja", "fee_ja", "parking_ja",
                  "official_url", "checked_against", "notes"]
    b.sheet("Places", place_cols)
    places = {}
    name_to_id = dict(PLACE_ALIASES)
    for r in rows(src["Spot details"]):
        pid = r["Spot ID"]
        if pid in places:
            sys.exit(f"duplicate place id in sheet: {pid}")
        hours, closed = split_hours(r["Hours"])
        official, other = split_urls(r["Source URL"])
        rec = dict(place_id=pid, in_v1="yes", name_ja=r["Spot"], prefecture=PREFECTURE,
                   municipality=r["City"], municipality_slug=MUNICIPALITIES.get(r["City"], ""),
                   address=r["Address"], lat=float(r["Lat"]) if r["Lat"] else "",
                   lng=float(r["Lng"]) if r["Lng"] else "",
                   geocode_precision=GEOCODE.get(r["Geocode precision"], ""),
                   hours_ja=hours, closed_ja=closed, fee_ja=r["Fee"], parking_ja=r["Parking"],
                   official_url=official, checked_against=other, illum_raw=r["Illumination 2026–27"])
        places[pid] = rec
        name_to_id[r["Spot"]] = pid

    # Places that appear only in the Spots tab (no details yet): listed, not in v1, no ID yet.
    extra_places = {}
    for r in rows(src["Spots"]):
        n = r["Spot"]
        if n not in name_to_id and n not in extra_places:
            extra_places[n] = dict(place_id="", in_v1="no", name_ja=n, prefecture=PREFECTURE,
                                   municipality=r["City"],
                                   municipality_slug=MUNICIPALITIES.get(r["City"], ""),
                                   notes="Spots tab only: no address, coordinates or details yet")

    for pid, rec in places.items():
        row = b.add("Places", rec)
        if rec["geocode_precision"] == "approximate":
            b.issue("Places", row, pid, "lat, lng", "Coordinates are town-level only (町字). Place the pin by hand at the entrance or main viewing area: fix both lat and lng.")
        if not rec["official_url"]:
            b.issue("Places", row, pid, "official_url", "No official page; hours, fees and parking were taken from an aggregator. Add the official URL and check the values against it.", rec["checked_against"])
        if not rec["municipality_slug"]:
            b.issue("Places", row, pid, "municipality_slug", "Unknown municipality", rec["municipality"])
        if "別資料" in rec["parking_ja"]:
            b.issue("Places", row, pid, "parking_ja", "Two sources disagree on the number of parking spaces.", rec["parking_ja"])
        if re.search(r"20[01]\d年時点", rec["parking_ja"]):
            b.issue("Places", row, pid, "parking_ja", "Parking figure is years old.", rec["parking_ja"])
    for rec in extra_places.values():
        b.add("Places", rec)
    b.issue("Places", None, "(all v1 places)", "name_en", "name_en and name_kana are empty for every place. Fill them in (Japanese name stays the main one).")

    # ---- Plantings
    pl_cols = ["planting_id", "place_id", "in_v1", "place_name_ja", "type", "variety", "kind",
               "window_start", "window_end", "window2_start", "window2_end", "provisional",
               "window_raw", "flower_raw", "official_status", "festival_raw", "festival_id",
               "official_url", "checked_against", "found_on", "notes"]
    b.sheet("Plantings", pl_cols)
    plantings = {}   # planting_id -> record (v1)
    extra_pl = []
    for r in rows(src["Spots"]):
        pid = name_to_id.get(r["Spot"], "")
        ftype, variety, kind, suffix, slot = FLOWERS[r["Flower"]]
        start, end, wnote = parse_window(r["Usual peak"])
        official, other = split_urls(r["Source URL"])
        fest_id = PLANTING_FESTIVAL.get((pid, r["Festival"]), "") if pid else ""
        if not pid:
            extra_pl.append(dict(place_id="", in_v1="no", place_name_ja=r["Spot"], type=ftype,
                                 variety=variety, kind=kind, window_start=start or "",
                                 window_end=end or "", provisional="yes" if start else "",
                                 window_raw=r["Usual peak"], flower_raw=r["Flower"],
                                 official_status=r["Official status"], festival_raw=r["Festival"],
                                 official_url=official, checked_against=other, found_on=r["Found on"],
                                 notes=wnote))
            continue
        plid = f"{pid}-{suffix}"
        rec = plantings.get(plid)
        if rec is None:
            rec = dict(planting_id=plid, place_id=pid, in_v1="yes", place_name_ja=places[pid]["name_ja"],
                       type=ftype, variety=variety, kind=kind, provisional="yes",
                       window_raw="", flower_raw="", official_status=r["Official status"],
                       festival_raw=r["Festival"], festival_id=fest_id, official_url="",
                       checked_against="", found_on="", notes="", _bad=[])
            plantings[plid] = rec
        elif slot == 1:
            sys.exit(f"duplicate planting {plid}")
        k = "" if slot == 1 else "2"
        rec[f"window{k}_start"], rec[f"window{k}_end"] = start or "", end or ""
        join = lambda a, b_: "\n".join(x for x in (a, b_) if x)
        rec["window_raw"] = join(rec["window_raw"], r["Usual peak"] or "(blank)")
        rec["flower_raw"] = join(rec["flower_raw"], r["Flower"])
        rec["official_url"] = join(rec["official_url"], official)
        rec["checked_against"] = join(rec["checked_against"], other)
        rec["found_on"] = join(rec["found_on"], r["Found on"])
        rec["notes"] = join(rec["notes"], wnote)
        if not start:
            rec["_bad"].append((f"window{k}_start", r["Usual peak"]))
        if r["Spot"] == "偕楽園（もみじ谷）":
            rec["notes"] = join(rec["notes"], "もみじ谷")
        if r["Festival"] and not fest_id:
            rec["_unlinked"] = r["Festival"]

    for plid, rec in plantings.items():
        row = b.add("Plantings", rec)
        for field, raw in rec["_bad"]:
            b.issue("Plantings", row, plid, field,
                    "Window is blank or not in 上旬/中旬/下旬 form. Fill in month-third values (e.g. 06-1) from an official page, or leave empty.",
                    raw or "(blank)")
        if "〜" in rec["variety"] or "・" in rec["variety"]:
            b.issue("Plantings", row, plid, "variety",
                    "Several varieties in one row. If they bloom weeks apart, split into separate plantings (e.g. -kawazu-zakura, -yaezakura).",
                    rec["flower_raw"])
        if rec["notes"] == "もみじ谷" or "もみじ谷" in rec["notes"]:
            b.issue("Plantings", row, plid, "place_id",
                    "Sheet listed 偕楽園（もみじ谷） as its own place; merged into kairakuen as a planting. Split it out if もみじ谷 needs its own pin.")
        if rec.get("_unlinked"):
            b.issue("Plantings", row, plid, "festival_id",
                    "Festival named in the Spots tab is not in Festivals 2027 (outside Feb–May, or a different venue). Left unlinked.",
                    rec["_unlinked"])
    for rec in extra_pl:
        b.add("Plantings", rec)

    # ---- Illuminations
    il_cols = ["illumination_id", "place_id", "season", "name_ja", "from", "to", "dates_announced",
               "last_season_from", "last_season_to", "closed_weekdays", "closed_dates",
               "open_dates", "fee_note_ja", "notes", "raw"]
    b.sheet("Illuminations", il_cols)
    b.sheet("Illumination hours", ["illumination_id", "season", "from", "to", "hours_ja", "note"])
    seen = set()
    for il in ILLUMINATIONS:
        p = places.get(il["place"])
        if not p:
            print(f"warning: illumination place {il['place']} no longer in sheet; skipped")
            continue
        seen.add(il["place"])
        row = b.add("Illuminations", {
            "illumination_id": il["id"], "place_id": il["place"], "season": "2026-27",
            "name_ja": il["name"], "from": il.get("frm", ""), "to": il.get("to", ""),
            "dates_announced": "yes" if il["announced"] else "no",
            "last_season_from": il.get("last_frm", ""), "last_season_to": il.get("last_to", ""),
            "closed_weekdays": il.get("closed_weekdays", ""), "closed_dates": il.get("closed_dates", ""),
            "open_dates": il.get("open_dates", ""), "fee_note_ja": il.get("fee", ""),
            "notes": il.get("notes", ""), "raw": p["illum_raw"]})
        if not il["announced"]:
            b.issue("Illuminations", row, il["id"], "from",
                    "2026–27 dates not announced. Last season's dates are in last_season_from/to; fill from/to when announced.")
        for frm, to, hrs, note in il["hours"]:
            b.add("Illumination hours", {"illumination_id": il["id"], "season": "2026-27",
                                         "from": frm, "to": to, "hours_ja": hrs, "note": note})
    for pid, p in places.items():
        if p["illum_raw"] and pid not in seen:
            b.issue("Places", None, pid, "", "Has illumination text that this script does not transcribe. Add it to the script.", p["illum_raw"])
    b.issue("Illumination hours", None, "kasumigaura-park-illumination", "hours_ja",
            "12/31 is 21:00–翌6:00 all-night. Check whether the usual 17:00–21:00 also applies that evening.")

    # ---- Festivals
    fe_cols = ["festival_id", "edition_id", "name_ja", "place_ids", "planting_ids", "flower_raw",
               "from", "to", "dates_announced", "last_year_from", "last_year_to", "dates_raw",
               "fee_ja", "parking_ja", "night_events_ja", "official_url", "checked_against", "notes"]
    b.sheet("Festivals", fe_cols)
    for r in rows(src["Festivals 2027"]):
        fid, pids = FESTIVALS[r["Festival"]]
        m = re.fullmatch(r"(\d{4})-(\d\d-\d\d)〜(\d\d-\d\d)（公式）", r["2027 dates"])
        frm, to = (f"{m[1]}-{m[2]}", f"{m[1]}-{m[3]}") if m else ("", "")
        lm = re.match(r"(\d{4})-(\d\d-\d\d)(?:〜(\d\d-\d\d))?", r["2026 dates (reference)"])
        lfrm, lto = (f"{lm[1]}-{lm[2]}", f"{lm[1]}-{lm[3] or lm[2]}") if lm else ("", "")
        official, other = split_urls(r["Source URL"])
        pls = [k for k, v in plantings.items() if v.get("festival_id") == fid]
        row = b.add("Festivals", dict(
            festival_id=fid, edition_id=f"{fid}-2027", name_ja=re.sub(r"（第\d+回(=2026)?）", "", r["Festival"]),
            place_ids=", ".join(pids), planting_ids=", ".join(pls), flower_raw=r["Flower"],
            **{"from": frm, "to": to}, dates_announced="yes" if m else "no",
            last_year_from=lfrm, last_year_to=lto,
            dates_raw=f"2027: {r['2027 dates']}\n2026: {r['2026 dates (reference)']}",
            fee_ja=r["Fee during festival"], parking_ja=r["Parking during festival"],
            night_events_ja=r["Night events"], official_url=official, checked_against=other,
            notes=r["Spot"] if not pids or "・" in r["Spot"] else ""))
        if not lm:
            b.issue("Festivals", row, fid, "last_year_from", "Last year's dates are not exact; left blank.", r["2026 dates (reference)"])
        if not pids:
            b.issue("Festivals", row, fid, "place_ids", "Venue is not one of the v1 places. Add the venue as a place, or drop this festival.", r["Spot"])
        elif fid == "hitachi-sakura-matsuri":
            b.issue("Festivals", row, fid, "place_ids", "Festival also covers かみね公園 and 十王パノラマ公園, which are not v1 places yet.", r["Spot"])
        if not official:
            b.issue("Festivals", row, fid, "official_url", "No official page; details came from an aggregator.", other)

    # ---- Sources
    so_cols = ["source_id", "name_ja", "publisher", "url", "format", "checked", "place_ids", "notes"]
    b.sheet("Sources", so_cols)
    for (sid, pids), r in zip(SOURCES, rows(src["Status sources"])):
        row = b.add("Sources", dict(source_id=sid, name_ja=r["Spot / festival"], publisher=r["Publisher"],
                                    url=r["Status page URL"], format=r["Format"], checked=r["Checked"],
                                    place_ids=", ".join(pids), notes=r["Notes"]))
        if not r["Status page URL"]:
            b.issue("Sources", row, sid, "url", "Status page still to find.")

    # ---- Lookups
    b.sheet("Flower types", ["type_id", "name_ja", "name_en", "kind"])
    for t in FLOWER_TYPES:
        b.add("Flower types", dict(zip(["type_id", "name_ja", "name_en", "kind"], t)))
    b.sheet("Municipalities", ["prefecture", "municipality", "municipality_slug"])
    for ja, slug in MUNICIPALITIES.items():
        b.add("Municipalities", dict(prefecture=PREFECTURE, municipality=ja, municipality_slug=slug))

    # ---- Issues
    b.sheet("Issues", ["#", "tab", "id", "field", "problem", "raw value", "resolved"])
    for i, (sheet, ref, field, problem, raw) in enumerate(b.issues, 1):
        b.add("Issues", {"#": i, "tab": sheet, "id": ref, "field": field, "problem": problem, "raw value": raw})

    # ---- README (first tab)
    readme = b.wb.create_sheet("README", 0)
    for line in README.strip("\n").split("\n"):
        readme.append([line])

    # Write plain values, then let clean_sheet apply styling, dropdowns and highlights
    # (the same code path used for every later rebuild).
    OUT.parent.mkdir(exist_ok=True)
    b.wb.save(OUT)
    clean_sheet.save(clean_sheet.load(OUT), OUT)
    print(f"wrote {OUT.relative_to(ROOT)}: {len(places)} places (+{len(extra_places)} not in v1), "
          f"{len(plantings)} plantings (+{len(extra_pl)} not in v1), "
          f"{sum(1 for i in ILLUMINATIONS if i['place'] in places)} illuminations, "
          f"{len(FESTIVALS)} festivals, {len(SOURCES)} sources, {len(b.issues)} issues")


README = """
Ibaraki Flora Map: clean staging sheet
Built by scripts/build-clean-sheet.py from reference/draft-list.xlsx. Fix the Issues tab, then the importer turns this into data/ YAML and the sheet is retired.

Tabs
  Places              one row per place. in_v1 = yes for the 25 places with details; 'no' rows are from the Spots tab only (no ID yet).
  Plantings           one row per place × flower (× variety). A rose with spring and autumn seasons is one planting with two windows.
  Illuminations       one row per illumination per season. Illumination hours: nightly hours by date range.
  Festivals           one row per festival edition (2027). place_ids lists every place it covers.
  Sources             status sources the watcher will check.
  Flower types, Municipalities   lookup lists used by the dropdowns.
  Issues              everything that did not convert cleanly. Yellow cells in other tabs are the same items; they clear when resolved = yes. Sorting any tab is safe.

Conventions
  IDs are permanent lowercase slugs. Never rename one once the app is live.
  Windows: month + third, "04-2" = mid-April (1 = 上旬, 2 = 中旬, 3 = 下旬). window_raw keeps the original text.
  provisional = yes until a window is checked against past official data.
  Dates are ISO (2027-02-22), Japan time. Date ranges in closed_dates: 2026-11-25..2026-11-27.
  closed_weekdays: mon, tue, wed, thu, fri, sat, sun (comma-separated).
  Blank means unknown. Never write 未発表, ?, or a guess in a data cell; put it in notes or Issues.
  official_url = the place's or publisher's own page. checked_against = aggregator pages (るるぶ, tenki.jp, Weathernews…): private notes, never shown in the app.

Workflow
  1. Work down the Issues tab. Fix the value in its tab, then write 'yes' in the resolved column.
  2. Leave a cell blank rather than guessing.
  3. When done, the importer reads this file. Re-running build-clean-sheet.py would overwrite your edits (it refuses unless --force).
  4. Claude edits this file with scripts/clean_sheet.py, which rewrites it from its values: your data and row order are kept, manual colours and column widths are not.
"""

if __name__ == "__main__":
    main()
