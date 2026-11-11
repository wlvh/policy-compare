import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const [url, output, visitsText = '1'] = process.argv.slice(2);
if (!url || !output) throw new Error('Usage: record-startup.ts <release-url> <report.json> [visits]');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
if (process.env.POLICY_RECORD_ROUTE === '1') await context.route('**/*', route => route.continue());
const reports: unknown[] = [];
for (let visit = 0; visit < Number(visitsText); visit++) {
  const page = await context.newPage();
  const started = performance.now();
  const events: unknown[] = [];
  const requests = new Map<string, any>();
  const elapsed = () => Math.round(performance.now() - started);
  const cdp = await context.newCDPSession(page);
  if (process.env.POLICY_RECORD_BYTES_PER_SECOND) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: Number(process.env.POLICY_RECORD_BYTES_PER_SECOND), uploadThroughput: -1 });
  }
  cdp.on('Target.attachedToTarget', async ({ sessionId, targetInfo }) => {
    if (targetInfo.type !== 'worker') return;
    events.push({ type: 'worker', atMs: elapsed(), url: targetInfo.url });
    await cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id: 1, method: 'Network.enable' }) });
    await cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id: 2, method: 'Runtime.runIfWaitingForDebugger' }) });
  });
  cdp.on('Target.receivedMessageFromTarget', ({ sessionId, message }) => {
    const event = JSON.parse(message);
    if (event.error) events.push({ type: 'protocol-error', error: event.error });
    const data = event.params;
    if (!data?.requestId) return;
    const key = sessionId + ':' + data.requestId;
    if (event.method === 'Network.requestWillBeSent') {
      requests.set(key, { url: data.request.url, requestedMs: elapsed(), decodedBytes: 0, encodedBytes: 0 });
    }
    const request = requests.get(key);
    if (!request) return;
    if (event.method === 'Network.responseReceived') Object.assign(request, { responseMs: elapsed(), status: data.response.status, timing: data.response.timing });
    if (event.method === 'Network.dataReceived') {
      request.firstDataMs ??= elapsed();
      request.lastDataMs = elapsed();
      request.decodedBytes += data.dataLength;
      request.encodedBytes += data.encodedDataLength;
    }
    if (event.method === 'Network.loadingFinished') Object.assign(request, { completedMs: elapsed(), encodedBytes: data.encodedDataLength });
    if (event.method === 'Network.loadingFailed') Object.assign(request, { failedMs: elapsed(), error: data.errorText });
  });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false });
  page.on('requestfinished', request => events.push({ type: 'request-finished', atMs: elapsed(), url: request.url() }));
  page.on('requestfailed', request => events.push({ type: 'request-failed', atMs: elapsed(), url: request.url(), failure: request.failure() }));
  let snapshot: unknown;
  const timer = setTimeout(() => { snapshot = { atMs: elapsed(), requests: structuredClone([...requests.values()]) }; }, 15_000);
  const report: Record<string, unknown> = { downloadBytesPerSecond: Number(process.env.POLICY_RECORD_BYTES_PER_SECOND) || null, visit: visit + 1, cache: visit === 0 ? 'new-browser-context' : 'same-browser-context', browser: browser.version(), url };
  try {
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-engine-ready') === 'true' || document.querySelector('[role="alert"]'), undefined, { timeout: 70_000 });
    report.pdfReady = await page.locator('main').getAttribute('data-engine-ready') === 'true';
    report.pdfWaitEndedMs = elapsed();
    if (report.pdfReady) report.pdfReadyMs = elapsed();
    report.alerts = await page.getByRole('alert').allTextContents();
    if (await page.locator('main').getAttribute('data-engine-ready') === 'true') {
      const compared = performance.now();
      const comparisonTimer = setTimeout(() => { report.comparisonAt15Seconds = { atMs: elapsed(), requests: structuredClone([...requests.values()]) }; }, 15_000);
      await page.getByRole('button', { name: /^(?:P02 Amount change|P02 金额变化)$/, exact: true }).click();
      await page.waitForFunction(() => ['complete_for_scope', 'partial', 'failed'].includes(document.querySelector('[data-status]')?.getAttribute('data-status') || ''), undefined, { timeout: 190_000 });
      clearTimeout(comparisonTimer);
      report.firstComparisonMs = Math.round(performance.now() - compared);
      report.resultStatus = await page.locator('[data-status]').getAttribute('data-status');
      report.coreMetrics = await page.evaluate(() => (window as any).__policyMetrics);
    }
  } catch (error) { report.error = String(error); }
  clearTimeout(timer);
  report.snapshotAt15Seconds = snapshot;
  report.requests = [...requests.values()];
  report.events = events;
  reports.push(report);
  writeFileSync(output, JSON.stringify({ recordedAt: new Date().toISOString(), target: url, routed: process.env.POLICY_RECORD_ROUTE === '1', scope: 'Observed browser loading on this Mac/network. Worker CDP records byte arrival without routing requests. Repeated visits reuse the context cache.', visits: reports }, null, 2) + '\n');
  await page.close();
}
await browser.close();
console.log(JSON.stringify(reports.map((r: any) => ({ visit: r.visit, pdfReadyMs: r.pdfReadyMs, firstComparisonMs: r.firstComparisonMs, resultStatus: r.resultStatus, alerts: r.alerts, error: r.error }))));
