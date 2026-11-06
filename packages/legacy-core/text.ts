import type { SourceLocation, Character, Page, Side } from "../contracts/index";
export type Ref = { char: Character; page: Page; line: Page["lines"][number] };
export type MappedText = {
  rawText: string;
  refs: (Ref | null)[];
  matchText: string;
  mapping: number[][];
  transforms: {
    raw: [number, number];
    match: [number, number];
    kind: string;
  }[];
};
export function normalize(rawText: string, refs: (Ref | null)[]): MappedText {
  const scalars = Array.from(rawText);
  const chunks: { s: string; indexes: number[] }[] = [];
  scalars.forEach((c, i) => {
    if (/\p{M}/u.test(c) && chunks.length) {
      chunks.at(-1)!.s += c;
      chunks.at(-1)!.indexes.push(i);
    } else chunks.push({ s: c, indexes: [i] });
  });
  let pieces = chunks.map((c) => ({ ...c, n: c.s.normalize("NFKC") }));
  if (pieces.map((p) => p.n).join("") !== rawText.normalize("NFKC"))
    pieces = [
      {
        s: rawText,
        n: rawText.normalize("NFKC"),
        indexes: scalars.map((_, i) => i),
      },
    ];
  const out: string[] = [],
    mapping: number[][] = [],
    transforms: MappedText["transforms"] = [];
  for (const p of pieces) {
    const start = out.length;
    for (const c of p.n) {
      if (/\s/u.test(c) && out.at(-1) === " ") {
        mapping.at(-1)!.push(...p.indexes);
        continue;
      }
      out.push(/\s/u.test(c) ? " " : c);
      mapping.push([...p.indexes]);
    }
    if (p.s !== p.n)
      transforms.push({
        raw: [p.indexes[0], p.indexes.at(-1)! + 1],
        match: [start, out.length],
        kind: "NFKC-cluster",
      });
  }
  return { rawText, refs, matchText: out.join(""), mapping, transforms };
}
export function tokenize(text: string): string[] {
  return (
    text.match(/[\p{L}\p{M}]+|\p{N}+(?:[.,]\p{N}+)*|[^\p{L}\p{M}\p{N}\s]/gu) ??
    []
  );
}
export function lcsLength(a: string[], b: string[],checkpoint?:()=>void): number {
  let prev = new Uint32Array(b.length + 1),
    next = new Uint32Array(b.length + 1);
  for (const x of a) {
    checkpoint?.();
    for (let j = 1; j <= b.length; j++)
      next[j] =
        x === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], next[j - 1]);
    [prev, next] = [next, prev];
    next.fill(0);
  }
  return prev[b.length];
}
export function sourceLocations(
  refs: (Ref | null)[],
  side: Side,
  unitId: string,
): SourceLocation[] {
  const groups: Ref[][] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (!ref || seen.has(ref.char.id)) continue;
    seen.add(ref.char.id);
    const g = groups.at(-1);
    if (
      g &&
      g[0].line.id === ref.line.id &&
      g[0].page.pageIndex === ref.page.pageIndex &&
      g.at(-1)!.char.rawRange[1] === ref.char.rawRange[0]
    )
      g.push(ref);
    else groups.push([ref]);
  }
  return groups.map((g) => {
    const ranges = new Map<
      string,
      NonNullable<SourceLocation["sourceRanges"]>[number]
    >();
    for (const r of g) {
      const source = r.char.sourceRef;
      if (!source) continue;
      const prior = ranges.get(source.itemId);
      if (prior) {
        prior.scalarRange[1] = source.scalarRange[1];
        prior.utf16Range[1] = source.utf16Range[1];
      } else
        ranges.set(source.itemId, {
          ...source,
          scalarRange: [...source.scalarRange],
          utf16Range: [...source.utf16Range],
          itemText: r.page.textItems?.find((i) => i.id === source.itemId)?.text,
        });
    }
    const qs = g.map((r) => r.char.quad),
      quads =
        g[0].char.precision === "run"
          ? [...new Map(qs.map((q) => [JSON.stringify(q), q])).values()]
          : qs;
    return {
      side,
      pageIndex: g[0].page.pageIndex,
      unitId,
      rawRange: [g[0].char.rawRange[0], g.at(-1)!.char.rawRange[1]],
      charIds: g.map((r) => r.char.id),
      text: g.map((r) => r.char.text).join(""),
      quads,
      direction: g[0].line.direction,
      precision: g.some((r) => r.char.precision === "shared_glyph")
        ? "shared_glyph"
        : g[0].char.precision,
      geometryMethod: g[0].char.geometryMethod ?? "native_glyph",
      sourceRanges: [...ranges.values()],
    };
  });
}
