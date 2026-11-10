import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: check-runtime.ts <runtime-manifest.json>');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.format !== 'policy-runtime/2' || !Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) throw new Error('Expected a current runtime package manifest');
const reportDir = resolve(process.env.POLICY_REPORT_DIR || join(dirname(manifestPath), 'verification'));
mkdirSync(reportDir, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'policy-current-runtime-'));
const records: unknown[] = [];
let failed = false;
try {
  for (const [index, artifact] of manifest.artifacts.entries()) {
    let server: ReturnType<typeof spawn> | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      if (!['mupdf', 'pdfjs'].includes(artifact.engine)) throw new Error('Unknown package engine');
      const archive = resolve(dirname(manifestPath), artifact.file);
      const bytes = readFileSync(archive);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256);
      const prefix = `policy-compare-${artifact.engine}`;
      const names = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
      expect(names.every(name => name.startsWith(prefix + '/') && !name.split('/').includes('..'))).toBe(true);
      expect(names.some(name => /\/(reports|validation|tests|node_modules|target|\.git)\//.test(name))).toBe(false);
      execFileSync('tar', ['-xzf', archive, '-C', root]);
      const folder = join(root, prefix);
      const build = JSON.parse(readFileSync(join(folder, 'BUILD.json'), 'utf8'));
      expect(build.product_revision).toBe(manifest.product_revision);
      for (const [name, hash] of Object.entries(build.files)) {
        expect(createHash('sha256').update(readFileSync(join(folder, 'dist', name))).digest('hex')).toBe(hash);
      }
      const port = 18081 + index;
      const origin = `http://127.0.0.1:${port}`;
      server = spawn(process.execPath, ['server.mjs'], { cwd: folder, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore' });
      await expect.poll(async () => {
        if (server?.exitCode !== null) throw new Error('Packaged server exited before verification');
        try { return (await fetch(origin + '/healthz')).status; } catch { return 0; }
      }, { timeout: 10_000 }).toBe(200);
      expect((await fetch(origin, { method: 'POST', body: 'no upload' })).status).toBe(405);
      const infoBytes = Buffer.from(await (await fetch(origin + `/releases/${artifact.releaseId}/build-info.json`)).arrayBuffer());
      expect(createHash('sha256').update(infoBytes).digest('hex')).toBe(artifact.manifestSha256);
      const info = JSON.parse(infoBytes.toString());
      const evidence = join(reportDir, artifact.engine);
      mkdirSync(evidence, { recursive: true });
      const browserLog = execFileSync('pnpm', ['verify:deployment', 'tests/browser/deployment.spec.ts'], {
        stdio: 'pipe', timeout: 700_000,
        env: { ...process.env, POLICY_BASE_URL: origin + info.base, POLICY_RELEASE_ID: artifact.releaseId, POLICY_ENGINE: artifact.engine, POLICY_MANIFEST_SHA256: artifact.manifestSha256, POLICY_REPORT_DIR: evidence },
      });
      writeFileSync(join(evidence, 'browser.log'), browserLog);
      browser = await chromium.launch({ channel: process.env.POLICY_BROWSER_CHANNEL === 'bundled' ? undefined : 'chrome', headless: true });
      const page = await browser.newPage();
      await page.goto(origin);
      await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true', { timeout: 65_000 });
      await page.getByLabel('基准 PDF', { exact: true }).setInputFiles(join(folder, 'samples/before.pdf'));
      await page.getByLabel('待审 PDF', { exact: true }).setInputFiles(join(folder, 'samples/after.pdf'));
      await page.getByRole('button', { name: '开始比较', exact: true }).click();
      await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope', { timeout: 185_000 });
      await expect(page.locator('.cards')).toContainText('USD 2,500,000');
      await expect(page.locator('.cards')).toContainText('31 March 2026');
      await expect(page.locator('polygon').first()).toBeVisible();
      records.push({ engine: artifact.engine, status: 'PASS', archiveSha256: artifact.sha256, staticFiles: Object.keys(build.files).length, checks: ['archive/extraction', 'every static file hash', 'no upload endpoint', 'four deployment browser cases', 'bundled before/after PDFs through file inputs'] });
    } catch (error) {
      failed = true;
      const failure = error as Error & { stdout?: Buffer; stderr?: Buffer };
      writeFileSync(join(reportDir, `${artifact.engine}-failure.log`), String(error) + '\n' + (failure.stdout?.toString() || '') + (failure.stderr?.toString() || ''));
      records.push({ engine: artifact.engine, status: 'FAIL', error: String(error) });
    } finally {
      await browser?.close();
      if (server && server.exitCode === null && server.signalCode === null) {
        const stopped = once(server, 'exit');
        server.kill('SIGTERM');
        await stopped;
      }
    }
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
const report = { status: failed ? 'FAIL' : 'PASS', scope: 'Actual extracted packages on this machine; organization and target-device acceptance remain separate', productRevision: manifest.product_revision, records };
writeFileSync(join(reportDir, 'runtime-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = failed ? 1 : 0;
