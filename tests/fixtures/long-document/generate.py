"""Make deterministic, fictional PDFs and their independent source answer key.

From the repository root, using ReportLab from validation/requirements.txt:
    python tests/fixtures/long-document/generate.py --family admission --out tests/fixtures/long-document/admission
    python tests/fixtures/long-document/generate.py --out tests/fixtures/long-document/complex-30
    python tests/fixtures/long-document/generate.py --family table --pages 100 --density 52 --out /tmp/cp-table-100
    pnpm exec tsx tests/long-document/mupdf-regression.ts /tmp/cp-table-100
"""
import argparse
import hashlib
import json
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

NAVY = "#142B3C"
TEAL = "#166B69"
MUTED = "#4A606B"
LIGHT = "#EAF1F1"
RULE = "#BDCFCF"
W, H = letter
LEFT, RIGHT = 48, W - 48
LIMIT_BEFORE = {"Alder Mill": "USD 180,000", "Juniper Mill": "USD 240,000"}
LIMIT_AFTER = {"Alder Mill": "USD 240,000", "Juniper Mill": "USD 180,000"}
MOVING = "A duplicate calibration certificate may be held at the designated repair depot."
REFLOW = "The custodian keeps the sealed dispatch ledger with the original transfer receipt."
NEG = ("Portable generators are covered while unattended.", "Portable generators are not covered while unattended.")
ADDED = "A temporary dust monitor is required during every kiln restart."
REMOVED = "A spare analogue pressure gauge is required at the pump station."
TOPICS = ("Material handling", "Cold storage", "Water controls", "Electrical systems",
          "Process monitoring", "Access control", "Dispatch controls", "Ventilation")
ACTIONS = ("Inspect", "Log", "Review", "Retain", "Verify", "Record")
ITEMS = ("seal readings", "filter changes", "access permits", "alarm checks", "valve settings", "sample weights",
         "delivery slips", "test intervals", "tank markings", "service dates", "panel keys")
GROUPS = ("Property declarations", "Limits and deductibles", "Valuation and warranties", "Endorsements and records")


def draw(c, x, y, value, font="Helvetica", size=9, color=NAVY):
    c.setFillColor(HexColor(color))
    c.setFont(font, size)
    c.drawString(x, y, value)


def rule(c, x, y, x2, color=RULE):
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(.55)
    c.line(x, y, x2, y)


def line(c, y, value):
    draw(c, LEFT + 4, y, value, size=9.3)


def title(c, y, value):
    draw(c, LEFT + 4, y, value, "Helvetica-Bold", 9.4, TEAL)


def row(c, y, values, header=False):
    if header:
        c.setFillColor(HexColor(LIGHT))
        c.rect(LEFT + 2, y - 4, RIGHT - LEFT - 4, 14, fill=1, stroke=0)
    for x, value in zip([LEFT + 6, LEFT + 208, LEFT + 353], values):
        draw(c, x, y, value, "Helvetica-Bold" if header else "Helvetica", 8.8)
    if not header:
        rule(c, LEFT + 3, y - 4, RIGHT - 3)


def page_name(page):
    return GROUPS[page - 1] if page <= 4 else TOPICS[(page - 5) % len(TOPICS)]


def header(c, page, pages):
    draw(c, LEFT, 751, "NORTHLINE MUTUAL", "Helvetica-Bold", 11, TEAL)
    c.setFillColor(HexColor(MUTED))
    c.setFont("Helvetica", 8.5)
    c.drawRightString(RIGHT, 751, "COMMERCIAL PROPERTY  /  SPECIMEN WORDING")
    rule(c, LEFT, 738, RIGHT, TEAL)
    draw(c, LEFT, 707, page_name(page), "Times-Bold", 23, NAVY)
    draw(c, LEFT, 689, "Industrial premises  /  Schedule CP-41  /  Reference sheet %03d" % page,
         size=9, color=MUTED)
    rule(c, LEFT, 42, RIGHT)
    draw(c, LEFT, 28, "Fictional policy for comparison testing", size=8, color=MUTED)
    c.setFont("Helvetica", 8)
    c.drawRightString(RIGHT, 28, "CP-41   /   %02d of %02d" % (page, pages))


