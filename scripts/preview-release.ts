import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { releaseBase } from './release-config.ts';

const exec = promisify(execFile);
const candidatePath = process.argv[2];
if (!candidatePath || process.argv.length > 4) throw new Error('Usage: pnpm preview:release <container.json> [port=8088]');
const port = Number(process.argv[3] || 8088);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be an integer from 1024 to 65535');
const candidateBytes = readFileSync(candidatePath);
const candidate = JSON.parse(candidateBytes.toString());
if (candidate.status !== 'PASS') throw new Error('Candidate container check must be PASS; manual preview cannot waive a failed check');
if (!/^sha256:[a-f0-9]{64}$/.test(candidate.imageId || '') || !/^[a-f0-9]{64}$/.test(candidate.manifestSha256 || '')) throw new Error('Candidate report must include an exact image ID and manifest SHA-256');
if (!['mupdf', 'pdfjs'].includes(candidate.engine) || !/^linux\/(arm64|amd64)$/.test(candidate.platform || '') || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(candidate.revision || '')) throw new Error('Candidate engine, platform or revision is invalid');
const base = releaseBase(candidate.releaseId || '');
const name = `policy-preview-${candidate.releaseId}-${candidate.engine}-${port}`;
const origin = `http://127.0.0.1:${port}`;
const attempt = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const reportDir = resolve(process.env.POLICY_PREVIEW_REPORT_DIR || `${dirname(resolve(candidatePath))}/manual-review/${attempt}`);
if (existsSync(reportDir)) throw new Error('Preview report directory already exists; use a new directory to retain previous evidence');
mkdirSync(dirname(reportDir), { recursive: true });
mkdirSync(reportDir);
const context = {
  candidateReport: resolve(candidatePath), candidateReportSha256: createHash('sha256').update(candidateBytes).digest('hex'),
  releaseId: candidate.releaseId,
  revision: candidate.revision, engine: candidate.engine, platform: candidate.platform,
  imageId: candidate.imageId, manifestSha256: candidate.manifestSha256,
  url: origin + '/', versionUrl: origin + base, containerName: name,
  scope: 'release_image_manual_review_only', clusterAcceptance: 'NOT_EVALUATED',
};
const manual = {
  ...context, status: 'NOT_EVALUATED', reviewer: null, reviewedAt: null, browser: null,
  instructions: 'Record PASS, FAIL or NOT_EVALUATED for each check, with observations and evidence. Startup is not manual acceptance. Do not include confidential PDF text in this record.',
  checks: [
    ['P02', '1315 的 USD 100 → USD 2000 可见；1760 的 USD 1000 未改。'],
    ['P01', '相同文件没有内容变化卡，也没有已记录的覆盖缺口或对应未决。'],
    ['E03', '扫描图片明确提示文字尚未比较；零张文字卡不被解释为文档无变化。'],
    ['source_search_export', 'P02 高亮位于实际编辑，搜索 1315 能回到原文，JSON 导出保留本次变化与来源。'],
    ['swap', '交换两份文件后，P02 变化方向为 USD 2000 → USD 100。'],
    ['cancel_restart', '任务处理中取消后可以重新比较；任务已结束后的点击不计为取消成功。'],
    ['close_task', '关闭任务后，文件选择、密码、搜索与文档显示清除，下一组比较可正常进行。'],
  ].map(([id, expected]) => ({ id, expected, status: 'NOT_EVALUATED', observations: '', evidence: [] })),
};
writeFileSync(`${reportDir}/manual-review.json`, JSON.stringify(manual, null, 2) + '\n');

