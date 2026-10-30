#!/usr/bin/env python3
"""Validate generated fixture construction, not the PDF comparison product.

This checks that the explicit source mutations, render records and actual PDFs
agree. It does not infer or grade an implementation's diff output.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

from pypdf import PdfReader


def norm(s):
    return re.sub(r"\s+", "", s)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def get_source_value(doc, path):
    """Resolve declared logical event paths without parsing PDF text."""
    if path == "repeated_header.limit":
        return doc["header_limit"]
    if path == "document.status":
        return doc["rotated_status"]
    if path.startswith("risk_details."):
        is_label = path.endswith(".label")
        lookup = path[:-6] if is_label else path
        item = next(f for f in doc["fields"] if f["path"] == lookup)
        return item["label" if is_label else "value"]
    if path.startswith("clauses."):
        ident = path.split(".")[1]
        matches = [c for c in doc["clauses"] + doc["tail_clauses"] if c["id"] == ident]
        return matches[0]["text"] if matches else None
    if path.startswith("aircraft_schedule.") and "ambiguous_duplicate_group" not in path:
        _, serial, key = path.split(".", 2)
        matches = [r for r in doc["table"] if r["serial"] == serial]
        if len(matches) != 1:
            raise ValueError(f"Unexpected non-unique test-source serial {serial}")
        return matches[0][key]
    if path == "aircraft_schedule.ambiguous_duplicate_group.agreed_value":
        # The generator knows the changed source row. The product does not get
        # that hidden identity, so this case's product requirement remains review.
        return doc["table"][1]["agreed_value"]
    return NotImplemented


def check(dataset):
    manifest = load(dataset / "manifest.json")
    failures, cases_report = [], []
    assertions = 0
    def require(condition, message):
        nonlocal assertions
        assertions += 1
        if not condition:
            failures.append(message)

    require(manifest["case_count"] == 32, "Expected 32 fixed rule cases.")
    require(manifest["pdf_count"] == 64, "Expected 64 PDFs.")
    totals = {"cases": 0, "pdfs": 0, "pages": 0, "text_runs": 0,
              "source_characters": 0, "image_regions": 0, "events": 0,
              "must_detect_events": 0, "coverage_only_events": 0,
              "ambiguous_group_events": 0, "repeated_text_requirements": 0}
    for meta in manifest["cases"]:
        case = meta["case_id"]
        folder = dataset / "cases" / case
        source, expected, layout = [load(folder / n) for n in ("source.json","expected.json","layout.json")]
        before_count = len(failures)
        require(source["case_id"] == expected["case_id"] == case, f"{case}: IDs disagree.")
        require(source["seed"] == expected["seed"] == manifest["seed"], f"{case}: Seeds disagree.")
        digest = hashlib.sha256(json.dumps(source, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        require(digest == expected["source_sha256"], f"{case}: Source oracle hash mismatch.")
        require(expected["oracle_origin"] == "explicit_source_mutation", f"{case}: Oracle provenance.")
        for e in expected["events"]:
            totals["events"] += 1
            require(e["may_fold"] is False, f"{case}: Text changes must not auto-fold in this policy.")
            if e["detection_requirement"] == "must_detect":
                totals["must_detect_events"] += 1
            elif e["detection_requirement"] == "coverage_warning_required":
                totals["coverage_only_events"] += 1
            else:
                totals["ambiguous_group_events"] += 1
                require(e["detection_requirement"] == "visible_text_delta_with_identity_review",
                        f"{case}: Ambiguous identity must not waive visible text-delta detection.")
                require(e.get("require_visible_text_delta") is True
                        and e.get("must_detect_text_delta") is True,
                        f"{case}: Missing mandatory visible text-delta requirement.")
                require(e.get("duplicate_key_warning_alone_is_failure") is True,
                        f"{case}: A duplicate-key warning alone must be a failure.")
                require(e.get("require_both_side_source_links") is True,
                        f"{case}: Both-side source links are mandatory.")
                for side, value_key in [("before", "old"), ("after", "new")]:
                    refs = expected["evidence_locations"].get(e["event_id"], {}).get(side, [])
                    require(bool(refs), f"{case}/{side}: Ambiguous amount evidence must not be empty.")
                    require(e.get("required_visible_values", {}).get(side) == e[value_key],
                            f"{case}/{side}: Concrete old/new visible amount is required.")
                    found_exact_value = False
                    for ref in refs:
                        page = layout[side]["pages"][ref["page_index"]]
                        runs = [run for run in page["text_runs"] if run["run_id"] == ref["run_id"]]
                        require(len(runs) == 1,
                                f"{case}/{side}: Evidence run must resolve uniquely on the referenced page.")
                        if len(runs) == 1:
                            run = runs[0]
                            require(ref.get("text") == run["text"],
                                    f"{case}/{side}: Evidence text must match the rendered amount.")
                            require(ref.get("raw_scalar_range") == [0, len(run["text"])],
                                    f"{case}/{side}: Evidence range must cover the concrete amount.")
                            if run["text"] == e[value_key]:
                                found_exact_value = True
                    require(found_exact_value,
                            f"{case}/{side}: Changed amount must have an actual page/run reference.")
            if e["operation"] != "move":
                require(e["old"] != e["new"], f"{case}: Non-move event has equal old/new.")
            for side, key in [("before","old"),("after","new")]:
                value = get_source_value(source[side], e["logical_path"])
                if value is not NotImplemented:
                    require(value == e[key], f"{case}: {e['event_id']} {side} source does not match expected value.")
                elif e["detection_requirement"] == "coverage_warning_required":
                    image_source = source[side]["image_only_page"] or source[side]["inline_image"]
                    require(e[key] in image_source,
                            f"{case}: {e['event_id']} {side} image oracle does not contain expected value.")
        for req in expected.get("repeated_text_requirements", []):
            totals["repeated_text_requirements"] += 1
            pattern = re.escape(req["text"]).replace(re.escape("{page_number}"), r"(\d+)")
            for side in ("before", "after"):
                listed = req["occurrences"][side]
                require(req["counts"][side] == len(listed), f"{case}/{side}: {req['requirement_id']} count.")
                # Every run of this role and path with this text on the side, and nothing else.
                runs = [(page["page_index"], run["run_id"], run["text"]) for page in layout[side]["pages"]
                        for run in page["text_runs"] if run["role"] == req["layout_role"]
                        and run["logical_path"] == req["logical_path"]
                        and (m := re.fullmatch(pattern, run["text"]))
                        and all(int(n) == page["page_index"] + 1 for n in m.groups())]
                require(runs == [(o["page_index"], o["run_id"], o["text"]) for o in listed],
                        f"{case}/{side}: {req['requirement_id']} occurrences differ from the layout record.")
            require(req["counts"]["before"] != req["counts"]["after"],
                    f"{case}: {req['requirement_id']} lists text whose count does not change.")
        for side in ("before", "after"):
            path = folder / (side+".pdf")
            totals["pdfs"] += 1
            require(hashlib.sha256(path.read_bytes()).hexdigest() == meta["pdf_sha256"][side],
                    f"{case}/{side}: PDF hash mismatch.")
            reader = PdfReader(path)
            pages = layout[side]["pages"]
            require(len(reader.pages) == len(pages) == meta["page_counts"][side],
                    f"{case}/{side}: Page count mismatch.")
            for i, (pdf_page, page) in enumerate(zip(reader.pages, pages)):
                totals["pages"] += 1
                extracted = pdf_page.extract_text() or ""
                image_count = len(pdf_page.images)
                require(abs(float(pdf_page.mediabox.width) - page["width_pt"]) < .01,
                        f"{case}/{side}/p{i+1}: Page width.")
                require(abs(float(pdf_page.mediabox.height) - page["height_pt"]) < .01,
                        f"{case}/{side}/p{i+1}: Page height.")
                for run in page["text_runs"]:
                    totals["text_runs"] += 1
                    totals["source_characters"] += len(run["characters"])
                    require(norm(run["text"]) in norm(extracted),
                            f"{case}/{side}/p{i+1}: Missing generated text run {run['run_id']}: {run['text']!r}")
                    require("".join(c["scalar"] for c in run["characters"]) == run["text"],
                            f"{case}/{side}: Character provenance mismatch {run['run_id']}.")
                    for c in run["characters"]:
                        require(c["scalar_index"] < len(run["characters"]),
                                f"{case}/{side}: Character index outside run.")
                        xs = [p[0] for p in c["quad_tl_tr_br_bl"]]
                        ys = [p[1] for p in c["quad_tl_tr_br_bl"]]
                        require(min(xs) >= 0 and max(xs) <= page["width_pt"]
                                and min(ys) >= 0 and max(ys) <= page["height_pt"],
                                f"{case}/{side}/p{i+1}: Character cell outside page in {run['run_id']}.")
                for image in page["image_regions"]:
                    totals["image_regions"] += 1
                    require(image_count >= 1, f"{case}/{side}/p{i+1}: Expected raster object missing.")
                    if image["role"] == "raster_only_page":
                        require(not extracted.strip(), f"{case}/{side}/p{i+1}: Raster-only page unexpectedly has text layer.")
                    else:
                        require(bool(extracted.strip()), f"{case}/{side}/p{i+1}: Mixed page lost native text.")
                    secret_line = image["source_text_for_oracle_only"].split("\n")[1]
                    require(norm(secret_line) not in norm(extracted),
                            f"{case}/{side}/p{i+1}: Oracle image text accidentally leaked into PDF text layer.")
                require("SYNTHETICTEST" in norm(extracted) or any(x["role"] == "raster_only_page" for x in page["image_regions"]),
                        f"{case}/{side}/p{i+1}: Synthetic notice missing.")
        if case.startswith("R01_"):
            require(meta["pdf_sha256"]["before"] == meta["pdf_sha256"]["after"],
                    f"{case}: Identical fixture PDFs should be byte-identical.")
        if case.startswith("R16_") or case.startswith("R24_"):
            require(meta["page_counts"]["after"] > meta["page_counts"]["before"],
                    f"{case}: Intended page split not present.")
        if case.startswith("R25_"):
            for side in ("before","after"):
                r0, r1 = source[side]["table"][:2]
                require(r0["registration"] == r1["registration"] and r0["serial"] == r1["serial"],
                        f"{case}/{side}: Intended duplicate primary and secondary keys absent.")
        if case.startswith("R27_") or case.startswith("R28_"):
            require(expected["required_status"] == "partial", f"{case}: Missing partial requirement.")
        totals["cases"] += 1
        cases_report.append({"case_id": case, "passed_fixture_checks": len(failures) == before_count,
                             "failure_count": len(failures)-before_count})
    require(totals["pages"] == manifest["total_pdf_pages"], "Total page count mismatch.")
    report = {
        "test_subject": "fixture_construction_only",
        "comparison_engine_was_run": False,
        "status": "passed" if not failures else "failed",
        "seed": manifest["seed"], "assertions": assertions,
        "totals": totals, "failures": failures, "cases": cases_report,
        "limits": [
            "This confirms controlled PDF construction, not detection quality of a comparison engine.",
            "Render records describe logical character cells, not exact glyph ink or extractor boxes.",
            "Synthetic rule variants are not independent real-world holdout documents.",
            "Performance and browser responsiveness require separate benchmark runs.",
        ]
    }
    (dataset / "fixture_check_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":report["status"],"assertions":assertions,**totals,
                      "failure_count":len(failures)},ensure_ascii=False))
    if failures:
        for failure in failures[:30]:
            print(failure, file=sys.stderr)
    return 0 if not failures else 1


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset",type=Path,default=Path(__file__).resolve().parent/"dataset")
    args=parser.parse_args()
    raise SystemExit(check(args.dataset.resolve()))
