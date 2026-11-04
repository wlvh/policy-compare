import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function releaseBase(id: string) {
  if (!/^[a-z](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(id)) throw new Error('Release ID must be 1–40 lowercase letters, digits or hyphens, starting with a letter and ending with a letter or digit');
  return `/releases/${id}/`;
}
export function resourceManifest(root: string, prefix = ''): {path: string; bytes: number; sha256: string}[] {
  return readdirSync(join(root, prefix), {withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const path = prefix + entry.name;
    if (entry.isDirectory()) return resourceManifest(root, path + '/');
    if (!entry.isFile() || path === 'build-info.json') return [];
    const bytes = readFileSync(join(root, path));
    return [{path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}];
  });
}
