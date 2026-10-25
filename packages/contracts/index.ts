import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const VERSION = "policy-compare/0.1.0";
const finite = z.number().finite();
export const PointSchema = z.tuple([finite, finite]);
export const QuadSchema = z.tuple([
  finite,
  finite,
  finite,
  finite,
  finite,
  finite,
  finite,
  finite,
]);
const matrix = z.tuple([finite, finite, finite, finite, finite, finite]);
const range = z
  .tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
  .refine(([a, b]) => a <= b);
const side = z.enum(["left", "right"]);
const precision = z.enum(["glyph", "shared_glyph", "run", "line", "synthetic"]);
const sourceRange = z.object({
  itemId: z.string(),
  itemText: z.string().optional(),
  scalarRange: range,
  utf16Range: range,
});
export const CharacterSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  rawRange: range,
  origin: PointSchema,
  quad: QuadSchema,
  size: finite.positive(),
  style: z.string(),
  provenance: z.enum(["extracted", "synthetic", "inferred"]),
  precision,
  sourceRef: sourceRange.optional(),
  geometryMethod: z.enum(["native_glyph", "engine_run", "inferred"]).optional(),
  sharedGeometry: z.string().nullable(),
});
export const LineSchema = z.object({
  id: z.string(),
  charIds: z.array(z.string()),
  direction: PointSchema,
  writingMode: z.enum(["horizontal", "vertical"]),
  baseline: PointSchema,
  baselineProvenance: z.enum(["measured", "inferred", "synthetic"]),
});
export const CoverageSchema = z.object({
  side,
  pageIndex: z.number().int().nonnegative(),
  region: z.tuple([finite, finite, finite, finite]),
  reason: z.enum([
    "raster_only_content",
    "unverified_image_text_region",
    "encoding_unknown",
    "page_failed",
    "body_missing",
    "unsupported_objects",
  ]),
  evidence: z.string().min(1),
  message: z.string().min(1),
  defaultVisible: z.literal(true),
});
export const PageSchema = z.object({
  pageIndex: z.number().int().nonnegative(),
  width: finite.positive(),
  height: finite.positive(),
  transform: matrix,
  inverseTransform: matrix,
  chars: z.array(CharacterSchema),
  lines: z.array(LineSchema),
  textItems: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  coverageState: z.enum(["text", "confirmed_blank", "suspect", "failed"]),
  issues: z.array(CoverageSchema.omit({ side: true })),
});
export const DocSchema = z.object({
  schemaVersion: z.literal(VERSION),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  extractor: z.object({
    name: z.string(),
    version: z.string(),
    adapterVersion: z.string().optional(),
    options: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()]),
    ),
  }),
  coordinateSystem: z.literal("display-top-left-pt/ul-ur-ll-lr"),
  indexUnit: z.literal("unicode-scalar"),
  pages: z.array(PageSchema),
  pageCount: z.number().int().nonnegative(),
  diagnostics: z.array(z.string()),
});
export const LocationSchema = z.object({
  side,
  pageIndex: z.number().int().nonnegative(),
  unitId: z.string(),
  rawRange: range,
  charIds: z.array(z.string()).min(1),
  text: z.string().min(1),
  quads: z.array(QuadSchema).min(1),
  direction: PointSchema,
  precision,
  sourceRanges: z.array(sourceRange).optional(),
  geometryMethod: z
    .enum(["native_glyph", "text_layer_range", "engine_run", "inferred"])
    .optional(),
  resolvedGeometry: z
    .object({
      method: z.literal("text_layer_range"),
      quads: z.array(QuadSchema),
      text: z.string(),
    })
    .optional(),
});
export const StructureSchema = z.object({
  section: z.string(),
  entity: z.string().nullable(),
  field: z.string().nullable(),
  table: z.string().nullable(),
  rowKey: z.string().nullable(),
  confidence: z.enum(["reliable", "candidate", "unresolved"]),
});
export const OperationSchema = z.object({
  kind: z.enum(["equal", "insert", "delete"]),
  text: z.string(),
  left: z.array(LocationSchema),
  right: z.array(LocationSchema),
});
export const DifferenceSchema = z.object({
  id: z.string(),
  kind: z.enum(["Added", "Removed", "Replaced", "Moved"]),
  category: z.enum(["Material", "Review", "RollForward", "Cosmetic"]),
  structurePath: StructureSchema.nullable(),
  left: z.array(LocationSchema),
  right: z.array(LocationSchema),
  oldText: z.string(),
  newText: z.string(),
  textOps: z.array(OperationSchema),
  hasTextChange: z.boolean(),
  defaultVisible: z.literal(true),
  matchEvidence: z.object({
    method: z.string(),
    score: finite.nullable(),
    details: z.array(z.string()),
  }),
  reviewReasons: z.array(z.string()),
  occurrences: z.array(
    z.object({ left: z.array(LocationSchema), right: z.array(LocationSchema) }),
  ),
});
export const UnresolvedSchema = z.object({
  reason: z.enum([
    "budget",
    "ambiguous_identity",
    "ambiguous_match",
    "word_diff_budget",
  ]),
  message: z.string(),
  left: z.array(LocationSchema),
  right: z.array(LocationSchema),
  defaultVisible: z.literal(true),
});
export const ResultSchema = z.object({
  schemaVersion: z.literal(VERSION),
  coreVersion: z.string(),
  extractors: z.tuple([DocSchema.shape.extractor, DocSchema.shape.extractor]),
  tokenizerVersion: z.string(),
  profileVersion: z.string(),
  snapshotHashVersion: z.literal("page-merkle/1"),
  documentHashes: z.tuple([z.string(), z.string()]),
  extractionSnapshotHashes: z.tuple([z.string(), z.string()]),
  configDigest: z.string(),
  scope: z.literal("extracted_text"),
  status: z.enum(["complete_for_scope", "partial", "failed", "cancelled"]),
  differences: z.array(DifferenceSchema),
  coverage: z.array(CoverageSchema),
  unresolved: z.array(UnresolvedSchema),
  alignment: z.array(
    z.object({
      leftPage: z.number(),
      leftY: finite,
      rightPage: z.number(),
      rightY: finite,
    }),
  ),
  stats: z.object({
    leftScalars: z.number(),
    rightScalars: z.number(),
    candidates: z.number(),
    tokenProducts: z.number(),
    differenceCount: z.number(),
    occurrenceCount: z.number(),
  }),
  diagnostics: z.array(z.string()),
});
export type DocInput = z.infer<typeof DocSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type SourceLocation = z.infer<typeof LocationSchema>;
export type StructurePath = z.infer<typeof StructureSchema>;
export type Difference = z.infer<typeof DifferenceSchema>;
export type CompareResult = z.infer<typeof ResultSchema>;
export type CoverageIssue = z.infer<typeof CoverageSchema>;
export type Quad = z.infer<typeof QuadSchema>;
export type Side = "left" | "right";

