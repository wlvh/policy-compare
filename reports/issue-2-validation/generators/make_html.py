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

os.makedirs(out, exist_ok=True)
open(os.path.join(out, "left.html"), "w", encoding="utf-8").write(page(FLEET, LINES, "250,000"))
open(os.path.join(out, "right.html"), "w", encoding="utf-8").write(page(*right_side()))
json.dump(EXPECTED, open(os.path.join(out, "expected.json"), "w", encoding="utf-8"), indent=1)
print(out)