def special(c, p, rev):
    if p == 1:
        title(c, 654, "Term and applicable clauses")
        line(c, 634, "Policy year: " + ("2027" if rev else "2026"))
        line(c, 616, "Named insured: Cypress Quay Storage Cooperative.")
        line(c, 598, "Property class: Purpose-built industrial storage.")
        title(c, 569, "River depot / breakage cover")
        line(c, 549, "Notice period: " + ("9" if rev else "5") + " calendar days.")
        line(c, 531, "Breakage reports identify the dispatch batch and the shift supervisor.")
        title(c, 502, "Harbor depot / breakage cover")
        line(c, 482, "Notice period: 5 calendar days.")
        line(c, 464, "Claims staff retain a duplicate of the signed delivery manifest.")
    elif p == 2:
        title(c, 654, "Schedule A / covered premises")
        row(c, 629, ["Premises", "Equipment limit", "Retention"], True)
        limits = LIMIT_AFTER if rev else LIMIT_BEFORE
        for i, (site, value) in enumerate(limits.items()):
            row(c, 609 - i * 18, [site, value, "USD 1,500" if i == 0 else "USD 3,500"])
        row(c, 573, ["Willow Foundry", "USD 325,000", "USD 4,000"])
        title(c, 544, "Schedule B / claims handling")
        cols = ["Service centre", "Stage window", "Contact method"]
        vals = [["Delta desk", "48 hours", "Written notice"], ["East desk", "72 hours", "Secure mail"]]
        idx = [0, 2, 1] if rev else [0, 1, 2]
        row(c, 521, [cols[i] for i in idx], True)
        for j, item in enumerate(vals):
            row(c, 501 - j * 18, [item[i] for i in idx])
        if not rev:
            line(c, 461, MOVING)
    elif p == 3:
        title(c, 654, "Machinery and temporary power")
        line(c, 634, NEG[rev])
        line(c, 615, "Testing may proceed after the maintenance isolate has been signed.")
        title(c, 583, "Plant instruments")
        if not rev:
            line(c, 562, REMOVED)
        line(c, 542, "The plant lead submits the quarterly inspection certificate.")
        title(c, 511, "Evidence of custody")
        if rev:
            line(c, 490, "The custodian keeps the sealed dispatch ledger with the")
            line(c, 476, "original transfer receipt.")
        else:
            line(c, 490, REFLOW)
    elif p == 4:
        title(c, 654, "Restart endorsement")
        if rev:
            line(c, 631, ADDED)
        line(c, 610, "The reinstatement decision is recorded in the seasonal inspection book.")
        title(c, 580, "Depots and supporting records")
        if rev:
            line(c, 559, MOVING)
        line(c, 539, "The repair contractor retains its inspection worksheet.")
        title(c, 508, "Delivery notifications")
        line(c, 487, "Approved release channel: " + ("secure portal." if rev else "registered post."))
        line(c, 467, "Notices identify the registered sender and the owning depot.")


def body(c, p, density, family):
    first = p <= 4
    heading_y = 428 if first else 649
    if p > 4:
        line(c, 666, "These controls apply while the premises operate under the scheduled maintenance plan.")
    title(c, heading_y, "Operational register / sheet %03d" % p)
    top = heading_y - 23
    bottom = 81
    step = min(20, (top - bottom) / max(1, density - 1))
    use_table = family == "table" or (family == "mixed" and p % 3 == 2)
    text_size = min(9.2, step * .77)
    for k in range(density):
        y = top - step * k
        i = (p - 1) * density + k
        item = ITEMS[(i * 7 + p) % len(ITEMS)]
        action = ACTIONS[(i + p) % len(ACTIONS)]
        if use_table:
            if k == 0:
                row(c, y, ["Control", "Activity", "Frequency"], True)
                continue
            interval = ["At handover", "Weekly", "Monthly", "At shutdown"][(i + p) % 4]
            for x, value in zip([LEFT+6, LEFT+208, LEFT+353], [f"Station {p:03d}-{k:02d}", action+" "+item, interval]):
                draw(c, x, y, value, size=text_size)
        elif family == "repeated" or (family == "mixed" and p % 3 == 0):
            if k % 4 == 0:
                label = f"Bay {p:03d}-{k//4+1:02d} / local instructions"
            else:
                label = ("Keep the inspection register at the designated workstation.",
                         "Notify the shift manager before releasing a hold.",
                         "Retain the signed handover record for twelve months.")[k % 4 - 1]
            draw(c, LEFT + 4, y, label, "Helvetica-Bold" if k % 4 == 0 else "Helvetica", text_size)
        else:
            label = f"Record {p:03d}-{k+1:02d}. {action} {item} and keep the signed copy for the next review."
            draw(c, LEFT + 4, y, label, size=text_size)


