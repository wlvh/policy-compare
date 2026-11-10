import { afterEach, expect, test } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveBenchmarkReport } from '../bench/report';

const folders: string[] = [];
function files() {
  const folder = mkdtempSync(join(tmpdir(), 'policy-benchmark-report-'));
  folders.push(folder);
  const result = join(folder, 'result.json');
  writeFileSync(result, '{"comparison":"complete"}');
  return { folder, result, output: join(folder, 'report.json') };
}
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });

test('a passing round is removed after saving even when full memory acceptance is blocked', () => {
  const { result, output } = files();
  const report = { fullMemoryAcceptance: 'BLOCKED', attempts: [{ status: 'PASS' }] };
  saveBenchmarkReport(output, report, { path: result, status: 'PASS' });
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(report);
  expect(existsSync(result)).toBe(false);
});

test('a failed round keeps its complete result for investigation', () => {
  const { result, output } = files();
  saveBenchmarkReport(output, { attempts: [{ status: 'FAIL' }] }, { path: result, status: 'FAIL' });
  expect(existsSync(result)).toBe(true);
  expect(JSON.parse(readFileSync(output, 'utf8')).attempts[0].status).toBe('FAIL');
});

test('a report commit failure keeps the result and removes the temporary report', () => {
  const { folder, result, output } = files();
  mkdirSync(output);
  expect(() => saveBenchmarkReport(output, {}, { path: result, status: 'PASS' })).toThrow();
  expect(existsSync(result)).toBe(true);
  expect(readdirSync(folder).some(name => name.endsWith('.tmp'))).toBe(false);
});

test('serialization failure preserves the previous report and the result', () => {
  const { result, output } = files();
  writeFileSync(output, '{"previous":true}');
  const report: { self?: unknown } = {};
  report.self = report;
  expect(() => saveBenchmarkReport(output, report, { path: result, status: 'PASS' })).toThrow();
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual({ previous: true });
  expect(existsSync(result)).toBe(true);
});

test('saving again after successful cleanup is safe', () => {
  const { result, output } = files();
  saveBenchmarkReport(output, {}, { path: result, status: 'PASS' });
  expect(() => saveBenchmarkReport(output, {}, { path: result, status: 'PASS' })).not.toThrow();
});
