#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { compareDocs, loadWasm, DEFAULT_BUDGET } from "./bridge.mjs";

function options(args) {
  const out = { assertFixed: false };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--assert-fixed") out.assertFixed = true;
    else if (flag === "--help" || flag === "-h") out.help = true;
    else if (flag === "--wasm" || flag === "--out") {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error("Missing value for " + flag);
      out[flag.slice(2)] = value;
    } else throw new Error("Unknown option: " + flag);
  }
  if (!out.help && !out.wasm) throw new Error("--wasm /path/to/core.wasm is required");
  return out;
}

// Match the core's ECMAScript-style whitespace definition: includes BOM, not NEL.
const space = /[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/gu;
const words = text => String(text ?? "").split(space).filter(Boolean).join(" ");
const isBlank = text => words(text) === "";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

/** Same synthetic character geometry approach as tests/helpers.ts, without repo imports. */
function textDoc(lines) {
  const hash = sha256(JSON.stringify(lines));
  const pages = [];
  for (const [index, line] of lines.entries()) {
    const pi = (line.page ?? 1) - 1;
    while (pages.length <= pi) pages.push({
      pageIndex: pages.length, width: 600, height: 850,
      transform: [1, 0, 0, 1, 0, 0], inverseTransform: [1, 0, 0, 1, 0, 0],
      chars: [], lines: [], issues: [], coverageState: "text",
    });
    const page = pages[pi];
    const y = line.y ?? 100 + page.lines.length * 24;
    let scalar = page.chars.at(-1)?.rawRange[1] ?? 0;
    const ids = [];
    for (const [i, text] of Array.from(line.text).entries()) {
      const id = hash + ":" + pi + ":" + page.chars.length;
      const x = (line.x ?? 40) + i * 6;
      ids.push(id);
      page.chars.push({
        id, text, rawRange: [scalar, ++scalar], origin: [x, y],
        quad: [x, y - 10, x + 6, y - 10, x, y + 2, x + 6, y + 2],
        size: 10, style: "synthetic", precision: "synthetic", provenance: "synthetic",
        sharedGeometry: null,
      });
    }
    page.lines.push({
      id: "l" + index, charIds: ids, direction: [1, 0], writingMode: "horizontal",
      baseline: [line.x ?? 40, y], baselineProvenance: "synthetic",
    });
  }
  return {
    schemaVersion: "policy-compare/0.1.0", contentHash: hash,
    extractor: { name: "manual-test-only", version: "1", options: {} },
    coordinateSystem: "display-top-left-pt/ul-ur-ll-lr", indexUnit: "unicode-scalar",
    pageCount: pages.length, pages, diagnostics: [],
  };
}

const locations = list => (list ?? []).map(loc => ({
  side: loc.side, page: loc.pageIndex + 1, rawRange: loc.rawRange, text: loc.text,
}));
const whitespaceCodePoints = text => isBlank(text)
  ? Array.from(text ?? "", c => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"))
  : undefined;

function compact(result) {
  return {
    coreVersion: result.coreVersion,
    status: result.status,
    stats: result.stats,
    actualdiffs: result.differences.map(d => ({
      kind: d.kind, oldText: d.oldText, newText: d.newText,
      oldWhitespaceCodePoints: whitespaceCodePoints(d.oldText),
      newWhitespaceCodePoints: whitespaceCodePoints(d.newText),
      hasTextChange: d.hasTextChange, defaultVisible: d.defaultVisible, facts: d.facts,
      matchMethod: d.matchEvidence?.method, score: d.matchEvidence?.score,
      left: locations(d.left), right: locations(d.right),
      textOps: (d.textOps ?? []).map(op => ({
        kind: op.kind, text: op.text, left: locations(op.left), right: locations(op.right),
      })),
    })),
    alignment: (result.alignment ?? []).map(a => ({
      leftPage: a.leftPage + 1, leftY: a.leftY, rightPage: a.rightPage + 1, rightY: a.rightY,
    })),
    unresolved: (result.unresolved ?? []).map(u => ({
      reason: u.reason, message: u.message, defaultVisible: u.defaultVisible,
      left: locations(u.left), right: locations(u.right),
    })),
    coverage: (result.coverage ?? []).map(c => ({
      side: c.side, page: c.pageIndex + 1, reason: c.reason, message: c.message,
    })),
  };
}

function blankAt(doc, pageIndex, y) {
  const page = doc.pages[pageIndex];
  if (!page) return false;
  const chars = new Map(page.chars.map(c => [c.id, c.text]));
  const rows = page.lines.filter(line => Math.abs(line.baseline[1] - y) < 0.001);
  return rows.length > 0 && rows.every(line => isBlank(line.charIds.map(id => chars.get(id)).join("")));
}

function hasTargetReference(op, side, doc, page, offset, digit) {
  if (!String(op.text).includes(digit)) return false;
  const target = doc.pages[page - 1].chars.find(c => c.rawRange[0] === offset && c.text === digit);
  return !!target && (op[side] ?? []).some(loc =>
    loc.side === side && loc.pageIndex === page - 1 &&
    loc.rawRange[0] <= offset && offset < loc.rawRange[1] &&
    (loc.charIds ?? []).includes(target.id) &&
    Array.from(loc.text)[offset - loc.rawRange[0]] === digit);
}

function minimumCheck(id, fixture, result, left, right) {
  const diffs = result.differences ?? [];
  const target = fixture.target ?? {};
  let met;
  switch (id) {
    case "no_budget_stop":
      met = !(result.unresolved ?? []).some(u => u.reason === "budget" || u.reason === "word_diff_budget");
      break;
    case "no_visible_blank_difference":
      met = !diffs.some(d => d.defaultVisible !== false && isBlank(d.oldText) && isBlank(d.newText));
      break;
    case "no_whitespace_alignment":
      met = !(result.alignment ?? []).some(a =>
        blankAt(left, a.leftPage, a.leftY) || blankAt(right, a.rightPage, a.rightY));
      break;
    case "no_meaningful_text_difference":
      met = diffs.every(d => words(d.oldText) === words(d.newText));
      break;
    case "no_blank_heading_link": {
      const records = [...diffs, ...(result.unresolved ?? [])];
      met = !records.some(record => {
        const both = [...(record.left ?? []), ...(record.right ?? [])];
        const hasHeading = words(record.oldText).includes(target.heading) ||
          words(record.newText).includes(target.heading) ||
          both.some(loc => words(loc.text).includes(target.heading));
        return hasHeading && (record.right ?? []).some(loc =>
          loc.pageIndex + 1 === target.unrelatedRightPage && isBlank(loc.text));
      });
      break;
    }
    case "company_sources_retained_when_uncertain": {
      const uncertain = (result.unresolved ?? []).filter(u =>
        [...(u.left ?? []), ...(u.right ?? [])].some(loc => words(loc.text).includes(target.company)));
      // Added/Removed is not itself an error: it may be a conservative technical
      // representation. Check source conservation only when uncertainty is emitted.
      // A different representation still needs the separately required UI review.
      met = uncertain.every(u => ["left", "right"].every(side =>
        (u[side] ?? []).some(loc => words(loc.text).includes(target.company))));
      if (uncertain.length) {
        for (const [side, doc] of [["left", left], ["right", right]]) {
          const required = doc.pages.flatMap(page => {
            const chars = new Map(page.chars.map(c => [c.id, c.text]));
            return page.lines.filter(line =>
              words(line.charIds.map(id => chars.get(id)).join("")) === target.company
            ).flatMap(line => line.charIds);
          });
          const retained = new Set(uncertain.flatMap(u =>
            (u[side] ?? []).flatMap(loc => loc.charIds ?? [])));
          met &&= required.length > 0 && required.every(id => retained.has(id));
        }
      }
      break;
    }
    case "source_backed_year_change": {
      const visible = diffs.filter(d => d.defaultVisible !== false);
      const ops = visible.flatMap(d => d.textOps ?? []);
      met = ops.some(op => op.kind === "delete" &&
        hasTargetReference(op, "left", left, target.page, target.oldScalarOffset, target.oldDigit)) &&
        ops.some(op => op.kind === "insert" &&
          hasTargetReference(op, "right", right, target.page, target.newScalarOffset, target.newDigit));
      break;
    }
    case "token_boundary_change_retained": {
      const relevant = diffs.filter(d =>
        d.defaultVisible !== false && d.hasTextChange === true &&
        !(d.facts ?? []).includes("whitespace_only"));
      const oldFound = relevant.some(d =>
        words(d.oldText).includes(target.oldText) &&
        words((d.left ?? []).map(loc => loc.text).join(" ")).includes(target.oldText));
      const newFound = relevant.some(d =>
        words(d.newText).includes(target.newText) &&
        words((d.right ?? []).map(loc => loc.text).join(" ")).includes(target.newText));
      met = oldFound && newFound;
      break;
    }
    default:
      throw new Error("Unknown authored minimum check: " + id);
  }
  return { id, status: met ? "met" : "not-met" };
}

async function main() {
  const args = options(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node reproduce.mjs --wasm /path/core.wasm [--out report.json] [--assert-fixed]");
    console.log("Diagnostic mode exits 0 after recording observations, including known defects.");
    console.log("--assert-fixed exits 1 if a minimum core condition fails. UI behavior is never asserted.");
    return;
  }
  const authored = JSON.parse(await readFile(new URL("./expectations.json", import.meta.url), "utf8"));
  const { module, sha256: wasmSha256 } = await loadWasm(args.wasm);
  const cases = [];
  for (const fixture of authored.cases) {
    const left = textDoc(fixture.input.left);
    const right = textDoc(fixture.input.right);
    const result = await compareDocs(module, left, right, DEFAULT_BUDGET);
    const checks = fixture.minimumChecks.map(id => minimumCheck(id, fixture, result, left, right));
    const unmet = checks.some(c => c.status === "not-met");
    cases.push({
      id: fixture.id, category: fixture.category,
      expectationStatus: unmet ? "expected-not-fixed" :
        fixture.uiVerificationRequired ? "minimum-core-conditions-met-ui-not-verified" : "control-preserved",
      expected: fixture.expected,
      inputHashes: [left.contentHash, right.contentHash],
      input: fixture.input,
      checks,
      uiVerificationRequired: fixture.uiVerificationRequired,
      actual: compact(result),
    });
  }
  const failed = cases.filter(c => c.checks.some(check => check.status === "not-met"));
  const report = {
    schema: "review-readability-core-observations/1",
    mode: args.assertFixed ? "assert-minimum-core-conditions" : "diagnostic",
    outcome: args.assertFixed
      ? failed.length ? "minimum-conditions-not-met" : "minimum-core-conditions-met-ui-not-verified"
      : "observations-recorded-not-a-pass-verdict",
    wasmSha256,
    coreVersions: [...new Set(cases.map(c => c.actual.coreVersion))],
    budget: DEFAULT_BUDGET,
    fixtureExpectationsSchema: authored.schema,
    fixtureExpectationsSha256: sha256(JSON.stringify(authored)),
    summary: {
      cases: cases.length,
      casesWithUnmetMinimumConditions: failed.map(c => c.id),
      uiCasesNotEvaluated: cases.filter(c => c.uiVerificationRequired).map(c => c.id),
    },
    limitations: authored.limits,
    cases,
  };
  const output = JSON.stringify(report, null, 2) + "\n";
  if (args.out) {
    const path = resolve(args.out);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, output);
    console.log(JSON.stringify({
      mode: report.mode, outcome: report.outcome, wasmSha256, ...report.summary,
    }, null, 2));
  } else process.stdout.write(output);
  if (args.assertFixed && failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error("Diagnostic runner error: " + error.message);
  process.exitCode = 2;
});

