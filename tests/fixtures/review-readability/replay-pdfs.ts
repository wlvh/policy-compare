import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compareDocs, loadWasm, DEFAULT_BUDGET } from './core/bridge.mjs';

// Diagnostic replay only. The product receives PDFs, not the authored truth files.
// A completed run is not a repair acceptance PASS. See truth.json and acceptance.md.
const args = process.argv.slice(2);
function arg(name: string, fallback?: string) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return args[i + 1];
}
const wasmPath = arg('--wasm');
const outputPath = arg('--out');
if (!wasmPath || !outputPath) throw new Error('Usage: pnpm exec tsx tests/fixtures/review-readability/replay-pdfs.ts --wasm PATH --out report.json [--repo .] [--fixtures DIR] [--full-results DIR]');
const repo = resolve(arg('--repo', process.cwd())!);
const fixtureRoot = resolve(arg('--fixtures', dirname(fileURLToPath(import.meta.url)))!);
const { PdfSession } = await import(pathToFileURL(join(repo, 'engines/mupdf/adapter.ts')).href);
const { parseDoc, resolveLocation, ResultSchemaV2 } = await import(pathToFileURL(join(repo, 'packages/contracts/index.ts')).href);
const loaded = await loadWasm(resolve(wasmPath));
const cases = ['a-whitespace', 'b-duplicate-context', 'c-address-reflow', 'd-review-mixed'];
const sha = (data: any) => createHash('sha256').update(data).digest('hex');
const summarizeLocation = (loc: any) => ({
  side: loc.side, page: loc.pageIndex + 1, text: loc.text, rawRange: loc.rawRange,
  bounds: loc.quads.length ? [
    Math.min(...loc.quads.flatMap((q: number[]) => [q[0], q[2], q[4], q[6]])),
    Math.min(...loc.quads.flatMap((q: number[]) => [q[1], q[3], q[5], q[7]])),
    Math.max(...loc.quads.flatMap((q: number[]) => [q[0], q[2], q[4], q[6]])),
    Math.max(...loc.quads.flatMap((q: number[]) => [q[1], q[3], q[5], q[7]])),
  ] : null,
});
const reports: any[] = [];
for (const caseId of cases) {
  const docs: any[] = [];
  const inputs: any[] = [];
  for (const side of ['baseline', 'revised']) {
    const bytes = await readFile(join(fixtureRoot, caseId, side + '.pdf'));
    const session = new PdfSession(bytes);
    try {
      const doc = parseDoc(await session.extract());
      docs.push(doc);
      const blankLines = doc.pages.flatMap((page: any) => {
        const chars = new Map(page.chars.map((c: any) => [c.id, c.text]));
        return page.lines.flatMap((line: any) => {
          const text = line.charIds.map((id: string) => chars.get(id)).join('');
          return text.length && !text.trim().length ? [{ page: page.pageIndex + 1, lineId: line.id, text }] : [];
        });
      });
      inputs.push({ side, file: `${caseId}/${side}.pdf`, sha256: sha(bytes), pages: doc.pageCount, extractor: doc.extractor, whitespaceOnlyExtractedLines: blankLines });
    } finally { session.destroy(); }
  }
  const started = performance.now();
  const result = ResultSchemaV2.parse(await compareDocs(loaded.module, docs[0], docs[1], DEFAULT_BUDGET));
  const compareMs = performance.now() - started;
  let verifiedSourceLocations = 0;
  function verify(pair: any) {
    for (const side of ['left', 'right']) for (const loc of pair[side] ?? []) {
      if (loc.side !== side || !resolveLocation(loc, docs)) throw new Error(`${caseId}: invalid source location`);
      verifiedSourceLocations++;
    }
  }
  for (const d of result.differences) {
    verify(d); for (const op of d.textOps) verify(op); for (const occurrence of d.occurrences) verify(occurrence);
  }
  for (const group of result.unresolved) verify(group);
  const fullDirectory = arg('--full-results');
  if (fullDirectory) {
    await mkdir(fullDirectory, { recursive: true });
    await writeFile(join(fullDirectory, `${caseId}.json`), JSON.stringify(result, null, 2) + '\n');
  }
  const semanticFields = { differences: result.differences, unresolved: result.unresolved, coverage: result.coverage, alignment: result.alignment, status: result.status };
  reports.push({
    caseId, inputs, coreVersion: result.coreVersion, configDigest: result.configDigest,
    status: result.status, stats: result.stats, compareMs: Math.round(compareMs),
    sourceChecks: { status: 'PASS', verifiedSourceLocations, scope: 'References resolve to extracted characters; this does not establish correct correspondence.' },
    repairAcceptance: 'NOT_EVALUATED', semanticsSHA256: sha(JSON.stringify(semanticFields)),
    differences: result.differences.map((d: any) => ({
      kind: d.kind, oldText: d.oldText, newText: d.newText, facts: d.facts,
      hasTextChange: d.hasTextChange, method: d.matchEvidence.method,
      left: d.left.map(summarizeLocation), right: d.right.map(summarizeLocation),
      repeat: d.repeat, occurrenceCount: d.occurrences.length,
    })),
    unresolved: result.unresolved.map((u: any) => ({ reason: u.reason, message: u.message, left: u.left.map(summarizeLocation), right: u.right.map(summarizeLocation) })),
    coverage: result.coverage.map((c: any) => ({ side: c.side, page: c.pageIndex + 1, reason: c.reason, region: c.region, layoutHint: c.layoutHint })),
    alignment: result.alignment,
  });
  console.log(JSON.stringify({ caseId, differences: result.differences.length, unresolved: result.unresolved.length, coverage: result.coverage.length, sourceChecks: 'PASS', repairAcceptance: 'NOT_EVALUATED' }));
}
await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  schemaVersion: 'review-readability-pdf-observation/1',
  invocation: 'Node + repository MuPDF adapter + Rust/WASM ABI; not a browser workflow or performance benchmark',
  wasmSHA256: loaded.sha256, nodeVersion: process.version, budget: DEFAULT_BUDGET,
  pageNumbering: 'Source summaries use 1-based PDF pages; alignment retains product 0-based indexes.',
  truthUsedByProduct: false, reports,
}, null, 2) + '\n');
