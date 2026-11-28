#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { compareDocs, loadWasm, DEFAULT_BUDGET } from "./bridge.mjs";
import { textDoc, isBlank, evaluateFixture, assertionExitCode } from "./checks.mjs";

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

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

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

async function main() {
  const args = options(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node reproduce.mjs --wasm /path/core.wasm [--out report.json] [--assert-fixed]");
    console.log("Diagnostic mode exits 0 after recording observations, including known defects.");
    console.log("--assert-fixed exits 1 if a minimum core condition is FAIL or NOT_EVALUATED. UI behavior is never asserted.");
    return;
  }
  const authored = JSON.parse(await readFile(new URL("./expectations.json", import.meta.url), "utf8"));
  const { module, sha256: wasmSha256 } = await loadWasm(args.wasm);
  const cases = [];
  for (const fixture of authored.cases) {
    const left = textDoc(fixture.input.left);
    const right = textDoc(fixture.input.right);
    const result = await compareDocs(module, left, right, DEFAULT_BUDGET);
    const { status, checks } = evaluateFixture(fixture, result, left, right);
    cases.push({
      id: fixture.id, category: fixture.category,
      status,
      expectationStatus: status === "FAIL" ? "expected-not-fixed" :
        status === "NOT_EVALUATED" ? "not-evaluated-not-a-pass" :
        fixture.uiVerificationRequired ? "minimum-core-conditions-pass-ui-not-verified" : "control-preserved",
      expected: fixture.expected,
      inputHashes: [left.contentHash, right.contentHash],
      input: fixture.input,
      checks,
      uiVerificationRequired: fixture.uiVerificationRequired,
      actual: compact(result),
    });
  }
  const failed = cases.filter(c => c.status === "FAIL");
  const notEvaluated = cases.filter(c => c.status === "NOT_EVALUATED");
  const assertionExit = assertionExitCode(cases.flatMap(c => c.checks));
  const report = {
    schema: "review-readability-core-observations/2",
    mode: args.assertFixed ? "assert-minimum-core-conditions" : "diagnostic",
    outcome: args.assertFixed
      ? failed.length ? "minimum-conditions-fail" : notEvaluated.length
        ? "minimum-conditions-not-evaluated" : "minimum-core-conditions-pass-ui-not-verified"
      : "observations-recorded-not-a-pass-verdict",
    wasmSha256,
    coreVersions: [...new Set(cases.map(c => c.actual.coreVersion))],
    budget: DEFAULT_BUDGET,
    fixtureExpectationsSchema: authored.schema,
    fixtureExpectationsSha256: sha256(JSON.stringify(authored)),
    summary: {
      cases: cases.length,
      casesWithUnmetMinimumConditions: failed.map(c => c.id),
      coreCasesNotEvaluated: notEvaluated.map(c => c.id),
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
  if (args.assertFixed) process.exitCode = assertionExit;
}

main().catch(error => {
  console.error("Diagnostic runner error: " + error.message);
  process.exitCode = 2;
});

