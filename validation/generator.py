#!/usr/bin/env python3
"""Deterministic, explicitly labelled synthetic insurance PDF comparison fixtures.

Ground truth comes from explicit source-model mutations, never from a PDF
extraction or comparison engine. Run fixture_checks.py after generation.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import io
import json
import math
from pathlib import Path
import random
import textwrap

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT = A4
SCHEMA = "synthetic-policy-validation/1.0"
FONT_PATH = ROOT / "assets" / "DejaVuSans.ttf"


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def base_document(seed):
    rng = random.Random(seed)
    amount = rng.choice([2_000_000, 3_500_000, 4_250_000])
    deductible = rng.choice([10_000, 15_000, 25_000])
    fields = [
        {"path": "risk_details.original_insured.name", "label": "INSURED:", "value": "Example Aviation Test Company"},
        {"path": "risk_details.original_insured.address", "label": "ADDRESS:", "value": "Office 5, 8 Example Road, Test City, Malaysia"},
        {"path": "risk_details.reinsured.name", "label": "REINSURED:", "value": "Demonstration Reinsurance Test Company"},
        {"path": "risk_details.reinsured.address", "label": "ADDRESS:", "value": "Office 2, 9 Fictional Avenue, Test City, Singapore"},
        {"path": "risk_details.policy_period", "label": "PERIOD:", "value": "01 April 2024 to 31 March 2025 (both dates inclusive)"},
        {"path": "risk_details.sum_insured", "label": "SUMS INSURED:", "value": f"USD {amount:,}"},
        {"path": "risk_details.deductible", "label": "DEDUCTIBLE:", "value": f"USD {deductible:,} each loss"},
        {"path": "risk_details.rate", "label": "RATE:", "value": "1.5% of the declared value"},
        {"path": "risk_details.tolerance", "label": "TOLERANCE:", "value": "± 5% of the declared amount"},
        {"path": "risk_details.endorsement", "label": "ENDORSEMENT:", "value": "Separate endorsement applies only when expressly included."},
    ]
    clauses = [
        {"id": "loss_payment", "title": "LOSS PAYMENT",
         "text": "The insurer will pay covered losses arising from approved operations worldwide. Payment remains subject to the stated limit and deductible."},
        {"id": "notification", "title": "NOTIFICATION",
         "text": "The insured shall notify the insurer within thirty days after discovery. A written description of the loss must accompany the notice."},
        {"id": "territory", "title": "TERRITORIAL SCOPE",
         "text": "Cover applies to approved operations worldwide, subject to all stated exclusions."},
    ]
    rows = [
        {"row_id": f"aircraft_{i+1}", "registration": f"TEST-{chr(65+i)}{rng.randrange(100,999)}",
         "serial": f"SYN-{seed % 10000:04d}-{i+1:03d}",
         "model": f"Training Type {chr(65+i)}", "currency": "USD",
         "agreed_value": f"{(i+2)*750000:,}"}
        for i in range(5)
    ]
    return {
        "synthetic_only": True,
        "document_title": "FICTIONAL AVIATION POLICY SCHEDULE",
        "header_limit": f"USD {amount:,}",
        "fields": fields, "clauses": clauses, "table": rows,
        "tail_clauses": [], "rotated_status": None,
        "layout": {"font": "FixtureSans", "font_size": 9.5,
                   "split_notification": False, "repage_clauses": False,
                   "table_break_after": None},
        "image_only_page": None, "inline_image": None,
    }


def field(doc, path):
    return next(f for f in doc["fields"] if f["path"] == path)


def clause(doc, clause_id):
    return next(c for c in doc["clauses"] if c["id"] == clause_id)


def event(path, old, new, *, operation="replace", kinds=None,
          severity="critical", detection="must_detect", category=None):
    return {
        "event_id": "", "logical_path": path, "operation": operation,
        "old": old, "new": new, "severity": severity,
        "detection_requirement": detection,
        "must_detect": detection == "must_detect",
        "may_fold": False,
        "acceptable_kinds": kinds or ["Replaced"],
        "acceptable_categories": category or ["Material", "Review"],
        "require_source_evidence": True,
    }


def make_cases(seed):
    cases = []

    def add(slug, title, rule, before, after, events=None, *,
            status="complete_for_scope", invariants=None, coverage=None, notes=None):
        number = len(cases) + 1
        case_id = f"R{number:02d}_{slug}"
        events = events or []
        for i, e in enumerate(events):
            e["event_id"] = f"{case_id}:E{i+1}"
        cases.append({
            "case_id": case_id, "title_zh": title, "rule": rule,
            "before": before, "after": after,
            "expected": {
                "schema": SCHEMA, "case_id": case_id, "seed": seed,
                "oracle_origin": "explicit_source_mutation",
                "scope": "extracted_text",
                "required_status": status,
                "events": events,
                "invariants": invariants or [],
                "coverage_requirements": coverage or [],
                "default_text_change_visibility": "visible_no_automatic_folding",
                "notes": notes or [],
            }
        })

    def fresh():
        b = base_document(seed)
        return b, copy.deepcopy(b)

    b, a = fresh()
    add("identical", "同一内容与同一版式", "identity", b, a,
        invariants=["no_content_differences", "no_material_differences"])

    b, a = fresh()
    p = "risk_details.sum_insured"
    old = field(b, p)["value"]
    new = "USD " + f"{int(old.split(' ')[1].replace(',', '')) * 2:,}"
    field(a, p)["value"] = new
    add("amount", "保额翻倍", "replace_field_amount", b, a, [event(p, old, new)])

    b, a = fresh()
    p = "risk_details.sum_insured"
    old = field(b, p)["value"]
    new = old.replace("USD", "EUR")
    field(a, p)["value"] = new
    add("currency", "金额相同但币种改变", "replace_currency_only", b, a, [event(p, old, new)])

    b, a = fresh()
    p = "risk_details.rate"
    field(a, p)["value"] = "15% of the declared value"
    add("decimal", "1.5% 变为 15%", "remove_decimal_point", b, a,
        [event(p, field(b, p)["value"], field(a, p)["value"])])

    b, a = fresh()
    c = clause(a, "territory")
    c["text"] = c["text"].replace("Cover applies", "Cover does not apply")
    add("negation", "插入否定词", "insert_negation", b, a,
        [event("clauses.territory.text", clause(b, "territory")["text"], c["text"])])

    b, a = fresh()
    clause(b, "territory")["text"] = "Cover applies when inspection and approval have been completed."
    a = copy.deepcopy(b)
    clause(a, "territory")["text"] = "Cover applies when inspection or approval have been completed."
    add("and_or", "and 变为 or", "replace_logical_operator", b, a,
        [event("clauses.territory.text", clause(b, "territory")["text"], clause(a, "territory")["text"])])

    b, a = fresh()
    p = "risk_details.policy_period"
    field(b, p)["value"] = "06 January 2023 to 31 March 2024 (both dates inclusive)"
    field(a, p)["value"] = "01 April 2024 to 31 March 2025 (both dates inclusive)"
    add("shorter_term", "连续但约十五个月变十二个月", "continuous_period_shortens", b, a,
        [event(p, field(b, p)["value"], field(a, p)["value"])],
        invariants=["must_not_classify_as_unchanged_duration_roll_forward"])

    b, a = fresh()
    p = "risk_details.policy_period"
    field(a, p)["value"] = "01 April 2025 to 31 March 2026 (both dates inclusive)"
    add("normal_renewal", "普通年度顺延也必须可见", "calendar_year_roll_forward", b, a,
        [event(p, field(b, p)["value"], field(a, p)["value"],
               severity="reviewable", category=["RollForward", "Review"])],
        notes=["高敏感默认视图要求展示该变化；识别为续期并不授权自动折叠。"])

    b, a = fresh()
    old = b["header_limit"]
    a["header_limit"] = "USD " + f"{int(old.split(' ')[1].replace(',', '')) * 2:,}"
    add("header_limit", "重复页眉里的限额改变", "replace_repeated_header_amount", b, a,
        [event("repeated_header.limit", old, a["header_limit"])],
        invariants=["header_role_must_not_exclude_text",
                    "grouping_allowed_only_with_all_occurrence_locations"])

    b, a = fresh()
    p1, p2 = "risk_details.original_insured.address", "risk_details.reinsured.address"
    field(a, p1)["value"], field(a, p2)["value"] = field(b, p2)["value"], field(b, p1)["value"]
    add("address_swap", "同名 ADDRESS 属于不同主体", "swap_two_party_addresses", b, a,
        [event(p1, field(b, p1)["value"], field(a, p1)["value"]),
         event(p2, field(b, p2)["value"], field(a, p2)["value"])],
        invariants=["must_not_match_values_across_party_identity"])

    b, a = fresh()
    p = "risk_details.sum_insured"
    field(a, p)["label"] = "SUM INSURED:"
    add("label_alias", "字段别名变化保留原文差异", "replace_label_alias", b, a,
        [event(p + ".label", "SUMS INSURED:", "SUM INSURED:",
               severity="reviewable", category=["Cosmetic", "Review"])],
        invariants=["no_amount_or_currency_change", "same_field_identity"])

    b, a = fresh()
    moved = a["clauses"].pop(0)
    a["tail_clauses"].append(moved)
    add("exact_move", "原样条款移到表格之后", "move_exact_clause_after_table", b, a,
        [event("clauses.loss_payment", moved["text"], moved["text"], operation="move",
               kinds=["Moved"], severity="reviewable", category=["Review", "Material"])],
        invariants=["moved_clause_has_no_internal_word_edits"])

    b, a = fresh()
    moved = a["clauses"].pop(0)
    replacement = copy.deepcopy(moved)
    replacement["id"] = "new_loss_payment"
    replacement["text"] = moved["text"].replace("covered losses", "approved losses")
    a["clauses"].insert(0, replacement)
    a["tail_clauses"].append(moved)
    add("move_and_replacement", "原样移动与原位相似新增竞争", "move_then_insert_similar", b, a,
        [event("clauses.loss_payment", moved["text"], moved["text"], operation="move",
               kinds=["Moved"], severity="reviewable", category=["Review", "Material"]),
         event("clauses.new_loss_payment", None, replacement["text"], operation="add",
               kinds=["Added"])],
        invariants=["exact_move_must_not_be_consumed_by_local_replacement"])

    b, a = fresh()
    old = "The insurer will pay losses arising from approved operations worldwide."
    new = "The insurer will pay losses arising from approved operations domestically."
    clause(b, "loss_payment")["text"] = old
    clause(a, "loss_payment")["text"] = new
    add("short_paragraph", "十词短段落只改一个词", "replace_one_of_ten_words", b, a,
        [event("clauses.loss_payment.text", old, new)],
        notes=["同一条款身份明确时应保留修改；不因移动阈值排除变更。"])

    b, a = fresh()
    a["layout"]["split_notification"] = True
    add("paragraph_split", "一段改为两段但文字相同", "split_paragraph_layout_only", b, a,
        invariants=["no_material_differences", "no_false_text_added_or_removed"],
        notes=["允许报告排版变化；同一字段内的分段变化不等于业务内容增删。"])

    b, a = fresh()
    a["layout"]["repage_clauses"] = True
    add("repagination", "条款重分页但逻辑顺序相同", "repage_preserve_logical_order", b, a,
        invariants=["no_material_differences", "no_false_clause_moves",
                    "all_source_text_preserved"])

    b, a = fresh()
    a["layout"]["font"] = "Helvetica"
    a["layout"]["font_size"] = 10.0
    add("font_change", "字体和字号改变但文字相同", "replace_font_layout_only", b, a,
        invariants=["no_material_differences", "no_content_differences"],
        notes=["字体样式比较不属于本验证集的必须发现项；不得制造业务变化。"])

    b, a = fresh()
    p = "risk_details.original_insured.address"
    field(a, p)["value"] = field(a, p)["value"].replace("Office", "Ofﬁce")
    add("ligature", "fi 连字与两个字符的来源映射", "substitute_fi_ligature", b, a,
        [event(p, field(b, p)["value"], field(a, p)["value"], severity="reviewable",
               category=["Cosmetic", "Review"])],
        invariants=["same_address_identity", "ligature_geometry_not_uniformly_guessed"],
        notes=["字体内真实 U+FB01 字形；验证核心保留原文与展开后索引的关系。"])

    b, a = fresh()
    b["rotated_status"] = "DRAFT"
    a["rotated_status"] = "CANCELLED"
    add("rotated_status", "旋转状态文字改变", "replace_rotated_text", b, a,
        [event("document.status", "DRAFT", "CANCELLED")],
        invariants=["rotation_must_not_exclude_text"])

    b, a = fresh()
    p = "risk_details.tolerance"
    field(a, p)["value"] = "+ 5% of the declared amount"
    add("plus_minus", "正负符号变为正号", "replace_mathematical_symbol", b, a,
        [event(p, field(b, p)["value"], field(a, p)["value"])])

    b, a = fresh()
    p = "risk_details.endorsement"
    field(b, p)["value"] = "☐ Additional coverage included"
    field(a, p)["value"] = "☑ Additional coverage included"
    add("checkbox_glyph", "可提取的勾选符号改变", "replace_checkbox_unicode_glyph", b, a,
        [event(p, field(b, p)["value"], field(a, p)["value"])],
        notes=["这是文本字形，不是 AcroForm 控件或矢量勾选框；后两类未在此用例声称覆盖。"])

    b, a = fresh()
    row = a["table"][1]
    old = row["agreed_value"]
    row["agreed_value"] = f"{int(old.replace(',', '')) + 250000:,}"
    p = "aircraft_schedule." + row["serial"] + ".agreed_value"
    add("table_value", "同一架飞机的约定价值改变", "replace_keyed_cell_amount", b, a,
        [event(p, old, row["agreed_value"])],
        invariants=["match_row_by_registration_or_declared_serial"])

    b, a = fresh()
    a["table"] = [a["table"][3], a["table"][0], a["table"][4], a["table"][1], a["table"][2]]
    add("table_reorder", "表格行重排但实体和值不变", "permute_rows_preserve_identity", b, a,
        invariants=["no_material_differences", "no_false_row_additions_or_deletions",
                    "all_aircraft_values_attached_to_original_identity"],
        notes=["允许显示行顺序变化；绝不能按原行号把不同飞机配成金额变化。"])

    b, a = fresh()
    a["layout"]["table_break_after"] = 2
    add("table_cross_page", "表格跨页并重复表头", "split_table_with_repeated_header", b, a,
        invariants=["no_material_differences", "no_false_row_additions_or_deletions",
                    "same_logical_row_order"])

    b, a = fresh()
    for d in (b, a):
        d["table"][1]["registration"] = d["table"][0]["registration"]
        d["table"][1]["serial"] = d["table"][0]["serial"]
    old = a["table"][1]["agreed_value"]
    a["table"][1]["agreed_value"] = f"{int(old.replace(',', '')) + 125000:,}"
    ambiguous_event = event(
        "aircraft_schedule.ambiguous_duplicate_group.agreed_value", old,
        a["table"][1]["agreed_value"],
        detection="visible_text_delta_with_identity_review",
        kinds=["Replaced", "Added+Removed", "Unresolved"])
    ambiguous_event.update({
        "require_visible_text_delta": True,
        "must_detect_text_delta": True,
        "identity_resolution": "may_remain_unresolved",
        "required_visible_values": {
            "before": old,
            "after": a["table"][1]["agreed_value"],
        },
        "require_both_side_source_links": True,
        "duplicate_key_warning_alone_is_failure": True,
    })
    add("duplicate_keys", "主键和次级键都重复且数值改变", "duplicate_keys_and_replace_amount", b, a,
        [ambiguous_event],
        status="partial_or_explicit_review",
        invariants=["duplicate_identity_must_be_reported",
                    "must_not_assert_unique_row_identity_without_evidence",
                    "must_not_claim_no_changes",
                    "old_and_new_amount_delta_must_remain_visible",
                    "unresolved_identity_does_not_waive_text_change_detection",
                    "duplicate_key_warning_alone_is_not_a_pass"],
        notes=["可以不确定金额属于哪一实体，但必须可见展示重复键组的金额变化或未配对差异，并链接两侧原文。仅提示键重复不能算发现金额变化。"])

    b, a = fresh()
    row = a["table"][2]
    old = row["registration"]
    row["registration"] = "TEST-RENAMED"
    add("key_change", "注册号改变但序列号保留", "replace_primary_key_keep_secondary", b, a,
        [event("aircraft_schedule." + row["serial"] + ".registration",
               old, row["registration"], kinds=["Replaced", "Added+Removed"])],
        invariants=["agreed_value_unchanged", "secondary_key_or_explicit_identity_review"])

    b, a = fresh()
    b["table"] = a["table"] = []
    b["image_only_page"] = "SCAN ENDORSEMENT\nThe maximum liability is USD 500,000.\nAll other terms remain unchanged."
    a["image_only_page"] = "SCAN ENDORSEMENT\nThe maximum liability is USD 900,000.\nAll other terms remain unchanged."
    add("mixed_scan_page", "文字页夹整页扫描条款", "change_raster_only_page", b, a,
        [event("uncovered_image_page.maximum_liability", "USD 500,000", "USD 900,000",
               detection="coverage_warning_required", kinds=["CoverageIssue"])],
        status="partial",
        invariants=["must_not_claim_complete_or_no_changes"],
        coverage=[{"side": "both", "page_index": 1, "reason": "raster_only_content",
                   "must_report": True}],
        notes=["无 OCR 的 v1 不要求读出图中金额；必须明确该页未完成比较。"])

    b, a = fresh()
    b["inline_image"] = "IMAGE CLAUSE\nThe insurer will not cover flood losses.\nThis clause exists only inside an image."
    a["inline_image"] = "IMAGE CLAUSE\nThe insurer will cover flood losses.\nThis clause exists only inside an image."
    add("inline_scan", "有文字的页面内嵌扫描条款", "change_embedded_raster_clause", b, a,
        [event("uncovered_inline_image.flood_coverage", "will not cover", "will cover",
               detection="coverage_warning_required", kinds=["CoverageIssue"])],
        status="partial",
        invariants=["text_elsewhere_on_page_does_not_prove_full_coverage",
                    "must_not_claim_complete_or_no_changes"],
        coverage=[{"side": "both", "page_index": 1, "reason": "unverified_image_text_region",
                   "must_report": True}],
        notes=["无 OCR 的 v1 不要求识别图中文字变化；必须提示该区域的未覆盖风险。"])

    b, a = fresh()
    new = {"id": "new_exclusion", "title": "ADDITIONAL EXCLUSION",
           "text": "Losses arising from unapproved night operations are excluded."}
    a["clauses"].append(new)
    add("clause_add", "新增除外条款", "append_exclusion", b, a,
        [event("clauses.new_exclusion", None, new["text"], operation="add", kinds=["Added"])])

    b, a = fresh()
    old = a["clauses"].pop(2)
    add("clause_delete", "删除原有条款", "remove_clause", b, a,
        [event("clauses.territory", old["text"], None, operation="remove", kinds=["Removed"])])

    b, a = fresh()
    old = "Cover includes liability for fire, theft and flood."
    new = "Cover includes liability for fire theft and flood."
    clause(b, "territory")["text"] = old
    clause(a, "territory")["text"] = new
    add("punctuation", "逗号删除也必须生成可见变化", "remove_punctuation", b, a,
        [event("clauses.territory.text", old, new, severity="reviewable",
               category=["Review", "Material"])],
        notes=["本例要求识别标点变化，不自动断言其具体法律影响。"])

    b, a = fresh()
    p = "risk_details.policy_period"
    field(a, p)["value"] = "01 April 2025 to 31 March 2026 (both dates inclusive)"
    q = "risk_details.sum_insured"
    old = field(b, q)["value"]
    field(a, q)["value"] = "USD " + f"{int(old.split(' ')[1].replace(',', '')) + 500000:,}"
    add("combined_changes", "正常顺延同时伴随保额变化", "combine_renewal_and_amount", b, a,
        [event(p, field(b, p)["value"], field(a, p)["value"], severity="reviewable",
               category=["RollForward", "Review"]),
         event(q, old, field(a, q)["value"])],
        invariants=["renewal_classification_must_not_hide_amount_change"])
    assert len(cases) == 32
    return cases


class Renderer:
    def __init__(self, path, doc):
        self.doc = doc
        self.c = canvas.Canvas(str(path), pagesize=A4, invariant=1, pageCompression=1)
        self.c.setTitle("SYNTHETIC TEST - Fictional aviation policy schedule")
        self.c.setAuthor("Synthetic validation fixture generator")
        self.c.setSubject("Synthetic test only; not a real insurance contract")
        self.pages = []
        self.page = None
        self.font = doc["layout"]["font"]
        self.size = doc["layout"]["font_size"]
        self.run_number = 0

    def text(self, text, x, y, *, size=None, font=None, path=None, role="body", angle=0):
        size, font = size or self.size, font or self.font
        self.c.saveState()
        self.c.setFillColor(colors.HexColor("#132d46"))
        self.c.translate(x, y)
        self.c.rotate(angle)
        self.c.setFont(font, size)
        self.c.drawString(0, 0, text)
        self.c.restoreState()
        ascent, descent = pdfmetrics.getAscentDescent(font, size)
        theta = math.radians(angle)
        co, si = math.cos(theta), math.sin(theta)
        def point(lx, ly):
            return [round(x + lx * co - ly * si, 5),
                    round(HEIGHT - (y + lx * si + ly * co), 5)]
        chars, offset = [], 0.0
        for i, ch in enumerate(text):
            advance = pdfmetrics.stringWidth(ch, font, size)
            chars.append({
                "scalar_index": i, "scalar": ch, "origin": point(offset, 0),
                "quad_tl_tr_br_bl": [
                    point(offset, ascent), point(offset + advance, ascent),
                    point(offset + advance, descent), point(offset, descent)],
            })
            offset += advance
        self.run_number += 1
        self.page["text_runs"].append({
            "run_id": f"run_{self.run_number:04d}", "logical_path": path,
            "role": role, "text": text, "font": font, "font_size": size,
            "origin": point(0, 0), "direction": [round(co, 8), round(-si, 8)],
            "characters": chars,
            "geometry_provenance": "generator_font_advance_and_ascent_descent",
            "geometry_note": "Logical character cell, not exact ink outline or extractor output.",
        })

    def wrap(self, text, width, size=None, font=None):
        size, font = size or self.size, font or self.font
        lines, current = [], ""
        for word in text.split(" "):
            candidate = current + (" " if current else "") + word
            if current and pdfmetrics.stringWidth(candidate, font, size) > width:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        return lines

    def para(self, text, x, y, width, path, *, size=None, leading=15):
        for line in self.wrap(text, width, size=size):
            self.text(line, x, y, size=size, path=path)
            y -= leading
        return y

    def new_page(self, heading=None, *, raster_only=False):
        if self.page is not None:
            self.c.showPage()
        self.page = {"page_index": len(self.pages), "width_pt": WIDTH, "height_pt": HEIGHT,
                     "text_runs": [], "image_regions": []}
        self.pages.append(self.page)
        if raster_only:
            return
        self.c.setFillColor(colors.HexColor("#e9f3f8"))
        self.c.rect(0, HEIGHT - 105, WIDTH, 105, stroke=0, fill=1)
        self.text("SYNTHETIC TEST - NOT A REAL POLICY", 42, HEIGHT-29, size=9, role="test_notice")
        self.text("REPEATED HEADER LIMIT: " + self.doc["header_limit"],
                  42, HEIGHT-49, size=9, path="repeated_header.limit", role="header")
        self.text(heading or self.doc["document_title"], 42, HEIGHT-81, size=15, role="heading")
        self.text("FICTIONAL FIXTURE  |  PAGE " + str(len(self.pages)), 42, 24, size=8, role="footer")

    def draw_clauses(self, clauses, y):
        for c in clauses:
            if y < 140:
                self.new_page("POLICY WORDING CONTINUED")
                y = HEIGHT - 136
            self.text(c["title"], 42, y, size=10, path=f"clauses.{c['id']}.title", role="heading")
            y -= 21
            text = c["text"]
            if c["id"] == "notification" and self.doc["layout"]["split_notification"]:
                parts = text.split(". ", 1)
                y = self.para(parts[0] + ".", 42, y, WIDTH-84, f"clauses.{c['id']}.text")
                y -= 18
                y = self.para(parts[1], 42, y, WIDTH-84, f"clauses.{c['id']}.text")
            else:
                y = self.para(text, 42, y, WIDTH-84, f"clauses.{c['id']}.text")
            y -= 24
        return y

    def raster(self, contents, *, full_page=False):
        image_width = 1200
        image_height = 1640 if full_page else 260
        im = Image.new("RGB", (image_width, image_height), "#f6f7f9")
        draw = ImageDraw.Draw(im)
        font = ImageFont.truetype(str(FONT_PATH), 23)
        big = ImageFont.truetype(str(FONT_PATH), 30)
        draw.rectangle((8, 8, image_width-8, image_height-8), outline="#64748b", width=4)
        y = 42
        if full_page:
            draw.text((50, y), "SYNTHETIC TEST - IMAGE ONLY PAGE", font=big, fill="#173b56")
            y += 94
        for text in contents.split("\n"):
            for line in textwrap.wrap(text, width=78):
                draw.text((50, y), line, font=font, fill="#173b56")
                y += 39
            y += 12
        if full_page:
            x, y0, w, h = 20, 25, WIDTH-40, HEIGHT-50
        else:
            x, y0, w, h = 42, 285, WIDTH-84, 112
        self.c.drawImage(ImageReader(im), x, y0, width=w, height=h)
        self.page["image_regions"].append({
            "bbox_top_left_pt": [x, HEIGHT-y0-h, x+w, HEIGHT-y0],
            "source_text_for_oracle_only": contents,
            "has_pdf_text_layer": False,
            "role": "raster_only_page" if full_page else "embedded_raster_clause",
        })

    def table(self):
        rows = self.doc["table"]
        if not rows:
            return None
        self.new_page("SCHEDULE OF AIRCRAFT")
        y = HEIGHT - 136
        columns = [
            ("REGISTRATION", "registration", 42),
            ("SERIAL", "serial", 152),
            ("MODEL", "model", 286),
            ("CCY", "currency", 407),
            ("AGREED VALUE", "agreed_value", 447),
        ]
        def heading(y):
            self.c.setFillColor(colors.HexColor("#e5edf4"))
            self.c.rect(37, y-7, WIDTH-74, 25, fill=1, stroke=0)
            for label, key, x in columns:
                self.text(label, x, y, size=7.9, path="aircraft_schedule.header."+key, role="table_header")
            return y-33
        y = heading(y)
        for i, row in enumerate(rows):
            if self.doc["layout"]["table_break_after"] == i:
                self.new_page("SCHEDULE OF AIRCRAFT CONTINUED")
                y = heading(HEIGHT-136)
            for label, key, x in columns:
                p = f"aircraft_schedule.{row['serial']}.{key}"
                self.text(row[key], x, y, size=8.3, path=p, role="table_cell")
            self.c.setStrokeColor(colors.HexColor("#d7e0e8"))
            self.c.line(38, y-10, WIDTH-38, y-10)
            y -= 35
        return y - 35

    def render(self):
        self.new_page()
        y = HEIGHT - 132
        for f in self.doc["fields"]:
            self.text(f["label"], 42, y, size=8.4, path=f["path"] + ".label", role="field_label")
            end = self.para(f["value"], 180, y, WIDTH-222, f["path"], leading=14)
            y = end - 9
        if self.doc["layout"]["repage_clauses"]:
            self.new_page("POLICY WORDING")
            y = HEIGHT - 135
        else:
            y -= 16
        y = self.draw_clauses(self.doc["clauses"], y)
        if self.doc["rotated_status"]:
            self.text(self.doc["rotated_status"], 405, 116, size=21,
                      path="document.status", role="status", angle=32)
        if self.doc["image_only_page"]:
            self.new_page(raster_only=True)
            self.raster(self.doc["image_only_page"], full_page=True)
        else:
            table_y = self.table()
            if self.doc["tail_clauses"]:
                self.draw_clauses(self.doc["tail_clauses"], table_y or HEIGHT-135)
            if self.doc["inline_image"]:
                self.raster(self.doc["inline_image"])
        self.c.save()
        return {
            "schema": SCHEMA,
            "coordinate_system": "top-left visible A4 page, x right, y down, PDF points",
            "index_unit": "Unicode scalar; half-open when represented as ranges",
            "quad_order": "top-left, top-right, bottom-right, bottom-left",
            "pages": self.pages,
        }


def generate(output, seed):
    pdfmetrics.registerFont(TTFont("FixtureSans", str(FONT_PATH)))
    output.mkdir(parents=True, exist_ok=True)
    cases = make_cases(seed)
    index = []
    for spec in cases:
        directory = output / "cases" / spec["case_id"]
        directory.mkdir(parents=True, exist_ok=True)
        layouts = {}
        for side in ("before", "after"):
            layouts[side] = Renderer(directory / (side + ".pdf"), spec[side]).render()
        source = {
            "schema": SCHEMA, "case_id": spec["case_id"], "seed": seed,
            "title_zh": spec["title_zh"], "mutation_rule": spec["rule"],
            "before": spec["before"], "after": spec["after"],
            "provenance": "Fictional structured source data and explicit deterministic mutation",
        }
        spec["expected"]["source_sha256"] = hashlib.sha256(
            json.dumps(source, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        spec["expected"]["evidence_locations"] = {}
        for e in spec["expected"]["events"]:
            locations = {}
            for side in ("before", "after"):
                matches = []
                event_path = e["logical_path"]
                for page in layouts[side]["pages"]:
                    for run in page["text_runs"]:
                        run_path = run["logical_path"] or ""
                        ambiguous_amount_group = (
                            event_path == "aircraft_schedule.ambiguous_duplicate_group.agreed_value"
                            and run_path == (
                                "aircraft_schedule." + spec[side]["table"][0]["serial"]
                                + ".agreed_value"))
                        if (ambiguous_amount_group or
                                run_path == event_path or run_path.startswith(event_path + ".")
                                or event_path.startswith(run_path + ".") and run_path):
                            ref = {"page_index": page["page_index"],
                                   "run_id": run["run_id"]}
                            if ambiguous_amount_group:
                                ref.update({
                                    "text": run["text"],
                                    "raw_scalar_range": [0, len(run["text"])],
                                    "reference_scope": "duplicate_key_group_amount_cell",
                                })
                            matches.append(ref)
                    if event_path.startswith("uncovered_"):
                        for image_region in page["image_regions"]:
                            matches.append({"page_index": page["page_index"],
                                            "image_bbox_top_left_pt": image_region["bbox_top_left_pt"],
                                            "has_pdf_text_layer": False})
                locations[side] = matches
            spec["expected"]["evidence_locations"][e["event_id"]] = locations
        dump(directory / "source.json", source)
        dump(directory / "expected.json", spec["expected"])
        dump(directory / "layout.json", layouts)
        hashes = {side: hashlib.sha256((directory / (side+".pdf")).read_bytes()).hexdigest()
                  for side in ("before", "after")}
        index.append({
            "case_id": spec["case_id"], "title_zh": spec["title_zh"],
            "rule": spec["rule"], "page_counts": {s:len(layouts[s]["pages"]) for s in layouts},
            "event_count": len(spec["expected"]["events"]),
            "required_status": spec["expected"]["required_status"],
            "pdf_sha256": hashes,
        })
    group_ids = {
        "no_business_change_controls": [1,15,16,17,23,24],
        "fields_numbers_periods": [2,3,4,7,8,9,10,20,32],
        "clauses_and_moves": [5,6,12,13,14,29,30,31],
        "labels_ligatures_status_symbols": [11,18,19,21],
        "table_values_and_identity": [22,25,26],
        "uncovered_raster_content": [27,28],
    }
    for item in index:
        number = int(item["case_id"][1:3])
        item["rule_group"] = next(name for name,numbers in group_ids.items() if number in numbers)
    manifest = {
        "schema": SCHEMA, "seed": seed,
        "synthetic_only": True, "case_count": len(cases), "pdf_count": len(cases)*2,
        "total_pdf_pages": sum(sum(c["page_counts"].values()) for c in index),
        "source_of_truth": "explicit source mutations; not comparison-engine output",
        "not_an_independent_real_world_holdout": True,
        "rule_group_counts": {name:len(numbers) for name,numbers in group_ids.items()},
        "generator_dependencies": {n: importlib.metadata.version(n) for n in ("reportlab","pypdf","Pillow")},
        "cases": index,
    }
    dump(output / "manifest.json", manifest)
    rows = ["# 规则生成验证集用例清单", "", "固定种子：" + str(seed), "",
            "| 编号 | 用例 | 基准页数 | 待审页数 | 预期事件数 | 期望状态 |",
            "| --- | --- | ---: | ---: | ---: | --- |"]
    rows += [f"| {x['case_id']} | {x['title_zh']} | {x['page_counts']['before']} | "
             f"{x['page_counts']['after']} | {x['event_count']} | {x['required_status']} |" for x in index]
    (output / "CASE_CATALOG.zh-CN.md").write_text("\n".join(rows)+"\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "cases": len(cases), "pdfs": len(cases)*2,
                      "pages": manifest["total_pdf_pages"], "seed": seed}, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", type=Path, default=ROOT / "dataset")
    p.add_argument("--seed", type=int, default=20261026)
    args = p.parse_args()
    generate(args.output.resolve(), args.seed)


if __name__ == "__main__":
    main()
