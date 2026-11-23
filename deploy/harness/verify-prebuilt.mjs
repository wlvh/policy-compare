// Verify committed MuPDF browser bytes before building the offline container.
// --check-source additionally rejects stale assets after product code changes.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, join, sep } from 'node:path';

const args = process.argv.slice(2);
const checkSource = args.includes('--check-source');
const pathArg = args.find(arg => !arg.startsWith('--')) ?? 'prebuilt/mupdf';
const root = realpathSync(resolve(pathArg));
const info = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8'));
if (info.engine !== 'mupdf' || !/^[a-f0-9]{40}$/.test(info.revision ?? '') ||
    !/^[a-z](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(info.releaseId ?? '') ||
    info.base !== '/releases/' + info.releaseId + '/' || !Array.isArray(info.resources)) {
  throw new Error('Invalid MuPDF prebuilt manifest, revision or release path');
}
const expected = new Set();
for (const entry of info.resources) {
  const p = entry.path;
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('\\') ||
      p.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) ||
      !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) {
    throw new Error('Invalid resource entry: ' + String(p));
  }
  if (expected.has(p)) throw new Error('Duplicate resource: ' + p);
  expected.add(p);
  const file = realpathSync(resolve(root, p));
  if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error('Unsafe resource path: ' + p);
  const bytes = readFileSync(file);
  if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
    throw new Error('Resource integrity failure: ' + p);
  }
}
if (!expected.has('index.html')) throw new Error('Missing index.html in prebuilt resources');
const actual = new Set();
function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, ent.name);
    if (ent.isDirectory()) walk(file);
    else if (ent.isFile()) {
      const key = relative(root, file).split(sep).join('/');
      if (key !== 'build-info.json') actual.add(key);
    } else throw new Error('Non-regular file in prebuilt tree: ' + file);
  }
}
walk(root);
for (const file of actual) if (!expected.has(file)) throw new Error('Unlisted file in prebuilt payload: ' + file);
for (const file of expected) if (!actual.has(file)) throw new Error('Missing file in prebuilt payload: ' + file);
if (checkSource) {
  const paths = [
    'apps', 'crates', 'engines', 'packages', 'patches', 'vendor',
    'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml',
    'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'tsconfig.mupdf.json', 'vite.config.ts',
    'scripts/build-rust.ts', 'scripts/core-artifact.ts', 'scripts/release-config.ts',
    'deploy/server.mjs', 'LICENSE', 'NOTICE',
  ];
  function git(cmd) { return execFileSync('git', cmd, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); }
  git(['cat-file', '-e', info.revision + '^{commit}']);
  git(['merge-base', '--is-ancestor', info.revision, 'HEAD']);
  const changed = git(['diff', '--name-only', info.revision, 'HEAD', '--', ...paths]).trim();
  if (changed) throw new Error('Prebuilt payload is STALE versus current sources:\n' + changed);
  const local = git(['status', '--porcelain', '--untracked-files=normal', '--', ...paths]).trim();
  if (local) throw new Error('Build sources contain uncommitted changes:\n' + local);
}
console.log('PASS prebuilt MuPDF: ' + info.releaseId + ' from ' + info.revision + '; ' +
            expected.size + ' checked files' + (checkSource ? '; source diff clean' : ''));
