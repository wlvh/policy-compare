import { randomUUID } from 'node:crypto';
import { renameSync, rmSync, writeFileSync } from 'node:fs';

export type BenchmarkResultFile = { path: string; status: 'PASS' | 'FAIL' };

export function saveBenchmarkReport(output: string, report: unknown, resultFile?: BenchmarkResultFile) {
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n');
    renameSync(temporary, output);
  } finally {
    rmSync(temporary, { force: true });
  }
  if (resultFile?.status === 'PASS') rmSync(resultFile.path, { force: true });
}
