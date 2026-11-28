#!/usr/bin/env python3
"""Generate fictional PDF inputs. Authored expectations live separately.

No product code or truth.json is read. Run twice under the pinned dependency
versions to obtain byte-identical PDFs. Coordinates in the case descriptions
use PDF points from the top-left of an A4 page.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import zlib

import reportlab
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

WIDTH, HEIGHT = A4
INK = HexColor("#172c44")
MUTED = HexColor("#586574")
CASES = {"a-whitespace": 13, "b-duplicate-context": 2,
         "c-address-reflow": 2, "d-review-mixed": 6,
         "e-header-digit": 1}
FONT_DIRECTORY = Path(reportlab.__file__).resolve().parent / "fonts"
pdfmetrics.registerFont(TTFont("FixtureSans", str(FONT_DIRECTORY / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("FixtureSansBold", str(FONT_DIRECTORY / "VeraBd.ttf")))


def line(c, text, x=72, top=150, size=10.5, bold=False):
    c.setFillColor(INK)
    c.setFont("FixtureSansBold" if bold else "FixtureSans", size)
    c.drawString(x, HEIGHT - top, text)


def new_pdf(path: Path, title: str):
    c = canvas.Canvas(str(path), pagesize=A4, invariant=1, pageCompression=1)
    c.setTitle(title)
    c.setAuthor("Example Document Office")
    c.setSubject("Fictional English comparison document")
    c.setCreator("review-readability fixture generator / 1")
    c.setProducer("ReportLab PDF Library / deterministic fixture build")
    return c


def page_frame(c, title, page, total):
    line(c, "EXAMPLE DOCUMENT OFFICE", top=40, size=8.5, bold=True)
    line(c, title, top=81, size=17, bold=True)
    c.setStrokeColor(HexColor("#b5c3d1"))
    c.setLineWidth(0.5)
    c.line(72, HEIGHT - 100, WIDTH - 72, HEIGHT - 100)
    line(c, f"Page {page} of {total}", x=WIDTH - 124, top=HEIGHT - 37, size=8)


def whitespace(path, revised):
    c = new_pdf(path, "Contract of Insurance")
    blanks = {11: "  ", 12: "   ", 13: " "} if revised else {1: " ", 2: "  ", 3: "   "}
    for page in range(1, 14):
        page_frame(c, "Contract of Insurance", page, 13)
        # Real text is stable. Boundary spaces and layout alone differ.
        title = "Contract of Insurance" + ("  " if revised and page == 1 else "")
        line(c, title, top=145, size=13, bold=True)
        line(c, f"Section {page:02d}.", top=190, bold=True)
        insured = "Insured: Harbor Example Aviation Ltd."
        line(c, (" " + insured + " ") if revised and page == 2 else insured, top=230)
        line(c, "Service period: 1 January 2027 to 31 December 2027.", top=270)
        if page == 7 and revised:
            line(c, "Records must remain available", top=320)
            line(c, "for inspection during the service period.", top=334)
        else:
            line(c, "Records must remain available for inspection during the service period.", top=320)
        line(c, "The agreed currency is USD.", top=380)
        line(c, "The schedule and its values are unchanged.", top=430)
        if page in blanks:
            # Deliberately encoded isolated whitespace, not an empty draw call.
            line(c, blanks[page], x=96, top=535)
        line(c, "Document administration continues below.", top=600)
        c.showPage()
    c.save()


def duplicate_context(path, revised):
    c = new_pdf(path, "Participation memorandum")
    contexts = ["A provisional arrangement remains subject to review.",
                "An optional arrangement remains subject to review."] if revised else [
                "A preliminary arrangement remains subject to review.",
                "A separate arrangement remains subject to review."]
    for page in range(1, 3):
        # Both occurrences intentionally lack a stable per-record identifier.
        # Page positions are present, but are not an asserted record identity.
        page_frame(c, "Participation memorandum", page, 2)
        line(c, "Participants under consideration", top=160, size=12, bold=True)
        line(c, contexts[page - 1], top=220)
        line(c, "Harbor Example Insurance Ltd", top=275, size=12)
        line(c, "The participation terms are recorded elsewhere.", top=340)
        line(c, "No individual record identifier is specified here.", top=390)
        c.showPage()
    c.save()


def address_block(c, company, street, city, postcode, top, revised):
    line(c, company, top=top, size=12, bold=True)
    line(c, "Correspondence address:", top=top + 34, bold=True)
    if revised:
        # Reorder values and add labels; do not alter any address value.
        for index, (label, value) in enumerate([
            ("Postcode:", postcode), ("Street:", street),
            ("City:", city), ("Country:", "Exampleland")
        ]):
            row = top + 68 + index * 24
            line(c, label, x=94, top=row, size=10, bold=True)
            line(c, value, x=214, top=row, size=10)
    else:
        for index, value in enumerate([street, city, postcode, "Exampleland"]):
            line(c, value, x=94, top=top + 68 + index * 14, size=10)


def address_reflow(path, revised):
    c = new_pdf(path, "Correspondence directory")
    for page in range(1, 3):
        page_frame(c, "Correspondence directory", page, 2)
        if page == 1:
            address_block(c, "Harbor Example Insurance Ltd", "12 Mariner Walk",
                          "Ridgehaven", "RG1 4AB", 155, revised)
            address_block(c, "Meadow Example Services Ltd", "48 Willow Crescent",
                          "Ridgehaven", "RG1 8CD", 455, revised)
        else:
            line(c, "Delivery instructions", top=160, size=13, bold=True)
            line(c, "Each address belongs to the company immediately above it.", top=225)
            line(c, "All deliveries require an appointment.", top=265)
            line(c, "Harbor depot reference: HBR-17.", top=325)
            line(c, "Meadow depot reference: MDW-28.", top=365)
            line(c, "The directory contains two companies in Ridgehaven.", top=425)
        c.showPage()
    c.save()


def logo_png():
    """A deterministic abstract raster mark, without brand or customer data."""
    w, h = 48, 24
    rows = bytearray()
    for y in range(h):
        rows.append(0)
        for x in range(w):
            color = (235, 242, 249)
            if 5 <= x <= 12 and 4 <= y <= 19:
                color = (29, 72, 113)
            elif 18 <= x <= 25 and 8 <= y <= 19:
                color = (54, 114, 157)
            elif 31 <= x <= 38 and 12 <= y <= 19:
                color = (93, 158, 183)
            rows.extend(color)
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")


def mixed_review(path, revised):
    c = new_pdf(path, "Equipment service schedule")
    logo = ImageReader(io.BytesIO(logo_png()))
    for page in range(1, 7):
        page_frame(c, "Equipment service schedule", page, 6)
        c.drawImage(logo, 438, HEIGHT - 68, width=48, height=24, mask="auto")
        # Deliberately far apart on a shared baseline: independent header items.
        line(c, "DOC-0042", x=88, top=123, size=9)
        line(c, "812", x=505, top=123, size=9)
        line(c, f"Schedule section {page}.", top=175, size=13, bold=True)
        if page == 1:
            year = "2027" if revised else "2026"
            line(c, "Insured: Harbor Example Aviation Ltd.", top=235)
            line(c, f"Period: 1 January {year} to 31 December {year}.", top=280)
            line(c, "Currency: USD.", top=325)
            line(c, "The agreed local inspection office is unchanged.", top=385)
        elif page == 2:
            line(c, "Equipment cover", top=235, size=12, bold=True)
            line(c, "Limit: USD 1,500,000." if revised else "Limit: USD 1,250,000.", top=280)
            line(c, "Deductible: USD 5,000.", top=325)
            line(c, "The limit applies separately to each reported occurrence.", top=385)
        elif page == 3:
            line(c, "Storage conditions", top=235, size=12, bold=True)
            line(c, "Cover is not provided for equipment stored outdoors." if revised else
                    "Cover is provided for equipment stored outdoors.", top=280)
            line(c, "Indoor storage conditions remain unchanged.", top=340)
            if revised:
                line(c, "Operators must retain", top=400)
                line(c, "the signed inspection register.", top=414)
            else:
                line(c, "Operators must retain the signed inspection register.", top=400)
        elif page == 4:
            line(c, "Incident administration", top=235, size=12, bold=True)
            line(c, "A supervisor must be notified after an incident.", top=280)
            if revised:
                line(c, "A written incident report must be submitted within 14 days.", top=340)
            line(c, "Emergency contact arrangements remain unchanged.", top=400)
            if revised:
                line(c, "SERVICE COPY", top=465, size=8)
        elif page == 5:
            line(c, "Record retention", top=235, size=12, bold=True)
            line(c, "The electronic incident register must be retained.", top=280)
            if not revised:
                line(c, "A duplicate paper log must be retained at the depot.", top=340)
            line(c, "The register may be inspected during office hours.", top=400)
            line(c, "Signed copies remain available." + ("  " if revised else ""), top=450)
        else:
            line(c, "Location sublimits", top=235, size=12, bold=True)
            line(c, "Location", x=92, top=285, bold=True)
            line(c, "Amount", x=365, top=285, bold=True)
            line(c, "North depot", x=92, top=325)
            line(c, "USD 500,000" if revised else "USD 250,000", x=365, top=325)
            line(c, "South depot", x=92, top=365)
            line(c, "USD 250,000" if revised else "USD 500,000", x=365, top=365)
            line(c, "No other location is included in this schedule.", top=425)
        line(c, "SERVICE COPY", top=HEIGHT - 60, size=8)
        if page in (2, 5):
            line(c, " " if not revised else "  ", x=96, top=565)
        c.showPage()
    c.save()


def header_digit(path, revised):
    c = new_pdf(path, "Equipment service schedule")
    page_frame(c, "Equipment service schedule", 1, 1)
    # Same independent header positions as case D. Only one identifier digit
    # changes; the distant number and all surrounding text remain identical.
    line(c, "DOC-0043" if revised else "DOC-0042", x=88, top=123, size=9)
    line(c, "812", x=505, top=123, size=9)
    line(c, "Schedule section 1.", top=175, size=13, bold=True)
    line(c, "Equipment service records.", top=235)
    line(c, "The register remains available during office hours.", top=280)
    c.showPage()
    c.save()


BUILDERS = {"a-whitespace": whitespace, "b-duplicate-context": duplicate_context,
            "c-address-reflow": address_reflow, "d-review-mixed": mixed_review,
            "e-header-digit": header_digit}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = {"schemaVersion": "review-readability-manifest/1", "fixtureVersion": 2,
                "generator": "generate.py", "reportlabVersion": reportlab.Version,
                "documentsAreFictional": True,
                "productReproductionStatus": "See the separate verification report; generation alone does not establish reproduction.",
                "cases": []}
    for case, pages in CASES.items():
        folder = args.out / case
        folder.mkdir(parents=True, exist_ok=True)
        entry = {"caseId": case, "documents": {}}
        for side in ("baseline", "revised"):
            path = folder / f"{side}.pdf"
            BUILDERS[case](path, side == "revised")
            data = path.read_bytes()
            count = len(PdfReader(path).pages)
            assert count == pages, (case, side, count)
            entry["documents"][side] = {"path": f"{case}/{side}.pdf", "pages": count,
                                         "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        manifest["cases"].append(entry)
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
