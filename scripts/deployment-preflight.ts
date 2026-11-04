import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
export default async function preflight() {
  const target = new URL(process.env.POLICY_BASE_URL!);
  const response = await fetch(new URL('build-info.json',target), {redirect:'error',signal:AbortSignal.timeout(15_000)});
  if (!response.ok) throw new Error('Target build-info unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  const manifestSha256 = createHash('sha256').update(bytes).digest('hex');
  const info = JSON.parse(bytes.toString());
  if (manifestSha256 !== process.env.POLICY_MANIFEST_SHA256 || info.releaseId !== process.env.POLICY_RELEASE_ID || info.engine !== (process.env.POLICY_ENGINE || 'mupdf') || target.pathname !== info.base) throw new Error('Target release, engine, base path or resource manifest differs from expected artifact');
  const page = await fetch(target,{redirect:'error',signal:AbortSignal.timeout(15_000)});
  if (!page.ok || !page.headers.get('content-type')?.startsWith('text/html') || page.headers.get('cross-origin-opener-policy') !== 'same-origin' || page.headers.get('cross-origin-embedder-policy') !== 'require-corp') throw new Error('Target HTML or isolation headers invalid');
  const dir = process.env.POLICY_REPORT_DIR || 'reports'; mkdirSync(dir,{recursive:true});
  writeFileSync(`${dir}/target-preflight.json`,JSON.stringify({target:target.href, releaseId:info.releaseId, engine:info.engine, revision:info.revision, manifestSha256, status:'PASS', scope:'artifact identity and HTTP headers only; browser flows reported separately'},null,2)+'\n');
}
