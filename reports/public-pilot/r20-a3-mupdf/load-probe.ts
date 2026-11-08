import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [mode, output] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const started = performance.now();
const events: unknown[] = [];
const now = () => Math.round(performance.now() - started);
context.on('request', request => events.push({ event: 'request', ms: now(), url: request.url() }));
context.on('requestfailed', request => events.push({ event: 'failed', ms: now(), url: request.url(), failure: request.failure() }));
context.on('response', response => events.push({ event: 'response', ms: now(), url: response.url(), status: response.status(), headers: response.headers() }));
context.on('requestfinished', request => {
  events.push({ event: 'finished', ms: now(), url: request.url() });
});
if (mode === 'routed') await context.route('**/*', route => route.continue());
const page = await context.newPage();
page.on('console', message => events.push({ event: 'console', ms: now(), type: message.type(), text: message.text() }));
page.on('pageerror', error => events.push({ event: 'pageerror', ms: now(), message: error.message }));
const report: Record<string, unknown> = { mode, browser: browser.version(), status: 'FAIL' };
try {
  const response = await page.goto('https://compare.huaweidata.com/releases/r20-a3-mupdf/');
  report.html = { body: await response!.text(), headers: response!.headers() };
  await page.locator('main').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-engine-ready') === 'true' || document.querySelector('[role="alert"]'), undefined, { timeout: 20_000 });
  report.ready = await page.locator('main').getAttribute('data-engine-ready');
  report.alerts = await page.getByRole('alert').allTextContents();
  report.elapsedMs = now();
  report.status = report.ready === 'true' ? 'PASS' : 'FAIL';
} catch (error) { report.error = String(error); }
finally {
  report.events = events;
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ mode, status: report.status, ready: report.ready, alerts: report.alerts, elapsedMs: report.elapsedMs, error: report.error }));
