import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { releaseBase, resourceManifest } from './release-config.ts';

const [candidatePath, previousSitePath, outputPath] = process.argv.slice(2);
if (!candidatePath || !previousSitePath || !outputPath) throw new Error('Usage: package-cloudflare.ts <container.json> <previous-site> <new-site>');
const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
if (candidate.status !== 'PASS' || !/^sha256:[a-f0-9]{64}$/.test(candidate.imageId)) throw new Error('A checked candidate image is required');
const base = releaseBase(candidate.releaseId);
const output = resolve(outputPath);
if (existsSync(output)) throw new Error('Output directory already exists');
const temporary = mkdtempSync(join(tmpdir(), 'policy-pages-'));
const previous = previousSitePath.startsWith('https://') ? join(temporary, 'downloaded-site') : resolve(previousSitePath);
const approved = JSON.parse(readFileSync('reports/public-pilot/r20-a3-mupdf/approved-site-files.json', 'utf8'));
let container = '';
try {
  if (previousSitePath.startsWith('https://')) {
    for (const item of approved.filter((file: any) => file.served)) {
      const response = await fetch(new URL(item.path, previousSitePath), { signal: AbortSignal.timeout(300_000) });
      if (!response.ok) throw new Error(`Previous file unavailable: ${item.path}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error(`Previous file identity differs: ${item.path}`);
      const target = join(previous, item.path);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, bytes);
    }
    cpSync(join(previous, 'open-source/hosting-headers.txt'), join(previous, '_headers'));
    cpSync('deploy/cloudflare/_redirects', join(previous, '_redirects'));
  }
  for (const item of approved) {
    const bytes = readFileSync(join(previous, item.path));
    if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error(`Previous site identity differs: ${item.path}`);
  }
  const original = JSON.parse(readFileSync(join(previous, 'releases/r20-a3-mupdf/build-info.json'), 'utf8'));
  cpSync(previous, output, { recursive: true });
  const release = join(output, base);
  if (existsSync(release)) throw new Error('Release path already exists in the previous site');
  mkdirSync(release, { recursive: true });
  container = execFileSync('docker', ['create', candidate.imageId], { encoding: 'utf8' }).trim();
  const imageTar = join(temporary, 'image.tar');
  writeFileSync(imageTar, execFileSync('docker', ['cp', `${container}:/app/dist/.`, '-'], { maxBuffer: 64 * 1024 * 1024 }));
  execFileSync('tar', ['-xf', imageTar, '-C', release]);
  const manifestBytes = readFileSync(join(release, 'build-info.json'));
  const manifest = JSON.parse(manifestBytes.toString());
  const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  if (digest(manifestBytes) !== candidate.manifestSha256 || manifest.revision !== candidate.revision || manifest.base !== base) throw new Error('Image manifest differs from candidate');
  for (const item of manifest.resources) {
    const bytes = readFileSync(join(release, item.path));
    if (bytes.length !== item.bytes || digest(bytes) !== item.sha256) throw new Error(`Image resource mismatch: ${item.path}`);
  }
  for (const name of ['_headers', '_redirects', 'healthz.json', '404.html', 'pilot.css', 'AGPL-3.0.txt', 'DISTRIBUTION-NOTICE.txt']) {
    cpSync(`deploy/cloudflare/${name}`, join(output, name));
  }
  const index = readFileSync('deploy/cloudflare/index.html', 'utf8').replaceAll('__RELEASE_ID__', candidate.releaseId);
  writeFileSync(join(output, 'index.html'), index);
  const source = join(temporary, `policy-compare-${candidate.revision.slice(0, 7)}`);
  mkdirSync(source);
  const sourceTar = join(temporary, 'source.tar');
  execFileSync('git', ['archive', '--format=tar', '--output', sourceTar, candidate.revision, 'apps', 'packages', 'engines', 'profiles', 'crates', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'patches', 'scripts', 'deploy', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'tsconfig.mupdf.json', 'tsconfig.pdfjs.json', 'vite.config.ts', 'LICENSE', 'NOTICE']);
  execFileSync('tar', ['-xf', sourceTar, '-C', source]);
  // Reuse the already distributed Rust dependency sources. The core lockfile must match.
  const oldSource = join(temporary, 'previous');
  mkdirSync(oldSource);
  execFileSync('tar', ['-xzf', join(previous, 'open-source/application-source.tar.gz'), '-C', oldSource]);
  const oldRoot = join(oldSource, `policy-compare-${original.revision.slice(0, 7)}`);
  if (!readFileSync(join(oldRoot, 'Cargo.lock')).equals(readFileSync(join(source, 'Cargo.lock')))) throw new Error('Rust dependencies changed; refresh corresponding dependency sources');
  for (const name of ['vendor', '.cargo']) cpSync(join(oldRoot, name), join(source, name), { recursive: true });
  cpSync('LICENSE', join(source, 'LICENSE'));
  cpSync('NOTICE', join(source, 'NOTICE'));
  const sourceName = `application-source-${candidate.revision.slice(0, 7)}.tar.gz`;
  const sourceDirectory = join(output, 'open-source');
  execFileSync('tar', ['-czf', join(sourceDirectory, sourceName), '-C', temporary, `policy-compare-${candidate.revision.slice(0, 7)}`]);
  const buildName = `BUILDING-${candidate.releaseId}.txt`;
  writeFileSync(join(sourceDirectory, buildName), `Corresponding application source ${candidate.revision}\nRelease ${candidate.releaseId}\nArchive ${sourceName}\n\nUse Node 24 LTS, pnpm 10.12.1 and Rust 1.93.0.\nRun pnpm install --frozen-lockfile, then pnpm install:mupdf.\nRun POLICY_RELEASE_ID=${candidate.releaseId} POLICY_REVISION=${candidate.revision} pnpm build:mupdf.\nThe pinned Docker build recipe is deploy/Dockerfile.\nRust dependency source is included under vendor/ with .cargo/config.toml.\nComplete MuPDF and JavaScript dependencies remain listed in BUILDING.txt and archives.json.\nNOTICE supplies the AGPL distribution terms and modifications.\n`);
  cpSync(join(output, '_headers'), join(sourceDirectory, 'hosting-headers.txt'));
  cpSync('NOTICE', join(sourceDirectory, `NOTICE-${candidate.releaseId}.txt`));
  const archivesPath = join(sourceDirectory, 'archives.json');
  const archives = JSON.parse(readFileSync(archivesPath, 'utf8'));
  const paths = new Set<string>(archives.files.map((file: { path: string }) => file.path));
  for (const name of [sourceName, buildName, `NOTICE-${candidate.releaseId}.txt`]) paths.add(name);
  archives.files = [...paths].sort().map(path => {
    const bytes = readFileSync(join(sourceDirectory, path));
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  });
  writeFileSync(archivesPath, JSON.stringify(archives, null, 2) + '\n');
  writeFileSync(join(sourceDirectory, 'SHA256SUMS'), archives.files.map((file: any) => `${file.sha256}  ${file.path}\n`).join(''));
  const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const sourceFiles = archives.files.map((file: { path: string; bytes: number }) =>
    `<li><a href="${escapeHtml(file.path)}">${escapeHtml(file.path)}</a> — ${file.bytes.toLocaleString('en-US')} bytes</li>`).join('\n');
  const sourceIndex = readFileSync('deploy/cloudflare/open-source.html', 'utf8')
    .replaceAll('__RELEASE_ID__', candidate.releaseId)
    .replaceAll('__SOURCE_NAME__', sourceName)
    .replaceAll('__BUILD_NAME__', buildName)
    .replace('__SOURCE_FILES__', sourceFiles);
  writeFileSync(join(sourceDirectory, 'index.html'), sourceIndex);
  // Keep every original release byte, including its manifest, for comparison and rollback.
  for (const item of [...original.resources, { path: 'build-info.json' }]) {
    const relative = join('releases/r20-a3-mupdf', item.path);
    if (!readFileSync(join(previous, relative)).equals(readFileSync(join(output, relative)))) throw new Error(`Original release changed: ${relative}`);
  }
  const files = resourceManifest(output);
  if (files.some(file => file.bytes > 25 * 1024 * 1024)) throw new Error('A file exceeds the Pages 25 MiB limit');
  writeFileSync(resolve(output, '..', 'package.json'), JSON.stringify({ releaseId: candidate.releaseId, revision: candidate.revision, imageId: candidate.imageId, manifestSha256: candidate.manifestSha256, previousReleasePreserved: 'r20-a3-mupdf', files }, null, 2) + '\n');
  console.log(JSON.stringify({ output, releaseId: candidate.releaseId, files: files.length, manifestSha256: candidate.manifestSha256 }));
} finally {
  if (container) execFileSync('docker', ['rm', container], { stdio: 'ignore' });
  rmSync(temporary, { recursive: true, force: true });
}
