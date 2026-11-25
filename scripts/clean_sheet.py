"""Read and rewrite staging/draft-list-clean.xlsx safely.

Never patch the sheet in place with openpyxl: when Excel saves it, Excel moves
cross-tab dropdowns and the issue highlights into its own extension format,
which openpyxl silently drops. Instead:

    tabs = load()               # every tab's values, in R's current row order
    ...edit tabs["Plantings"]["rows"] (list of dicts)...
    save(tabs)                  # writes a fresh file: values + styling,
                                # dropdowns and sort-safe issue highlights

save() refuses while the file is open in Excel and keeps a timestamped backup
in staging/backups/. Manual formatting (colours, widths) is not preserved.
"""

import datetime as dt
import shutil
from pathlib import Path

import openpyxl
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "staging" / "draft-list-clean.xlsx"
MAX_ROW = 1000

HEADER_FILL = PatternFill("solid", fgColor="E7E5E4")
FLAG_FILL = PatternFill("solid", bgColor="FFF2A8")
RESOLVED_FILL = PatternFill("solid", bgColor="F5F5F4")
GREY = Font(color="9E9E9E")

# (tab, column, list formula)
DROPDOWNS = [
    ("Places", "in_v1", '"yes,no"'),
    ("Places", "geocode_precision", '"lot,block,manual,approximate"'),
    ("Places", "municipality", "=Municipalities!$B$2:$B$100"),
    ("Places", "closed_weekly", '"mon,tue,wed,thu,fri,sat,sun"'),
    ("Plantings", "in_v1", '"yes,no"'),
    ("Plantings", "species", "=Species!$A$2:$A$100"),
    ("Plantings", "kind", '"bloom,foliage"'),
    ("Plantings", "provisional", '"yes,no"'),
    ("Plantings", "place_id", f"=Places!$A$2:$A${MAX_ROW}"),
    ("Illuminations", "dates_announced", '"yes,no"'),
    ("Illuminations", "place_id", f"=Places!$A$2:$A${MAX_ROW}"),
    ("Festivals", "in_v1", '"yes,no"'),
    ("Festivals", "dates_announced", '"yes,no"'),
    ("Issues", "resolved", '"yes"'),
]


def is_text_date_col(col):
    return (col.startswith(("window", "last_year", "last_season", "dates_")) or col in ("from", "to")
            or col.endswith(("_dates", "_from", "_to")))


def lock_file(path):
    return path.with_name("~$" + path.name)


def load(path=SHEET):
    wb = openpyxl.load_workbook(path)
    tabs = {}
    for ws in wb.worksheets:
        it = ws.iter_rows(values_only=True)
        if ws.title == "README":
            tabs["README"] = {"cols": None, "rows": [r[0] for r in ws.iter_rows(values_only=True)]}
            continue
        cols = [c for c in next(it) if c is not None]
        rows = []
        for r in it:
            if any(v not in (None, "") for v in r):
                rows.append({c: _clean(v) for c, v in zip(cols, r)})
        tabs[ws.title] = {"cols": cols, "rows": rows}
    return tabs


def _clean(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v


def save(tabs, path=SHEET):
    if lock_file(path).exists():
        raise SystemExit(f"{path.name} is open in Excel. Save and close it first.")
    if path.exists():
        bdir = path.parent / "backups"
        bdir.mkdir(exist_ok=True)
        shutil.copy2(path, bdir / f"{path.stem}-{dt.datetime.now():%Y%m%d-%H%M%S}.xlsx")

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, tab in tabs.items():
        ws = wb.create_sheet(name)
        if name == "README":
            for line in tab["rows"]:
                ws.append([line])
            ws.column_dimensions["A"].width = 120
            ws["A1"].font = Font(bold=True, size=14)
            continue
        cols = tab["cols"]
        ws.append(cols)
        for r in tab["rows"]:
            ws.append([r.get(c) for c in cols])
        _style(ws, cols)

    for sheet, col, formula in DROPDOWNS:
        if sheet in tabs and col in tabs[sheet]["cols"]:
            L = get_column_letter(tabs[sheet]["cols"].index(col) + 1)
            v = DataValidation(type="list", formula1=formula, allow_blank=True)
            v.add(f"{L}2:{L}{MAX_ROW}")
            wb[sheet].add_data_validation(v)

    _issue_highlights(wb, tabs)
    wb.save(path)


def _style(ws, cols):
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = HEADER_FILL
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = ws.dimensions
    grey_rows = set()
    if "in_v1" in cols:
        k = cols.index("in_v1") + 1
        grey_rows = {row for row in range(2, ws.max_row + 1) if ws.cell(row, k).value == "no"}
    for i, col in enumerate(cols, 1):
        L = get_column_letter(i)
        cells = ws[L][1:]
        width = max([len(str(col))] + [min(len(str(c.value or "").split("\n")[0]), 60) for c in cells])
        ws.column_dimensions[L].width = min(max(width * 1.3 + 2, 8), 60)
        for c in cells:
            c.alignment = Alignment(vertical="top", wrap_text=True)
            if is_text_date_col(col):
                c.number_format = "@"
            if c.row in grey_rows:
                c.font = GREY


def _issue_highlights(wb, tabs):
    """Yellow on a cell while an unresolved Issues row names its tab, row ID (first column) and field.
    Row-relative and keyed by ID, so sorting any tab keeps highlights on the right rows."""
    if "Issues" not in tabs:
        return
    icols = tabs["Issues"]["cols"]
    L = {k: get_column_letter(icols.index(k) + 1) for k in ("tab", "id", "field", "resolved")}
    wanted = {}
    for r in tabs["Issues"]["rows"]:
        tab, field = r.get("tab"), r.get("field")
        if tab in tabs and field and tab != "Issues":
            for f in str(field).split(", "):
                if f in tabs[tab]["cols"]:
                    wanted.setdefault((tab, f), set()).add(str(field))
    for (tab, col), fieldstrings in wanted.items():
        ws = wb[tab]
        C = get_column_letter(tabs[tab]["cols"].index(col) + 1)
        for fs in sorted(fieldstrings):
            formula = (f'COUNTIFS(Issues!${L["tab"]}:${L["tab"]},"{tab}",'
                       f'Issues!${L["id"]}:${L["id"]},$A2,'
                       f'Issues!${L["field"]}:${L["field"]},"{fs}",'
                       f'Issues!${L["resolved"]}:${L["resolved"]},"<>yes")>0')
            ws.conditional_formatting.add(f"{C}2:{C}{MAX_ROW}", FormulaRule(formula=[formula], fill=FLAG_FILL))
    ws = wb["Issues"]
    last = get_column_letter(len(icols))
    ws.conditional_formatting.add(f"A2:{last}{MAX_ROW}", FormulaRule(
        formula=[f'${L["resolved"]}2="yes"'], font=GREY, fill=RESOLVED_FILL))
