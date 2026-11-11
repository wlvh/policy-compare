import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { compare, coreArtifact } from '../packages/compare-core/index';
import { compare as compareLegacy } from '../packages/legacy-core/index';
import { digest, type CompareResultV2, type DocInput } from '../packages/contracts/index';
import { translateFrozenMessages } from './english-frozen-messages';

const manifestFile = 'reports/issue-19/frozen-baseline.json';
const manifestBytes = readFileSync(manifestFile);
const baseline = JSON.parse(manifestBytes.toString('utf8')) as {
  revision: string;
  records: { engine: string; case: string; file: string; coreMs: number; inputAndLegacyResultSha256: string }[];
};
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = 'reports/english-ui/parity.json';
const failureDir = `tmp/english-parity/${runId}`;
mkdirSync('reports/english-ui', { recursive: true });
mkdirSync('tmp', { recursive: true });
if (baseline.records.length !== 64) throw new Error('Expected all 64 frozen Issue #19 cases');

function mismatch(expected: unknown, actual: unknown, path = ''): string[] {
  if (isDeepStrictEqual(expected, actual)) return [];
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object' || Array.isArray(expected) !== Array.isArray(actual)) return [path || '/'];
  if (Array.isArray(expected) && Array.isArray(actual) && expected.length !== actual.length) return [`${path}/length`];
  const a = expected as Record<string, unknown>, b = actual as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => {
    const next = `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
    return !Object.hasOwn(a, key) || !Object.hasOwn(b, key) ? [next] : mismatch(a[key], b[key], next);
  });
}

const records: Record<string, unknown>[] = [];
for (const meta of baseline.records) {
  const record: Record<string, unknown> = { ...meta, status: 'FAIL' };
  const evidence: Record<string, unknown> = { inputFile: meta.file };
  try {
    const raw = gunzipSync(readFileSync(meta.file));
    record.verifiedInputAndLegacyResultSha256 = sha256(raw);
    if (record.verifiedInputAndLegacyResultSha256 !== meta.inputAndLegacyResultSha256) throw new Error('Frozen input/result archive hash mismatch');
    const { docs, result: frozen } = JSON.parse(raw.toString('utf8')) as { docs: [DocInput, DocInput]; result: CompareResultV2 };
    record.frozenDocumentPayloadSha256 = digest(docs);
    record.frozenCoreVersion = frozen.coreVersion;
    evidence.frozen = frozen;
    const { expected, translations } = translateFrozenMessages(frozen);
    record.translations = translations;
    evidence.expected = expected;

    // Both implementations receive independent copies of the same unchanged
    // frozen documents; neither can supply the other with mutated inputs.
    const legacyDocs = structuredClone(docs), rustDocs = structuredClone(docs);
    let start = performance.now();
    const legacy = compareLegacy(legacyDocs[0], legacyDocs[1]);
    record.currentLegacyCoreMs = performance.now() - start;
    record.currentLegacyCoreVersion = legacy.coreVersion;
    evidence.currentLegacy = legacy;
    if (legacy.coreVersion !== `${frozen.coreVersion}+messages.en.1`) throw new Error('Unexpected legacy core version for the English message migration');
    start = performance.now();
    const current = compare(rustDocs[0], rustDocs[1]);
    record.rustCoreMs = performance.now() - start;
    record.rustCoreVersion = current.coreVersion;
    evidence.currentRust = current;

    // These are complete structural comparisons, not projections that discard
    // explanations, source locations, counts, IDs, hashes, or optional fields.
    const frozenDiff = mismatch({ ...expected, coreVersion: current.coreVersion }, current);
    const legacyDiff = mismatch({ ...legacy, coreVersion: current.coreVersion }, current);
    record.frozenBaselineStatus = frozenDiff.length ? 'FAIL' : 'PASS';
    record.currentLegacyStatus = legacyDiff.length ? 'FAIL' : 'PASS';
    record.frozenBaselineMismatch = frozenDiff.slice(0, 30);
    record.currentLegacyMismatch = legacyDiff.slice(0, 30);
    evidence.mismatch = { frozenBaseline: frozenDiff, currentLegacy: legacyDiff };
    if (frozenDiff.length || legacyDiff.length) throw new Error('Complete comparison output differs');
    record.status = 'PASS';
  } catch (error) {
    record.error = error instanceof Error ? error.message : String(error);
    mkdirSync(failureDir, { recursive: true });
    const failureFile = `${failureDir}/${meta.engine}-${meta.case}.json`;
    writeFileSync(failureFile, JSON.stringify({ record, ...evidence }, null, 2) + '\n');
    record.failureFile = failureFile;
  }
  records.push(record);
}
const status = records.every(record => record.status === 'PASS') ? 'PASS' : 'FAIL';
writeFileSync(reportFile, JSON.stringify({
  schemaVersion: 'english-message-parity/1', status, runId, coreArtifact,
  frozenBaseline: { file: manifestFile, sha256: sha256(manifestBytes), revision: baseline.revision, cases: baseline.records.length },
  allowedDifferences: [
    'coreVersion identifies the implementation and the English message migration',
    'Only the explicitly translated differences[].reviewReasons[], differences[].matchEvidence.details[] and unresolved[].message values recorded per case',
  ],
  preserved: 'Frozen documents, coverage messages copied from those documents, source text, facts, locations, counts, IDs, hashes and every other result field are compared without modification. The original Issue #19 reports are not overwritten.',
  checks: ['Current Rust equals the translated frozen baseline', 'Current Rust equals current legacy (except coreVersion)'],
  records,
}, null, 2) + '\n');
console.log(`${status}: ${records.filter(record => record.status === 'PASS').length}/${records.length} frozen cases; ${reportFile}`);
if (status === 'FAIL') console.log(records.filter(record => record.status === 'FAIL'));
process.exitCode = status === 'PASS' ? 0 : 1;
