"""Writes left.html / right.html: a two-page fleet schedule with explicit,
known changes (expected.json) for checking PDFs from different generators.

Standard library only. The same HTML is printed by Chromium and converted by
LibreOffice; neither the product nor the checker reads expected.json except
the checker, after the comparison.
"""
import html
import json
import os
import sys

out = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))

FLEET = [  # type, MSN, registration, agreed value, lessee
    ("ATR 72-600", "1138", "CC-TPY", "16,680,000", "Andes Pacific Airlines"),
    ("ATR 72-600", "1206", "CS-AFB", "18,990,000", "Cobalt Atlantic"),
    ("ATR 72-600", "1315", "CS-BTE", "20,490,000", "Cobalt Atlantic"),
    ("ATR 72-600", "1351", "CC-USZ", "17,200,000", "Andes Pacific Airlines"),
    ("ATR 72-600", "1446", "XA-EFA", "12,000,000", "Coral Bay Airways"),
    ("ATR 72-600", "1548", "CS-FAE", "10,000,000", "Cobalt Atlantic"),
    ("ATR 72-600", "1760", "ZK-ENV", "16,040,000", "Tasman Commuter"),
    ("Bombardier CRJ900", "15256", "CC-AXW", "16,900,000", "Andes Pacific Airlines"),
    ("Bombardier CRJ900", "15361", "LN-AWL", "12,170,000", "Aurora Regional Airways"),
    ("De Havilland Dash 8-400", "4351", "RP-C9639", "11,970,000", "Lumen Air"),
    ("De Havilland Dash 8-400", "4370", "CC-LUV", "10,270,000", "Andes Pacific Airlines"),
    ("De Havilland Dash 8-400", "4551", "C-MRP", "12,680,000", "Kestrel Connect"),
    ("De Havilland Dash 8-400", "4582", "C-YVR", "12,880,000", "Kestrel Connect"),
    ("Embraer E175", "17000435", "VH-ZSJ", "24,230,000", "Meridian Skies"),
    ("Embraer E175", "17000468", "LN-GYE", "23,540,000", "Aurora Regional Airways"),
    ("Embraer E175", "17000502", "PR-PYP", "26,900,000", "Selva Linhas Aereas"),
    ("Embraer E175", "17000570", "PR-UBP", "21,070,000", "Selva Linhas Aereas"),
    ("Embraer E175", "17000589", "PR-CJD", "25,400,000", "Selva Linhas Aereas"),
    ("Embraer E175", "17000611", "LY-YWT", "26,000,000", "Baltica Wings"),
    ("Embraer E175", "17000616", "LY-AED", "21,350,000", "Baltica Wings"),
    ("Embraer E190", "19000394", "ZK-GVG", "21,610,000", "Tasman Commuter"),
    ("Embraer E190", "19000543", "VH-NWL", "26,400,000", "Meridian Skies"),
]
# Unchanged filler records so that each generator produces several pages.
FLEET += [("Embraer E195", str(19010100 + 7 * k), f"VH-Q{chr(65 + k % 26)}{chr(70 + k % 20)}",
           f"{30 + k % 9},{(k * 37) % 1000:03d},000", ["Meridian Skies", "Tasman Commuter", "Lumen Air"][k % 3])
          for k in range(40)]
CONDITIONS = [
    f"Condition {n}: The Insured shall maintain the Aircraft in an airworthy condition and in accordance with the "
    f"approved maintenance programme; records shall be made available to the Slip Leader within {10 + n} days of request."
    for n in range(1, 13)
]
LINES = [  # insurer, reference, share, stamp date
    ("ALD 3392 (Slip Leader)", "AVN24117", "22.5%", "02/10/2024"),
    ("MKV 1426", "24AV0381", "15.0%", "03/10/2024"),
    ("HPX 0624", "HX-AV-2210", "12.5%", "03/10/2024"),
    ("SLD 2988", "2988/AV/24/117", "10.0%", "04/10/2024"),
    ("Nordvik Re Europe SE", "NRE-24-55210", "10.0%", "07/10/2024"),
]


