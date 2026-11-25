"""One-off: staging/draft-list-clean.xlsx -> data/.

Writes:
  data/places/<prefecture>/<municipality>/<place-id>.yaml
  data/festivals/<prefecture>/<festival-id>.yaml
  data/sources.yaml, data/species.yaml
  data/statuses.csv, data/closures.csv   (headers only, if missing)
  staging/import-report.md                (what didn't map cleanly)

Only rows with in_v1 = yes are imported. Nothing is guessed: empty cells stay
out of the YAML, and anything odd goes in the report.

Usage: python scripts/import-sheet.py [--force]
  --force  overwrite existing YAML files in data/ (CSV logs are never touched).
"""

import datetime as dt
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean_sheet  # noqa: E402

ROOT = clean_sheet.ROOT
DATA = ROOT / "data"
REPORT = ROOT / "staging" / "import-report.md"
SCHEMA_VERSION = 1

report: dict[str, list[str]] = {}


def note(section, msg):
    report.setdefault(section, []).append(msg)


# ---------------------------------------------------------------- YAML output
# PyYAML isn't installed, and the data is simple, so a small emitter is enough.
# Every string that isn't a plain slug is JSON-quoted (valid YAML), so dates,
# windows like "04-2" and Japanese text can't be misread as other types.

SLUG = re.compile(r"^[a-z][a-z0-9-]*$")
RESERVED = {"yes", "no", "true", "false", "null", "on", "off", "y", "n"}


