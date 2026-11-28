#!/usr/bin/env node
// Checker tests only: no WASM, matcher, PDF adapter, or product changes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { textDoc, evaluateFixture, assertionExitCode } from "./checks.mjs";

const authored = JSON.parse(await readFile(new URL("./expectations.json", import.meta.url), "utf8"));
const fixture = id => structuredClone(authored.cases.find(c => c.id === id));
const empty = () => ({ differences: [], unresolved: [], alignment: [] });
const reports = [];

function location(doc, side, pageIndex, lineIndex) {
  const page = doc.pages[pageIndex];
  const line = page.lines[lineIndex];
  const index = new Map(page.chars.map(c => [c.id, c]));
  const chars = line.charIds.map(id => index.get(id));
  return {
    side, pageIndex, unitId: "checker-authored-source", charIds: line.charIds,
    rawRange: [chars[0].rawRange[0], chars.at(-1).rawRange[1]],
    text: chars.map(c => c.text).join(""), quads: chars.map(c => c.quad),
  };
}

function inspect(name, f, result, left, right, expected) {
  const checked = evaluateFixture(f, result, left, right);
  assert.equal(checked.status, expected, name + ": " + JSON.stringify(checked.checks));
  assert.equal(assertionExitCode(checked.checks), expected === "PASS" ? 0 : 1,
    name + ": assertion mode must reject both FAIL and NOT_EVALUATED");
  reports.push({ scenario: name, expected, observed: checked.status });
}

const names = fixture("repeated_company_changed_context");
const docs = [textDoc(names.input.left), textDoc(names.input.right)];
const nameLocs = docs.map((doc, i) => [1, 3].map(row => location(doc, i ? "right" : "left", 0, row)));
const technical = [
  ...nameLocs[0].map(loc => ({
    kind: "Removed", oldText: names.target.company, newText: "", left: [loc], right: [], defaultVisible: true,
  })),
  ...nameLocs[1].map(loc => ({
    kind: "Added", oldText: "", newText: names.target.company, left: [], right: [loc], defaultVisible: true,
  })),
];
const conservative = {
  ...empty(), differences: technical,
  unresolved: [{ reason: "ambiguous_match", left: nameLocs[0], right: nameLocs[1] }],
};
inspect("conservative uncertainty preserves all 2+2 occurrences", names, conservative, ...docs, "PASS");

const erased = structuredClone(conservative);
erased.differences = [];
erased.unresolved = [];
inspect("reported false positive: erase name differences and unresolved", names, erased, ...docs, "FAIL");

const duplicateSource = structuredClone(conservative);
duplicateSource.differences = [];
duplicateSource.unresolved[0].right[1] = structuredClone(duplicateSource.unresolved[0].right[0]);
inspect("copying one occurrence twice cannot replace the missing second source", names, duplicateSource, ...docs, "FAIL");

function pairedResult(leftLocations, rightLocations, company) {
  return {
    ...empty(),
    differences: leftLocations.map((loc, i) => ({
      kind: "Replaced", oldText: company, newText: company, hasTextChange: false,
      matchEvidence: { method: "claimed-local-pair" },
      left: [loc], right: [rightLocations[i]], defaultVisible: false,
    })),
  };
}
inspect("source-complete pair claims without an independent oracle", names,
  pairedResult(...nameLocs, names.target.company), ...docs, "NOT_EVALUATED");

// A separate, hand-authored positive example supplies unique shared source anchors.
// It does not infer a pairing from current matcher output or from occurrence order.
const local = fixture("repeated_company_changed_context");
local.input.left = local.input.right = [
  { text: "Depot alpha." }, { text: local.target.company },
  { text: "Depot beta." }, { text: local.target.company },
];
local.target.pairingAnchors = ["Depot alpha.", "Depot beta."];
const localDocs = [textDoc(local.input.left), textDoc(local.input.right)];
const localLocs = localDocs.map((doc, i) => [1, 3].map(row => location(doc, i ? "right" : "left", 0, row)));
inspect("independently source-anchored local pairs need no unresolved record", local,
  pairedResult(...localLocs, local.target.company), ...localDocs, "PASS");
inspect("reversed pairs contradict the same independent source anchors", local,
  pairedResult(localLocs[0], [...localLocs[1]].reverse(), local.target.company), ...localDocs, "FAIL");

const blank = fixture("blank_cross_page_moved");
const blankDocs = [textDoc(blank.input.left), textDoc(blank.input.right)];
const hiddenBlank = {
  ...empty(),
  differences: [{
    kind: "Moved", oldText: "  ", newText: " ", hasTextChange: true,
    defaultVisible: false, facts: ["whitespace_only"],
    left: [location(blankDocs[0], "left", 0, 0), location(blankDocs[0], "left", 1, 0)],
    right: [location(blankDocs[1], "right", 12, 0)],
  }],
};
inspect("reported false positive: hide blank Moved and clear alignment", blank,
  hiddenBlank, ...blankDocs, "FAIL");
const hiddenReplacement = structuredClone(hiddenBlank);
hiddenReplacement.differences[0].kind = "Replaced";
inspect("hidden all-whitespace Replaced is still an exported defect", blank,
  hiddenReplacement, ...blankDocs, "FAIL");
inspect("removing the standalone blank export and its alignment satisfies these core conditions", blank,
  empty(), ...blankDocs, "PASS");

const heading = fixture("blank_absorbs_heading");
const headingDocs = [textDoc(heading.input.left), textDoc(heading.input.right)];
const l = location(headingDocs[0], "left", 0, 0);
const r = location(headingDocs[1], "right", 0, 0);
const remote = location(headingDocs[1], "right", 12, 0);
const swallowed = {
  ...empty(),
  differences: [{
    kind: "Replaced", oldText: l.text, newText: r.text + " ", defaultVisible: false,
    left: [l], right: [r],
    textOps: [
      { kind: "equal", text: l.text, left: [l], right: [r] },
      { kind: "insert", text: " ", left: [], right: [remote] },
    ],
  }],
};
inspect("hidden heading cannot absorb a remote blank through nested textOps", heading,
  swallowed, ...headingDocs, "FAIL");

console.log(JSON.stringify({
  purpose: "checker fault-injection self-test; not a product-fix verdict",
  scenarios: reports.length, checkerAssertions: "PASS", results: reports,
}, null, 2));