export function scalarOffsets(text: string): number[] {
  const offsets = [0];
  let n = 0;
  for (const c of text) {
    n += c.length;
    offsets.push(n);
  }
  return offsets;
}
export function quantize(n: number): number {
  if (!Number.isFinite(n)) throw new Error("Non-finite coordinate");
  return (Math.sign(n) * Math.floor(Math.abs(n) * 1000 + 0.5)) / 1000 || 0;
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",") +
    "}"
  );
}
export function digest(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonical(value))));
}
export function hashBytes(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
export function snapshotDigest(doc: DocInput,checkpoint?:()=>void): string {
  // Hash bounded page snapshots, then their ordered root; no whole-document
  // canonical string or UTF-8 buffer is retained at the same time as DocInput.
  return digest({
    ...doc,
    pages: doc.pages.map((page) => {checkpoint?.();return digest(page);}),
    snapshotHashVersion: "page-merkle/1",
  });
}
export function parseDoc(value: unknown): DocInput {
  if (
    !value ||
    typeof value !== "object" ||
    !("pages" in value) ||
    !Array.isArray(value.pages)
  )
    throw new Error("Document pages required");
  const metadata = DocSchema.omit({ pages: true }).parse(value);
  // Validate one page at a time, but retain the original validated pages. This
  // avoids simultaneous complete copies of both extracted documents in workers.
  for (const page of value.pages) PageSchema.parse(page);
  const doc: DocInput = { ...metadata, pages: value.pages };
  if (doc.pageCount !== doc.pages.length) throw new Error("pageCount mismatch");
  const allIds = new Set<string>();
  doc.pages.forEach((p, i) => {
    const textItems=new Map((p.textItems??[]).map(item=>[item.id,{text:item.text,offsets:scalarOffsets(item.text)}]));
    if (p.pageIndex !== i) throw new Error("Non-contiguous page indexes");
    let offset = 0;
    const ids = new Set<string>();
    for (const c of p.chars) {
      if(c.sourceRef){const source=c.sourceRef,item=textItems.get(source.itemId);if(!item||item.offsets[source.scalarRange[0]]!==source.utf16Range[0]||item.offsets[source.scalarRange[1]]!==source.utf16Range[1]||item.text.slice(...source.utf16Range)!==c.text)throw new Error('Invalid source item Unicode/UTF-16 mapping');}
      if (allIds.has(c.id)) throw new Error("Duplicate character ID");
      allIds.add(c.id);
      ids.add(c.id);
      const count = Array.from(c.text).length;
      if (c.rawRange[0] !== offset || c.rawRange[1] !== offset + count)
        throw new Error("Invalid Unicode scalar range");
      offset += count;
    }
    const covered = new Set<string>();
    for (const l of p.lines)
      for (const id of l.charIds) {
        if (!ids.has(id) || covered.has(id))
          throw new Error("Line character conservation violation");
        covered.add(id);
      }
    if (covered.size !== ids.size)
      throw new Error("Unassigned extracted character");
    if (["failed", "suspect"].includes(p.coverageState) && !p.issues.length)
      throw new Error("Missing concrete coverage issue");
    if (p.coverageState === "confirmed_blank" && p.chars.length)
      throw new Error("Blank page has text");
    if (p.issues.some((x) => x.pageIndex !== i))
      throw new Error("Coverage page mismatch");
  });
  return doc;
}
export function resolveLocation(
  loc: SourceLocation,
  docs: [DocInput, DocInput],
): boolean {
  const p = docs[loc.side === "left" ? 0 : 1].pages[loc.pageIndex];
  if (!p) return false;
  const index = new Map(p.chars.map((c) => [c.id, c]));
  const cs = loc.charIds.map((id) => index.get(id));
  return (
    cs.every(Boolean) &&
    cs.map((c) => c!.text).join("") === loc.text &&
    canonical(
      loc.precision === "run"
        ? [...new Map(cs.map((c) => [canonical(c!.quad), c!.quad])).values()]
        : cs.map((c) => c!.quad),
    ) === canonical(loc.quads) &&
    cs[0]!.rawRange[0] === loc.rawRange[0] &&
    cs.at(-1)!.rawRange[1] === loc.rawRange[1] &&
    p.lines.some(
      (l) =>
        loc.charIds.every((id) => l.charIds.includes(id)) &&
        canonical(l.direction) === canonical(loc.direction),
    )
  );
}
