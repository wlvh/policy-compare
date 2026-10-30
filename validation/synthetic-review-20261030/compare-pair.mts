// Thin evidence wrapper: the project's existing extraction and comparison APIs.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const get = (flag: string) => {
  const i = args.indexOf(flag);
  if (i < 0 || !args[i + 1]) throw new Error(`Missing ${flag}`);
  return args[i + 1];
};
try {
  const repo = resolve(get('--repo')), out = resolve(get('--out'));
  const moduleAt = (file: string) => import(pathToFileURL(join(repo, file)).href);
  const { loadEngine } = await moduleAt('packages/pdf-adapter/node.ts');
  const { parseDoc, canonical } = await moduleAt('packages/contracts/index.ts');
  const { compare } = await moduleAt('packages/compare-core/index.ts');
  const { extractPdf } = await loadEngine(get('--engine'));
  const docs = [];
  for (const side of ['left', 'right']) {
    const doc = parseDoc(await extractPdf(readFileSync(get(`--${side}`))));
    writeFileSync(join(out, `${side}.doc.json`), canonical(doc) + '\n', { flag: 'wx' });
    docs.push(doc);
  }
  const result = compare(docs[0], docs[1]);
  writeFileSync(join(out, 'result.json'), canonical(result) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: result.status, differences: result.differences.length }));
  process.exitCode = result.status === 'complete_for_scope' ? 0 : 2;
} catch (error) {
  console.error(String(error));
  process.exitCode = 3;
}