def right_side():
    fleet = [list(r) for r in FLEET]
    by_msn = {r[1]: r for r in fleet}
    by_msn["1315"][3] = "19,210,000"                       # value change
    by_msn["1446"][3], by_msn["1548"][3] = "10,000,000", "12,000,000"  # amounts swap
    by_msn["4551"][4] = "Coral Bay Regional Airways"        # lessee change, wraps
    fleet.remove(by_msn["1760"])                            # removed aircraft
    fleet.insert(fleet.index(by_msn["15256"]),              # inserted aircraft
                 ["Airbus A220-100", "55228", "VH-JXP", "39,000,000", "Meridian Skies"])
    lines = [list(r) for r in LINES]
    lines[2][2] = "10.0%"                                   # HPX share change
    lines.remove(lines[3])                                  # SLD leaves ...
    lines.append(["Corvane Insurance AG", "CIA-AV-25-0311", "10.0%", "04/10/2024"])  # ... Corvane joins, same share/date
    return fleet, lines, "300,000"


def page(fleet, lines, deductible):
    rows = "\n".join(
        "<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in r) + "</tr>" for r in fleet)
    shares = "\n".join(
        "<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in r) + "</tr>" for r in lines)
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Fleet schedule</title>
<style>
@page {{ size: A4; margin: 18mm 16mm; }}
body {{ font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 9pt; }}
h1 {{ font-size: 13pt; }} h2 {{ font-size: 11pt; margin-top: 14pt; }}
table {{ border-collapse: collapse; width: 100%; table-layout: fixed; }}
td, th {{ border: 0.5pt solid #555; padding: 4pt 5pt; vertical-align: top; text-align: left; }}
col.type {{ width: 20%; }} col.msn {{ width: 12%; }} col.reg {{ width: 14%; }}
col.value {{ width: 18%; }} col.lessee {{ width: 22%; }}
p {{ margin: 6pt 0; }}
</style></head><body>
<h1>SCHEDULE OF AIRCRAFT</h1>
<p>All values in US Dollars. Agreed Values apply to the Hull section of this contract.</p>
<table>
<colgroup><col class="type"><col class="msn"><col class="reg"><col class="value"><col class="lessee"></colgroup>
<tr><th>Aircraft Type</th><th>MSN</th><th>Registration</th><th>Agreed Value</th><th>Lessee</th></tr>
{rows}
</table>
<h2>DEDUCTIBLES</h2>
<p>Hull deductible: USD {deductible} each and every loss, not applicable to Total Loss.</p>
<h2>CONDITIONS</h2>
{"".join(f"<p>{html.escape(c)}</p>" for c in CONDITIONS)}
<h2>WRITTEN LINES</h2>
<table>
<tr><th>Insurer</th><th>Reference</th><th>Written Line</th><th>Stamp Date</th></tr>
{shares}
</table>
</body></html>
"""


EXPECTED = {
    "purpose": "Known changes between left and right; read only by check-generators.ts after comparison",
    "events": [
        {"id": "G1", "what": "agreed value change", "record": "1315", "kind": "Replaced", "old": "20,490,000", "new": "19,210,000"},
        {"id": "G2", "what": "amount swap, first record", "record": "1446", "kind": "Replaced", "old": "12,000,000", "new": "10,000,000"},
        {"id": "G3", "what": "amount swap, second record", "record": "1548", "kind": "Replaced", "old": "10,000,000", "new": "12,000,000"},
        {"id": "G4", "what": "lessee change into a wrapped cell", "record": "4551", "kind": "Replaced", "old": "Kestrel Connect", "new": "Coral Bay Regional Airways"},
        {"id": "G5", "what": "aircraft removed", "record": "1760", "kind": "Removed", "old": "16,040,000"},
        {"id": "G6", "what": "aircraft inserted mid-table", "record": "55228", "kind": "Added", "new": "39,000,000"},
        {"id": "G7", "what": "body deductible change", "kind": "Replaced", "old": "250,000", "new": "300,000"},
        {"id": "G8", "what": "share change on its insurer", "record": "HPX 0624", "kind": "Replaced", "old": "12.5%", "new": "10.0%"},
        {"id": "G9", "what": "insurer leaves", "record": "SLD 2988", "kind": "Removed", "old": "10.0%"},
        {"id": "G10", "what": "insurer joins with the same share and date", "record": "Corvane Insurance AG", "kind": "Added", "new": "10.0%"},
    ],
    "mustNotPair": [["SLD 2988", "Corvane"], ["1760", "55228"], ["1446", "1548"]],
}

def furniture_pages(umr, limit, aggregate):
    """Four pages with repeated margin lines; umr/limit/aggregate give each
    page's text, so one page can differ from the rest."""
    pages = "\n".join(f"""<section>
<div style="top:12mm">{html.escape(umr(p))}</div>
<div style="top:20mm">{html.escape(limit(p))}</div>
<p style="top:80mm">Ordinary body text on page {p + 1}.</p>
<div style="bottom:10mm">Page {p + 1} - {html.escape(aggregate(p))}</div>
</section>""" for p in range(4))
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Repeated margin lines</title>
<style>
@page {{ size: A4; margin: 0; }}
body {{ margin: 0; font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 9pt; }}
section {{ position: relative; height: 296mm; page-break-after: always; }}
section > * {{ position: absolute; left: 16mm; margin: 0; }}
</style></head><body>
{pages}
</body></html>
"""


# Page furniture whose text varies inside one version (review of PR #9).
FURNITURE = {
    "purpose": "Repeated margin lines; read only by browser-check.ts after comparison",
    "cards": [
        {"id": "F1", "what": "UMR rolled forward on pages 1, 2 and 4; page 3 kept the old reference",
         "kind": "Replaced", "category": "Review", "old": "UMR B1234AV2024", "new": "UMR B1234AV2025",
         "rightPages": [1, 2, 4], "keptOldOnRightPages": [3]},
        {"id": "F2", "what": "limit changed on page 2 only", "kind": "Replaced", "category": "Material",
         "old": "USD 1,000,000", "new": "USD 2,000,000", "rightPages": [2], "keptOldOnRightPages": [1, 3, 4]},
        {"id": "F3", "what": "limit on the page-number line changed on every page", "kind": "Replaced",
         "category": "Material", "old": "USD 5,000,000", "new": "USD 6,000,000", "rightPages": [1, 2, 3, 4]},
    ],
}

def margin_pages(count, rate, amounts, msn, margin_text):
    """Third review of PR #9: a header with two amounts side by side (A), a
    rate next to "Page n of N" (B), an MSN that counts with the pages (C) and
    lines that appear once at the top, bottom or in the body of a page (E)."""
    def once(p):
        return "".join(f'<div style="{where}">{html.escape(text)}</div>'
                       for page, where, text in margin_text if page == p)
    pages = "\n".join(f"""<section>
<div style="top:12mm">{html.escape(amounts[0])}</div>
<div style="top:12mm; left:110mm">{html.escape(amounts[1])}</div>
<div style="top:18mm">Premium rate {rate} - Page {p + 1} of {count}</div>
<div style="top:40mm">Aircraft MSN {msn + p}</div>
{once(p)}
<p style="top:100mm">Ordinary body text on page {p + 1}.</p>
</section>""" for p in range(count))
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Margin lines</title>
<style>
@page {{ size: A4; margin: 0; }}
body {{ margin: 0; font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 9pt; }}
section {{ position: relative; height: 296mm; page-break-after: always; }}
section > * {{ position: absolute; left: 16mm; margin: 0; }}
</style></head><body>
{pages}
</body></html>
"""


# A: the two amounts swap places; B: 4 -> 5 pages and 4% -> 5%; C: MSN
# 101..104 -> 201..205; E: text at the top (25 mm), bottom and body of a page,
# the body heading on page 4 below the MSN line.
MARGIN_TEXT = [
    (0, "top:25mm", "The insurer covers war risks.", "The insurer excludes war risks."),
    (0, "bottom:8mm", "THE INSURER COVERS WAR RISKS.", "THE INSURER EXCLUDES WAR RISKS."),
    (1, "top:25mm", "HULL LIMIT USD 1,000,000", "HULL LIMIT USD 2,000,000"),
    (3, "top:55mm", "THE INSURER WAIVES SUBROGATION.", "THE INSURER RESERVES SUBROGATION."),
]
MARGIN = {
    "purpose": "Margin and repeated lines (review of PR #9, third round); read only by browser-check.ts after comparison",
    "cards": [
        {"id": "A1", "what": "amount at the left of the header", "kind": "Replaced", "category": "Material",
         "old": "USD 1000", "new": "USD 2000", "x": 45.4, "left": [1, 2, 3, 4], "right": [1, 2, 3, 4, 5]},
        {"id": "A2", "what": "amount at 110 mm of the header", "kind": "Replaced", "category": "Material",
         "old": "USD 2000", "new": "USD 1000", "x": 311.8, "left": [1, 2, 3, 4], "right": [1, 2, 3, 4, 5]},
        {"id": "B", "what": "rate equal to the page total", "kind": "Replaced", "category": "Material",
         "old": "Premium rate 4% - Page 1 of 4", "new": "Premium rate 5% - Page 1 of 5",
         "left": [1, 2, 3, 4], "right": [1, 2, 3, 4, 5]},
        *({"id": f"C{p + 1}", "what": "MSN counting with the pages", "kind": "Replaced", "category": "Material",
           "old": f"Aircraft MSN {101 + p}", "new": f"Aircraft MSN {201 + p}", "left": [p + 1], "right": [p + 1]}
          for p in range(4)),
        {"id": "E1", "what": "sentence at the top of page 1", "kind": "Replaced", "category": "Review",
         "old": MARGIN_TEXT[0][2], "new": MARGIN_TEXT[0][3], "left": [1], "right": [1]},
        {"id": "E2", "what": "capitals at the bottom of page 1", "kind": "Replaced", "category": "Review",
         "old": MARGIN_TEXT[1][2], "new": MARGIN_TEXT[1][3], "left": [1], "right": [1]},
        {"id": "E3", "what": "limit at the top of page 2", "kind": "Replaced", "category": "Material",
         "old": MARGIN_TEXT[2][2], "new": MARGIN_TEXT[2][3], "left": [2], "right": [2]},
        # A changed heading is its own title context, so it is shown as removed
        # and added (both visible for review), not as one replaced card.
        {"id": "E4-old", "what": "capitals heading in the body of page 4, old text", "kind": "Removed", "category": "Review",
         "old": MARGIN_TEXT[3][2], "left": [4], "right": []},
        {"id": "E4-new", "what": "capitals heading in the body of page 4, new text", "kind": "Added", "category": "Review",
         "new": MARGIN_TEXT[3][3], "left": [], "right": [4]},
    ],
}

os.makedirs(out, exist_ok=True)
open(os.path.join(out, "furniture-left.html"), "w", encoding="utf-8").write(furniture_pages(
    lambda p: "UMR B1234AV2024", lambda p: "Hull limit any one aircraft USD 1,000,000",
    lambda p: "Aggregate limit USD 5,000,000"))
open(os.path.join(out, "furniture-right.html"), "w", encoding="utf-8").write(furniture_pages(
    lambda p: "UMR B1234AV2024" if p == 2 else "UMR B1234AV2025",
    lambda p: f"Hull limit any one aircraft USD {'2,000,000' if p == 1 else '1,000,000'}",
    lambda p: "Aggregate limit USD 6,000,000"))
json.dump(FURNITURE, open(os.path.join(out, "furniture-expected.json"), "w", encoding="utf-8"), indent=1)
open(os.path.join(out, "margin-left.html"), "w", encoding="utf-8").write(margin_pages(
    4, "4%", ("USD 1000", "USD 2000"), 101, [(p, w, old) for p, w, old, _ in MARGIN_TEXT]))
open(os.path.join(out, "margin-right.html"), "w", encoding="utf-8").write(margin_pages(
    5, "5%", ("USD 2000", "USD 1000"), 201, [(p, w, new) for p, w, _, new in MARGIN_TEXT]))
json.dump(MARGIN, open(os.path.join(out, "margin-expected.json"), "w", encoding="utf-8"), indent=1)
open(os.path.join(out, "left.html"), "w", encoding="utf-8").write(page(FLEET, LINES, "250,000"))
open(os.path.join(out, "right.html"), "w", encoding="utf-8").write(page(*right_side()))
json.dump(EXPECTED, open(os.path.join(out, "expected.json"), "w", encoding="utf-8"), indent=1)
print(out)