def scalar(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    s = str(v)
    if SLUG.match(s) and s not in RESERVED:
        return s
    return json.dumps(s, ensure_ascii=False)


def emit(v, indent=0):
    pad = "  " * indent
    out = []
    if isinstance(v, dict):
        for k, x in v.items():
            if isinstance(x, dict) and x:
                out.append(f"{pad}{k}:")
                out.extend(emit(x, indent + 1))
            elif isinstance(x, list) and x and all(not isinstance(i, (dict, list)) for i in x):
                out.append(f"{pad}{k}: [{', '.join(scalar(i) for i in x)}]")
            elif isinstance(x, list) and x:
                out.append(f"{pad}{k}:")
                out.extend(emit(x, indent + 1))
            else:
                out.append(f"{pad}{k}: {scalar(x)}")
    elif isinstance(v, list):
        for item in v:
            if isinstance(item, dict):
                lines = emit(item, indent + 1)
                out.append(f"{pad}- {lines[0].lstrip()}")
                out.extend(lines[1:])
            else:
                out.append(f"{pad}- {scalar(item)}")
    return out


def prune(d):
    """Drop empty values so the YAML only holds what we know."""
    if isinstance(d, dict):
        d = {k: prune(v) for k, v in d.items()}
        return {k: v for k, v in d.items() if v not in (None, "", [], {})}
    if isinstance(d, list):
        return [prune(x) for x in d if x not in (None, "", [], {})]
    return d


def write_yaml(path, obj, force):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        raise SystemExit(f"{path.relative_to(ROOT)} exists. Re-run with --force to overwrite.")
    path.write_text("\n".join(emit(prune(obj))) + "\n", encoding="utf-8", newline="\n")


# ---------------------------------------------------------------- parsing

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MD = re.compile(r"^\d{2}-\d{2}$")
WINDOW = re.compile(r"^\d{2}-[123]$")


def lines(v):
    return [x.strip() for x in str(v).split("\n") if x.strip()] if v else []


def ids(v):
    return [x.strip() for x in str(v).split(",") if x.strip()] if v else []


def yes(v):
    return str(v).strip().lower() == "yes" if v else None


def iso(v, where):
    if v is None:
        return None
    s = str(v)
    if not ISO.match(s):
        note("Bad values", f"{where}: `{s}` is not an ISO date; left out")
        return None
    dt.date.fromisoformat(s)
    return s


def expand_dates(v, where):
    """'2026-11-04, 2027-02-01..2027-02-05' -> explicit list of ISO dates."""
    out = []
    for part in ids(v):
        a, _, b = part.partition("..")
        a, b = iso(a, where), iso(b or a, where)
        if not (a and b):
            continue
        d, end = dt.date.fromisoformat(a), dt.date.fromisoformat(b)
        while d <= end:
            out.append(d.isoformat())
            d += dt.timedelta(1)
    return out


def expand_fixed(v, where):
    """'12-31, 01-01' or '12-28..01-04' -> list of MM-DD (ranges may cross the year)."""
    out = []
    for part in ids(v):
        a, _, b = part.partition("..")
        b = b or a
        if not (MD.match(a) and MD.match(b)):
            note("Bad values", f"{where}: fixed date `{part}` is not MM-DD; left out")
            continue
        d = dt.date(2001, int(a[:2]), int(a[3:]))  # any non-leap year
        end = dt.date(2001 if b >= a else 2002, int(b[:2]), int(b[3:]))
        while d <= end:
            out.append(d.strftime("%m-%d"))
            d += dt.timedelta(1)
    return out


def periods(v, where):
    out = []
    for part in ids(v):
        a, _, b = part.partition("..")
        a, b = iso(a, where), iso(b, where)
        if a and b:
            out.append({"from": a, "to": b})
    return out


def window(start, end, where):
    if not (start or end):
        return None
    if not (start and end and WINDOW.match(str(start)) and WINDOW.match(str(end))):
        note("Bad values", f"{where}: window `{start}`–`{end}` is incomplete or not MM-N; left out")
        return None
    return {"start": str(start), "end": str(end)}


def season_of(d):
    """Illumination season label for a date: Nov 2026 and Jan 2027 are both 2026-27."""
    d = dt.date.fromisoformat(d)
    y = d.year if d.month >= 7 else d.year - 1
    return f"{y}-{str(y + 1)[2:]}"


# ---------------------------------------------------------------- import

def main(force):
    tabs = clean_sheet.load()
    v1 = lambda r: r.get("in_v1") == "yes"  # noqa: E731

    places = [r for r in tabs["Places"]["rows"] if r.get("place_id") and v1(r)]
    place_ids = {r["place_id"] for r in places}
    plantings = [r for r in tabs["Plantings"]["rows"]
                 if r.get("planting_id") and v1(r) and r.get("place_id") in place_ids]
    festivals = [r for r in tabs["Festivals"]["rows"] if v1(r)]
    species = {r["species_id"]: r for r in tabs["Species"]["rows"]}

    # Plantings whose place is in v1 but which are marked no (or the reverse) are worth a look.
    for r in tabs["Plantings"]["rows"]:
        if r.get("place_id") in place_ids and not v1(r):
            note("Skipped", f"planting `{r.get('planting_id')}` is in_v1: no at a v1 place")

    # ---- species.yaml
    write_yaml(DATA / "species.yaml", {
        "schema_version": SCHEMA_VERSION,
        "species": [{"id": k, "kind": s.get("kind"), "name_ja": s.get("name_ja"), "name_en": s.get("name_en")}
                    for k, s in species.items()],
    }, force)

    # ---- places
    hours_rows = tabs["Illumination hours"]["rows"]
    for p in places:
        pid = p["place_id"]
        where = f"place `{pid}`"
        for f in ("name_en", "lat", "lng", "official_url"):
            if not p.get(f):
                note("Empty fields (fill when known)", f"{where}: `{f}`")
        if p.get("geocode_precision") not in ("lot", "block", "manual"):
            note("Check", f"{where}: geocode_precision `{p.get('geocode_precision')}`")

        closures = None
        if any(p.get(k) for k in ("closed_weekly", "fixed_dates", "dates_closed", "dates_open", "periods_open")):
            closures = {
                "source_url": p.get("closures_source"),
                "valid_until": iso(p.get("closures_valid_until"), where),
                "weekly": ids(p.get("closed_weekly")),
                "fixed_dates": expand_fixed(p.get("fixed_dates"), where),
                "dates_closed": expand_dates(p.get("dates_closed"), where),
                "dates_open": expand_dates(p.get("dates_open"), where),
                "periods_open": periods(p.get("periods_open"), where),
            }
            for f in ("source_url", "valid_until"):
                if not closures[f]:
                    note("Empty fields (fill when known)", f"{where}: closures `{f}`")

        pl_out = []
        for r in [x for x in plantings if x["place_id"] == pid]:
            w = f"planting `{r['planting_id']}`"
            if r.get("species") not in species:
                note("Bad values", f"{w}: unknown species `{r.get('species')}`")
            elif species[r["species"]].get("kind") not in (r.get("kind"), None) and r["species"] != "kochia":
                note("Check", f"{w}: kind `{r.get('kind')}` but species `{r['species']}` is `{species[r['species']]['kind']}`")
            wins = [x for x in (window(r.get("window_start"), r.get("window_end"), w),
                                window(r.get("window2_start"), r.get("window2_end"), w)) if x]
            if not wins:
                note("Empty fields (fill when known)", f"{w}: no usual window")
            pl_out.append({
                "id": r["planting_id"],
                "kind": r.get("kind"),
                "species": r.get("species"),
                "species_variety": r.get("species_variety"),
                "windows": wins,
                "provisional": yes(r.get("provisional")) if wins else None,
                "window_raw": r.get("window_raw"),
                "official_urls": lines(r.get("official_url")),
                "checked_against": lines(r.get("checked_against")),
                "editor_notes": r.get("notes"),
            })
        if not pl_out:
            note("Check", f"{where}: no plantings (illumination only)")

        il_out = []
        for r in [x for x in tabs["Illuminations"]["rows"] if x.get("place_id") == pid]:
            iid = r["illumination_id"]
            w = f"illumination `{iid}`"
            hrs = [h for h in hours_rows if h.get("illumination_id") == iid]
            editions = []

            def edition(season, frm, to, announced, extra=None):
                ed_hours = [{"from": iso(h.get("from"), w), "to": iso(h.get("to"), w),
                             "hours_ja": h.get("hours_ja"), "note_ja": h.get("note")}
                            for h in hrs if h.get("from") and season_of(h["from"]) == season]
                if frm and not ed_hours:
                    note("Empty fields (fill when known)", f"{w} {season}: no nightly hours")
                editions.append({"season": season, "from": frm, "to": to,
                                 "dates_announced": announced, "hours": ed_hours, **(extra or {})})

            last_from, last_to = iso(r.get("last_season_from"), w), iso(r.get("last_season_to"), w)
            if last_from and last_to:
                edition(season_of(last_from), last_from, last_to, True)
            frm, to = iso(r.get("from"), w), iso(r.get("to"), w)
            edition(r.get("season"), frm, to, bool(yes(r.get("dates_announced")) and frm),
                    {"fee_ja": r.get("fee_note_ja"), "editor_notes": r.get("notes")})
            if not frm:
                note("Empty fields (fill when known)", f"{w} {r.get('season')}: dates not announced")
            for h in hrs:
                if h.get("note") == "last season" and not last_from:
                    note("Check", f"{w}: hours row {h.get('from')}–{h.get('to')} is last season's but the edition has no last-season dates")
            il_out.append({"id": iid, "kind": "illumination", "name_ja": r.get("name_ja"), "editions": editions})

        muni = p.get("municipality_slug")
        write_yaml(DATA / "places" / p["prefecture"] / muni / f"{pid}.yaml", {
            "schema_version": SCHEMA_VERSION,
            "id": pid,
            "name_ja": p.get("name_ja"),
            "name_en": p.get("name_en"),
            "name_kana": p.get("name_kana"),
            "prefecture": p.get("prefecture"),
            "municipality": p.get("municipality"),
            "municipality_slug": muni,
            "address_ja": p.get("address"),
            "lat": p.get("lat"),
            "lng": p.get("lng"),
            "geocode_precision": p.get("geocode_precision"),
            "point_note": p.get("point_note"),
            "hours_ja": p.get("hours_ja"),
            "closed_ja": p.get("closed_ja"),
            "fee_ja": p.get("fee_ja"),
            "parking_ja": p.get("parking_ja"),
            "official_urls": lines(p.get("official_url")),
            "checked_against": lines(p.get("checked_against")),
            "editor_notes": p.get("notes"),
            "closures": closures,
            "plantings": pl_out,
            "illuminations": il_out,
        }, force)

    planting_ids = {r["planting_id"] for r in plantings}

    # ---- festivals
    for f in festivals:
        fid = f["festival_id"]
        w = f"festival `{fid}`"
        f_places = ids(f.get("place_ids"))
        f_plantings = ids(f.get("planting_ids"))
        for x in f_places:
            if x not in place_ids:
                note("Bad values", f"{w}: place `{x}` is not a v1 place")
        for x in f_plantings:
            if x not in planting_ids:
                note("Bad values", f"{w}: planting `{x}` is not a v1 planting")
        if not f_plantings:
            note("Check", f"{w}: no plantings linked")
        prefs = {p["prefecture"] for p in places if p["place_id"] in f_places}
        if len(prefs) != 1:
            note("Bad values", f"{w}: places span {len(prefs)} prefectures; not written")
            continue

        editions = []
        lf, lt = iso(f.get("last_year_from"), w), iso(f.get("last_year_to"), w)
        if lf and lt:
            editions.append({"id": f"{fid}-{lf[:4]}", "from": lf, "to": lt, "dates_announced": True})
        frm, to = iso(f.get("from"), w), iso(f.get("to"), w)
        ed_id = f.get("edition_id") or f"{fid}-2027"
        editions.append({"id": ed_id, "from": frm, "to": to, "dates_announced": bool(yes(f.get("dates_announced")) and frm)})
        if not frm:
            note("Empty fields (fill when known)", f"{w}: {ed_id} dates not announced")
        if not lf and not frm:
            note("Empty fields (fill when known)", f"{w}: no dates at all (dates_raw: {(f.get('dates_raw') or '').replace(chr(10), ' / ')})")
        if not lf and ed_id.endswith("-2027") and "2026" in (f.get("dates_raw") or "") and "未確認" in (f.get("dates_raw") or ""):
            note("Check", f"{w}: next edition is `{ed_id}`, but a 2026 edition may be running now (dates_raw: "
                          f"{(f.get('dates_raw') or '').replace(chr(10), ' / ')})")

        write_yaml(DATA / "festivals" / prefs.pop() / f"{fid}.yaml", {
            "schema_version": SCHEMA_VERSION,
            "id": fid,
            "name_ja": f.get("name_ja"),
            "place_ids": f_places,
            "planting_ids": f_plantings,
            "fee_ja": f.get("fee_ja"),
            "parking_ja": f.get("parking_ja"),
            "night_events_ja": f.get("night_events_ja"),
            "official_urls": lines(f.get("official_url")),
            "checked_against": lines(f.get("checked_against")),
            "editor_notes": f.get("notes"),
            "editions": editions,
        }, force)

    # ---- sources.yaml
    out = []
    for s in tabs["Sources"]["rows"]:
        sid = s["source_id"]
        if not s.get("url"):
            note("Skipped", f"source `{sid}`: no URL")
            continue
        raw = str(s.get("checked") or "").strip()
        low = raw.lower()
        checked = "yes" if low.startswith("yes") else "partly" if low.startswith("partly") else "no"
        detail = raw if raw.lower() not in ("yes", "no", "partly") else None
        notes = s.get("notes") or ""
        notes = re.sub(r"\s*Still to find\.?", "", notes).strip()
        covered = [r["planting_id"] for r in plantings if r["place_id"] in ids(s.get("place_ids"))]
        if not covered:
            note("Check", f"source `{sid}`: covers no v1 planting (place_ids: `{s.get('place_ids')}`)")
        elif len(covered) > 1:
            note("Source coverage (trim to what each source actually reports)",
                 f"`{sid}` ({s.get('name_ja')}): {', '.join(covered)}")
        out.append({"id": sid, "name_ja": s.get("name_ja"), "publisher": s.get("publisher"),
                    "url": s.get("url"), "format": s.get("format"), "checked": checked,
                    "planting_ids": covered,
                    "editor_notes": "; ".join(x for x in (f"checked: {detail}" if detail else "", notes) if x)})
    write_yaml(DATA / "sources.yaml", {"schema_version": SCHEMA_VERSION, "sources": out}, force)

    # ---- empty logs (never overwritten)
    for name, header in (("statuses.csv", "planting_id,date,level,kind,source_id,raw_text,detail,note"),
                         ("closures.csv", "place_id,date,reason,source")):
        path = DATA / name
        if not path.exists():
            path.write_text(header + "\n", encoding="utf-8", newline="\n")

    # ---- report
    open_issues = [r for r in tabs["Issues"]["rows"] if r.get("resolved") != "yes"]
    for r in open_issues:
        note("Open issues in the sheet", f"#{r['#']} {r['tab']} `{r['id']}` {r['field']}: {r['problem']}")
    counts = (f"{len(places)} places, {len(plantings)} plantings, "
              f"{sum(1 for r in tabs['Illuminations']['rows'] if r.get('place_id') in place_ids)} illuminations, "
              f"{len(festivals)} festivals, {len(out)} sources, {len(species)} species")
    body = [f"# Import report", "", f"Generated {dt.datetime.now():%Y-%m-%d %H:%M} by scripts/import-sheet.py.",
            "", f"Imported: {counts}.", ""]
    for sec, items in report.items():
        body += [f"## {sec}", ""] + [f"- {x}" for x in items] + [""]
    REPORT.write_text("\n".join(body), encoding="utf-8", newline="\n")
    print(counts)
    print(f"report: {REPORT.relative_to(ROOT)} ({sum(map(len, report.values()))} items)")


if __name__ == "__main__":
    if "--i-know-this-overwrites-hand-edits" not in sys.argv:
        raise SystemExit("Retired 2026-11-25: data/ is now the master copy and is edited by hand. "
                         "Re-running would overwrite those edits.")
    main(force="--force" in sys.argv)