def terminal_probes(c, page, pages, revised):
    if page == (pages + 1) // 2:
        line(c, 59, "Inspection archive: Retain certifications for " + ("18" if revised else "12") + " months.")
    if page == pages:
        line(c, 59, "Lift alarm threshold: " + ("650 kg." if revised else "500 kg."))


def truth(pages, density, family):
    def src(page, section, text, anchors=None):
        x = dict(page=page, section=section, text=text)
        if anchors is not None:
            x["anchors"] = anchors
        return x

    cases = []
    def item(id_, kind, baseline, revised, expectation):
        cases.append(dict(id=id_, kind=kind, baseline=baseline, revised=revised, expectation=expectation))

    def change(id_, kind, page, section, before, after, expectation, anchors=None):
        item(id_, kind, src(page, section, before, anchors), src(page, section, after, anchors), expectation)

    change("P01", "replacement", 1, "Term and applicable clauses", "Policy year: 2026", "Policy year: 2027", "Identify the policy year replacement on both sources.")
    change("P02", "replacement", 1, "River depot / breakage cover", "Notice period: 5 calendar days.", "Notice period: 9 calendar days.", "Associate the changed deadline with River depot. Harbor depot keeps the original deadline.", ["River depot / breakage cover"])
    for id_, site in [("P03", "Alder Mill"), ("P04", "Juniper Mill")]:
        change(id_, "table-value", 2, "Schedule A / covered premises", site+" "+LIMIT_BEFORE[site], site+" "+LIMIT_AFTER[site], "Report the equipment limit for this particular premises. The multiset of limits in Schedule A stays constant.", [site,"Equipment limit"])
    change("P05", "replacement", 3, "Machinery and temporary power", *NEG, "Capture the added negation and locate both full clauses.")
    item("P06", "addition", None, src(4, "Restart endorsement", ADDED), "Identify this new obligation on revised page 4.")
    item("P07", "deletion", src(3, "Plant instruments", REMOVED), None, "Identify the removed obligation on baseline page 3.")
    item("P08", "move", src(2, "Schedule B / claims handling", MOVING), src(4, "Depots and supporting records", MOVING), "Identify the identical sentence at its old and new location. Unlinked deletion/addition is only partial evidence.")
    change("P09", "replacement", 4, "Delivery notifications", "Approved release channel: registered post.", "Approved release channel: secure portal.", "Locate both versions of the changed delivery method.")
    middle = (pages + 1) // 2
    change("P10", "replacement", middle, page_name(middle), "Inspection archive: Retain certifications for 12 months.", "Inspection archive: Retain certifications for 18 months.", "Find the amended retention period on the middle physical page.")
    change("P11", "replacement", pages, page_name(pages), "Lift alarm threshold: 500 kg.", "Lift alarm threshold: 650 kg.", "Find the changed quantity and preserve the measurement unit on the final physical page.")
    change("C01", "unchanged-repeated", 1, "Harbor depot / breakage cover", "Notice period: 5 calendar days.", "Notice period: 5 calendar days.", "Keep the Harbor deadline unchanged even though the River deadline changed.", ["Harbor depot / breakage cover"])
    change("C02", "reflow", 3, "Evidence of custody", REFLOW, REFLOW, "The words are identical. A line break is allowed as a layout observation, with no change to the obligation.")
    change("C03", "column-reorder", 2, "Schedule B / claims handling", "Delta desk 48 hours Written notice", "Delta desk Written notice 48 hours", "Preserve the association Delta desk / Stage window = 48 hours / Contact method = Written notice. A relocation of equal cells or a structural uncertainty notice is acceptable.", ["Delta desk","Stage window","Contact method"])
    change("C04", "unchanged-table", 2, "Schedule A / covered premises", "Willow Foundry USD 325,000 USD 4,000", "Willow Foundry USD 325,000 USD 4,000", "No substantive change to the Willow Foundry row.", ["Willow Foundry"])
    for case in cases:
        # These identical baseline sentences must be distinguished spatially.
        row_y = {"P02":549, "C01":482, "P03":609, "P04":591, "C03":501, "C04":573}
        if case["id"] in row_y:
            y = row_y[case["id"]]
            edge = 561 if case["id"] in {"P03","P04","C03","C04"} else 300
            for side in ("baseline", "revised"):
                case[side]["region_points_top_left"] = [50, H-y-11, edge, H-y+3]
                case[side]["y_range_top_pt"] = [H-y-11, H-y+3]
    return dict(schema="policy-compare-fictional-fixture/1", pages_per_file=pages, rows_per_register=density, family=family, cases=cases,
                page_numbering="1-based physical PDF pages",
                scoring_note="Eleven positive cases include one unchanged-text move. The middle and final pages hold independent seeded edits. Location boxes use PDF points from the top-left of the physical page. Four controls describe unchanged wording or preserved relationships. A single source change may span several UI cards. Layout-only notices do not imply semantic changes.")


