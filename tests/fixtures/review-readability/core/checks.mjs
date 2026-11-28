import { createHash } from "node:crypto";

// Match the core's ECMAScript-style whitespace definition: includes BOM, not NEL.
const space = /[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/gu;
export const words = text => String(text ?? "").split(space).filter(Boolean).join(" ");
export const isBlank = text => words(text) === "";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

/** Same synthetic character geometry approach as tests/helpers.ts, without repo imports. */
export function textDoc(lines) {
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

function verdict(id, status, detail, evidence) {
  return { id, status, ...(detail ? { detail } : {}), ...(evidence ? { evidence } : {}) };
}

export function checkVerdict(checks) {
  if (checks.some(c => c.status === "FAIL")) return "FAIL";
  if (!checks.length || checks.some(c => c.status !== "PASS")) return "NOT_EVALUATED";
  return "PASS";
}

export function assertionExitCode(checks) {
  return checkVerdict(checks) === "PASS" ? 0 : 1;
}

function nodes(record, includeOps = true) {
  return [record, ...(record.occurrences ?? []).flatMap(r => nodes(r, includeOps)),
    ...(includeOps ? (record.textOps ?? []).flatMap(r => nodes(r)) : [])];
}
const refs = (record, side) => nodes(record).flatMap(r => r[side] ?? []);
const roots = result => [...(result.differences ?? []), ...(result.unresolved ?? [])];

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

function companyOccurrences(doc, company) {
  return doc.pages.flatMap(page => {
    const chars = new Map(page.chars.map(c => [c.id, c]));
    return page.lines.flatMap((line, index) => {
      const text = line.charIds.map(id => chars.get(id).text).join("");
      return words(text) === company ? [{
        pageIndex: page.pageIndex, lineIndex: index, y: line.baseline[1],
        charIds: line.charIds,
      }] : [];
    });
  });
}

// Validate the actual synthetic DocInput source, not the matcher's confidence/method.
function validLocation(loc, side, doc) {
  if (loc.side !== side || !Array.isArray(loc.charIds) || !loc.charIds.length) return false;
  const page = doc.pages[loc.pageIndex];
  if (!page) return false;
  const index = new Map(page.chars.map(c => [c.id, c]));
  const chars = loc.charIds.map(id => index.get(id));
  return chars.every(Boolean) &&
    chars.map(c => c.text).join("") === loc.text &&
    JSON.stringify(loc.rawRange) === JSON.stringify([chars[0].rawRange[0], chars.at(-1).rawRange[1]]) &&
    JSON.stringify(loc.quads) === JSON.stringify(chars.map(c => c.quad));
}

/**
 * An optional hand-authored oracle for positive checker self-tests.
 * It declares shared, unique preceding anchor text; the raw inputs must confirm it.
 * The checker does not search for matches or invent an ordering-based correspondence.
 */
function authoredPairs(fixture, docs, occurrences) {
  const anchors = fixture.target.pairingAnchors;
  if (!Array.isArray(anchors) || !anchors.length) return null;
  const pairs = new Set();
  for (const anchor of anchors) {
    const indexes = docs.map((doc, side) => {
      const hits = [];
      for (const page of doc.pages) {
        const chars = new Map(page.chars.map(c => [c.id, c.text]));
        page.lines.forEach((line, index) => {
          if (words(line.charIds.map(id => chars.get(id)).join("")) === anchor) {
            hits.push(occurrences[side].findIndex(o =>
              o.pageIndex === page.pageIndex && o.lineIndex === index + 1));
          }
        });
      }
      return hits.length === 1 && hits[0] >= 0 ? hits[0] : -1;
    });
    if (indexes.includes(-1)) return null;
    pairs.add(indexes.join(":"));
  }
  return pairs;
}

function checkCompany(id, fixture, result, left, right) {
  const company = fixture.target.company;
  const docs = [left, right];
  const occurrences = docs.map(doc => companyOccurrences(doc, company));
  const expectedCount = fixture.target.occurrencesPerSide ?? 2;
  if (occurrences.some(rows => rows.length !== expectedCount)) {
    return verdict(id, "NOT_EVALUATED", "The input does not contain the authored occurrence count.");
  }
  const required = occurrences.map(rows => new Set(rows.flatMap(r => r.charIds)));
  const requiredEither = new Set([...required[0], ...required[1]]);
  const retained = [new Set(), new Set()];
  const invalid = [];
  const allRoots = roots(result);
  for (const record of allRoots) for (const [i, side] of ["left", "right"].entries()) {
    for (const loc of refs(record, side)) {
      if (!words(loc.text).includes(company) && !(loc.charIds ?? []).some(cid => requiredEither.has(cid))) continue;
      if (!validLocation(loc, side, docs[i])) {
        invalid.push({ side, page: Number(loc.pageIndex) + 1 });
        continue;
      }
      for (const cid of loc.charIds) if (required[i].has(cid)) retained[i].add(cid);
    }
  }

  // Alignment is only a locator. It does not certify that two name occurrences correspond.
  const proposed = new Set();
  let unsupportedPair = false;
  for (const item of result.alignment ?? []) {
    const hits = occurrences.map((rows, i) => rows.map((o, index) => ({ o, index })).filter(({ o }) =>
      o.pageIndex === item[i ? "rightPage" : "leftPage"] &&
      Math.abs(o.y - item[i ? "rightY" : "leftY"]) < 0.001));
    hits.forEach((rows, side) => {
      if (rows.length === 1) for (const cid of rows[0].o.charIds) retained[side].add(cid);
    });
    if (hits.every(rows => rows.length === 1)) proposed.add(hits.map(rows => rows[0].index).join(":"));
    else if (hits.some(rows => rows.length)) unsupportedPair = true;
  }
  const observed = occurrences.map((rows, i) => rows.filter(o => o.charIds.every(cid => retained[i].has(cid))).length);
  const evidence = { requiredOccurrences: [expectedCount, expectedCount], retainedOccurrences: observed };
  if (invalid.length) return verdict(id, "FAIL", "A company reference does not resolve to the original input.", { ...evidence, invalid });
  if (observed.some(n => n !== expectedCount)) {
    return verdict(id, "FAIL", "Company source occurrences were lost from the verifiable exported evidence.", evidence);
  }

  const indexesIn = (record, i) => {
    const ids = new Set(refs(record, i ? "right" : "left").flatMap(loc =>
      validLocation(loc, i ? "right" : "left", docs[i]) ? loc.charIds : []));
    return occurrences[i].flatMap((o, index) => o.charIds.every(cid => ids.has(cid)) ? [index] : []);
  };
  const uncertain = [new Set(), new Set()];
  for (const record of result.unresolved ?? []) {
    for (let i = 0; i < 2; i++) for (const index of indexesIn(record, i)) uncertain[i].add(index);
  }
  for (const difference of result.differences ?? []) {
    // This established representation explicitly does not pair occurrences by list order.
    const countOnly = difference.matchEvidence?.method === "occurrence-count-only" &&
      difference.repeat?.left === expectedCount && difference.repeat?.right === expectedCount;
    if (countOnly) {
      for (let i = 0; i < 2; i++) for (const index of indexesIn(difference, i)) uncertain[i].add(index);
      continue;
    }
    for (const record of nodes(difference)) {
      const indexes = [indexesIn(record, 0), indexesIn(record, 1)];
      if (!indexes.every(list => list.length)) continue; // Technical one-sided records are not by themselves errors.
      if (indexes.every(list => list.length === 1)) proposed.add(indexes.map(list => list[0]).join(":"));
      else unsupportedPair = true;
    }
  }
  const allowed = authoredPairs(fixture, docs, occurrences);
  if (unsupportedPair || (proposed.size && !allowed)) {
    return verdict(id, "NOT_EVALUATED", "Sources survive, but the claimed pairing has no applicable independent source oracle.", evidence);
  }
  const covered = uncertain.map(set => new Set(set));
  for (const pair of proposed) {
    if (!allowed.has(pair)) return verdict(id, "FAIL", "A pairing contradicts the authored source anchors.", { ...evidence, pair });
    pair.split(":").forEach((index, side) => covered[side].add(Number(index)));
  }
  if (covered.every(set => set.size === expectedCount)) {
    return verdict(id, "PASS", "All source occurrences are retained in conservative uncertainty or independently verified local pairs.", evidence);
  }
  return verdict(id, "NOT_EVALUATED", "All source occurrences survive, but their correspondence/uncertainty is not independently established.", evidence);
}

export function minimumCheck(id, fixture, result, left, right) {
  const diffs = result.differences ?? [];
  const target = fixture.target ?? {};
  let met;
  switch (id) {
    case "no_budget_stop":
      met = !(result.unresolved ?? []).some(u => u.reason === "budget" || u.reason === "word_diff_budget");
      break;
    case "no_blank_difference_export": {
      // Inspect exported correspondences irrespective of defaultVisible. Ordinary
      // spacing edits inside a nonempty heading are not standalone blank records.
      const records = roots(result).flatMap(record => nodes(record, false));
      met = !records.some(record => {
        const locs = [...(record.left ?? []), ...(record.right ?? [])];
        const blankBody = Object.hasOwn(record, "oldText") && Object.hasOwn(record, "newText") &&
          isBlank(record.oldText) && isBlank(record.newText);
        return blankBody || locs.length > 0 && locs.every(loc => isBlank(loc.text));
      });
      break;
    }
    case "no_whitespace_alignment":
      met = !(result.alignment ?? []).some(a =>
        blankAt(left, a.leftPage, a.leftY) || blankAt(right, a.rightPage, a.rightY));
      break;
    case "no_meaningful_text_difference":
      met = diffs.every(d => words(d.oldText) === words(d.newText));
      break;
    case "no_blank_heading_link":
      met = !roots(result).some(record => {
        const both = [...refs(record, "left"), ...refs(record, "right")];
        const hasHeading = words(record.oldText).includes(target.heading) ||
          words(record.newText).includes(target.heading) ||
          both.some(loc => words(loc.text).includes(target.heading));
        return hasHeading && refs(record, "right").some(loc =>
          loc.pageIndex + 1 === target.unrelatedRightPage && isBlank(loc.text));
      });
      break;
    case "company_sources_and_correspondence":
      return checkCompany(id, fixture, result, left, right);
    case "source_backed_year_change": {
      const ops = diffs.filter(d => d.defaultVisible !== false).flatMap(d => d.textOps ?? []);
      met = ops.some(op => op.kind === "delete" &&
        hasTargetReference(op, "left", left, target.page, target.oldScalarOffset, target.oldDigit)) &&
        ops.some(op => op.kind === "insert" &&
          hasTargetReference(op, "right", right, target.page, target.newScalarOffset, target.newDigit));
      break;
    }
    case "token_boundary_change_retained": {
      const relevant = diffs.filter(d =>
        d.defaultVisible !== false && d.hasTextChange === true && !(d.facts ?? []).includes("whitespace_only"));
      met = relevant.some(d => words(d.oldText).includes(target.oldText) &&
        words((d.left ?? []).map(loc => loc.text).join(" ")).includes(target.oldText)) &&
        relevant.some(d => words(d.newText).includes(target.newText) &&
          words((d.right ?? []).map(loc => loc.text).join(" ")).includes(target.newText));
      break;
    }
    default:
      return verdict(id, "NOT_EVALUATED", "No checker implements this authored requirement.");
  }
  return verdict(id, met ? "PASS" : "FAIL");
}

export function evaluateFixture(fixture, result, left, right) {
  const checks = fixture.minimumChecks.map(id => minimumCheck(id, fixture, result, left, right));
  return { status: checkVerdict(checks), checks };
}


