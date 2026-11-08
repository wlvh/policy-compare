import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { releaseBase } from './release-config.ts';

const [target, manifestPath, output] = process.argv.slice(2);
if (!target || !manifestPath || !output) throw new Error('Usage: verify-release-files.ts <release-url> <expected-build-info.json> <report.json>');
const manifestBytes = readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString());
if (new URL(target).pathname !== releaseBase(manifest.releaseId)) throw new Error('Target path differs from expected release');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const expected = [...manifest.resources, { path: 'build-info.json', bytes: manifestBytes.length, sha256: sha256(manifestBytes) }];
const results = [];
for (let offset = 0; offset < expected.length; offset += 4) {
  const batch = await Promise.all(expected.slice(offset, offset + 4).map(async (file: { path: string; bytes: number; sha256: string }) => {
    try {
      const response = await fetch(new URL(file.path, target), { signal: AbortSignal.timeout(120_000) });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const actualSha256 = sha256(bytes);
      return { path: file.path, status: response.ok && bytes.length === file.bytes && actualSha256 === file.sha256 ? 'PASS' : 'FAIL', httpStatus: response.status, expectedSha256: file.sha256, actualSha256, actualBytes: bytes.length };
    } catch (error) {
      return { path: file.path, status: 'FAIL', error: String(error) };
    }
  }));
  results.push(...batch);
}
const status = results.every(file => file.status === 'PASS') ? 'PASS' : 'FAIL';
writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), target, releaseId: manifest.releaseId, manifestSha256: sha256(manifestBytes), status, scope: 'All expected release bytes fetched over HTTP. Browser behavior is checked separately.', files: results }, null, 2) + '\n');
console.log(JSON.stringify({ status, files: results.length }));
process.exitCode = status === 'PASS' ? 0 : 1;