def admission_pair(directory):
    """A whole-document estimate above 100 million, with just one changed year."""
    hashes = {}
    for filename, year in (("baseline.pdf", 2022), ("revised.pdf", 2023)):
        target = directory / filename
        c = canvas.Canvas(str(target), pagesize=(600, 800), invariant=1)
        for page in range(30):
            c.setFont("Helvetica", 9)
            if page == 0:
                c.drawString(35, 770, f"Policy year: {year}")
            for row in range(16):
                number = page * 16 + row + 1
                c.drawString(35, 735 - row * 20,
                             f"{number}. All sums due to us on the day set out in this part of the plan are due in full.")
            c.showPage()
        c.save()
        hashes[filename] = hashlib.sha256(target.read_bytes()).hexdigest()
    return {
        "family": "admission", "pages_per_file": 30, "sha256": hashes, "exact_difference_count": 1,
        "cases": [{"id": "year", "kind": "replacement",
                   "baseline": {"page": 1, "text": "Policy year: 2022"},
                   "revised": {"page": 1, "text": "Policy year: 2023"}}],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pages", type=int, default=30)
    ap.add_argument("--density", type=int, default=18)
    ap.add_argument("--family", choices=("mixed", "repeated", "table", "admission"), default="mixed")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    max_density = 52 if args.family == "table" else 36
    if not 4 <= args.pages <= 100 or not 4 <= args.density <= max_density:
        ap.error(f"pages must be 4..100 and {args.family} density must be 4..{max_density}")
    args.out.mkdir(parents=True, exist_ok=True)
    if args.family == "admission":
        if args.pages != 30 or args.density != 18:
            ap.error("the admission fixture uses fixed sizing; use --family admission --out DIR")
        key = admission_pair(args.out)
        (args.out / "truth.json").write_text(json.dumps(key, indent=2)+"\n", encoding="utf-8")
        return
    key = truth(args.pages, args.density, args.family)
    if args.density > 36:
        key["first_four_page_register_rows"] = 36
    key["sha256"] = {}
    for revised, filename in enumerate(("baseline.pdf", "revised.pdf")):
        target = args.out / filename
        c = canvas.Canvas(str(target), pagesize=letter, invariant=1, pageCompression=1)
        c.setTitle("Industrial Premises Schedule CP-41")
        c.setAuthor("Northline Mutual / fictional test publisher")
        for p in range(1, args.pages+1):
            header(c, p, args.pages)
            special(c, p, revised)
            rows = min(36, args.density) if p <= 4 else args.density
            body(c, p, rows, args.family)
            terminal_probes(c, p, args.pages, revised)
            c.showPage()
        c.save()
        key["sha256"][filename] = hashlib.sha256(target.read_bytes()).hexdigest()
    (args.out / "truth.json").write_text(json.dumps(key, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
