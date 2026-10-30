// Stored comparison results stay readable by their own format: every result
// JSON under reports/ (plain or .gz) is parsed with the schema its
// schemaVersion names: format 1 (ResultSchema, with importance categories)
// or format 2 (ResultSchemaV2). Nothing is rewritten.
// usage: pnpm exec tsx reports/issue-2-validation/formats.ts OUT_JSON
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { RESULT_VERSION, ResultSchema, ResultSchemaV2, VERSION } from "../../packages/contracts/index";
const [out] = process.argv.slice(2);
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.json(\.gz)?$/.test(name)) files.push(p);
  }
};
walk("reports");
const counts: Record<string, { parsed: number; failed: string[] }> = {};
for (const file of files) {
  let data: any;
  try {
    const raw = readFileSync(file);
    data = JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"));
  } catch {
    continue;
  }
  const version = data?.schemaVersion;
  if (!data || !Array.isArray(data.differences) || ![VERSION, RESULT_VERSION].includes(version)) continue;
  const schema = version === VERSION ? ResultSchema : ResultSchemaV2;
  const c = (counts[version] ??= { parsed: 0, failed: [] });
  if (schema.safeParse(data).success) c.parsed++;
  else c.failed.push(file);
}
writeFileSync(out, JSON.stringify({ counts }, null, 1) + "\n");
console.log(JSON.stringify(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { parsed: v.parsed, failed: v.failed.length }]))));
if (Object.values(counts).some((c) => c.failed.length)) process.exitCode = 1;