async function docker(args: string[]) {
  return (await exec('docker', args, { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
}
async function inspectContainer() {
  try { return JSON.parse(await docker(['container', 'inspect', name]))[0]; }
  catch (error) {
    if (/No such (?:container|object)/i.test(String((error as { stderr?: string }).stderr))) return null;
    throw error;
  }
}
function checkRuntime(runtime: any) {
  const binding = runtime.HostConfig.PortBindings?.['8080/tcp'];
  if (runtime.Image !== candidate.imageId || runtime.Config.Labels?.['org.policy.release-preview'] !== candidate.imageId ||
      !runtime.HostConfig.ReadonlyRootfs || runtime.Config.User !== '12345:12345' || runtime.Mounts.length ||
      runtime.HostConfig.Memory !== 256 * 1024 * 1024 || runtime.HostConfig.NanoCpus !== 1_000_000_000 ||
      !runtime.HostConfig.CapDrop?.includes('ALL') || !runtime.HostConfig.SecurityOpt?.includes('no-new-privileges') ||
      binding?.length !== 1 || binding[0].HostIp !== '127.0.0.1' || binding[0].HostPort !== String(port)) {
    throw new Error('Existing container identity or runtime constraints differ; no container was replaced');
  }
}
let startedByThisRun = false;
try {
  const image = JSON.parse(await docker(['image', 'inspect', candidate.imageId]))[0];
  const labels = image.Config.Labels || {};
  if (image.Id !== candidate.imageId || `${image.Os}/${image.Architecture}` !== candidate.platform ||
      labels['org.opencontainers.image.revision'] !== candidate.revision ||
      labels['org.opencontainers.image.version'] !== candidate.releaseId || labels['org.policy.engine'] !== candidate.engine) {
    throw new Error('Local image differs from the candidate report');
  }
  let runtime = await inspectContainer();
  if (runtime) {
    checkRuntime(runtime);
    if (!runtime.State.Running) { await docker(['start', name]); startedByThisRun = true; }
  } else {
    await docker(['run', '--detach', '--name', name, '--label', `org.policy.release-preview=${candidate.imageId}`,
      '--read-only', '--user', '12345:12345', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--memory', '256m', '--cpus', '1', '--publish', `127.0.0.1:${port}:8080`, candidate.imageId]);
    startedByThisRun = true;
  }
  let healthy = false;
  for (let n = 0; n < 40; n++) {
    try { healthy = (await fetch(origin + '/healthz', { signal: AbortSignal.timeout(1000) })).ok; if (healthy) break; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  if (!healthy) throw new Error('Preview health endpoint did not become ready');
  const response = await fetch(origin + base + 'build-info.json', { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Release manifest unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  const manifest = JSON.parse(bytes.toString());
  if (createHash('sha256').update(bytes).digest('hex') !== candidate.manifestSha256 ||
      manifest.releaseId !== candidate.releaseId || manifest.revision !== candidate.revision ||
      manifest.engine !== candidate.engine || manifest.base !== base) throw new Error('Served artifact differs from the expected candidate');
  const entry = await fetch(origin, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
  if (entry.status !== 302 || entry.headers.get('location') !== base || entry.headers.get('cache-control') !== 'no-store') throw new Error('Entry redirect differs from the release path');
  const page = await fetch(origin + base, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!page.ok || !page.headers.get('content-type')?.startsWith('text/html') ||
      page.headers.get('cross-origin-opener-policy') !== 'same-origin' ||
      page.headers.get('cross-origin-embedder-policy') !== 'require-corp') throw new Error('Release HTML or isolation headers unavailable');
  runtime = await inspectContainer();
  if (!runtime?.State.Running) throw new Error('Preview container stopped');
  checkRuntime(runtime);
  writeFileSync(`${reportDir}/preview.json`, JSON.stringify({ ...context, status: 'READY_FOR_MANUAL_REVIEW',
    checkedAt: new Date().toISOString(), checks: { imageIdentity: 'PASS', runtimeConstraints: 'PASS', health: 'PASS',
      manifest: 'PASS', redirect: 'PASS', htmlAndHeaders: 'PASS' }, manualReview: 'NOT_EVALUATED',
    container: { id: runtime.Id, image: runtime.Image, user: runtime.Config.User,
      readOnly: runtime.HostConfig.ReadonlyRootfs, memory: runtime.HostConfig.Memory,
      nanoCpus: runtime.HostConfig.NanoCpus, mounts: runtime.Mounts, portBindings: runtime.HostConfig.PortBindings,
      capDrop: runtime.HostConfig.CapDrop, securityOpt: runtime.HostConfig.SecurityOpt },
    stopCommand: `docker stop ${name}`, restartCommand: `docker start ${name}`,
  }, null, 2) + '\n');
  console.log(`体验地址：${origin}/\n发布版本：${candidate.releaseId}\n引擎：${candidate.engine}\n记录目录：${reportDir}\n状态：READY_FOR_MANUAL_REVIEW（人工检查未评价）\n停止服务：docker stop ${name}`);
} catch (error) {
  const message = (error as Error).message;
  if (startedByThisRun) await docker(['stop', name]).catch(() => {});
  writeFileSync(`${reportDir}/preview.json`, JSON.stringify({ ...context, status: 'START_FAILED', error: message,
    manualReview: 'NOT_EVALUATED', checkedAt: new Date().toISOString() }, null, 2) + '\n');
  console.error(`发布镜像体验入口启动失败：${message}\n记录目录：${reportDir}`);
  process.exitCode = 1;
}
