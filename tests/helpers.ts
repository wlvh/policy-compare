import {
  VERSION,
  digest,
  type DocInput,
  type Page,
} from "../packages/contracts/index";
export function textDoc(
  lines: {
    text: string;
    x?: number;
    y?: number;
    page?: number;
    direction?: [number, number];
  }[],
): DocInput {
  const hash = digest(lines),
    pages: Page[] = [];
  lines.forEach((l, index) => {
    const pi = l.page ?? 0;
    while (pages.length <= pi)
      pages.push({
        pageIndex: pages.length,
        width: 600,
        height: 850,
        transform: [1, 0, 0, 1, 0, 0],
        inverseTransform: [1, 0, 0, 1, 0, 0],
        chars: [],
        lines: [],
        issues: [],
        coverageState: "text",
      });
    const p = pages[pi],
      y = l.y ?? 150 + index * 24;
    let scalar = p.chars.at(-1)?.rawRange[1] ?? 0;
    const ids: string[] = [];
    Array.from(l.text).forEach((c, i) => {
      const id = hash + ":" + pi + ":" + p.chars.length,
        x = (l.x ?? 40) + i * 6;
      ids.push(id);
      p.chars.push({
        id,
        text: c,
        rawRange: [scalar, ++scalar],
        origin: [x, y],
        quad: [x, y - 10, x + 6, y - 10, x, y + 2, x + 6, y + 2],
        size: 10,
        style: "synthetic",
        precision: "synthetic",
        provenance: "synthetic",
        sharedGeometry: null,
      });
    });
    p.lines.push({
      id: "l" + index,
      charIds: ids,
      direction: l.direction ?? [1, 0],
      writingMode: "horizontal",
      baseline: [l.x ?? 40, y],
      baselineProvenance: "synthetic",
    });
  });
  return {
    schemaVersion: VERSION,
    contentHash: hash,
    extractor: { name: "manual-test-only", version: "1", options: {} },
    coordinateSystem: "display-top-left-pt/ul-ur-ll-lr",
    indexUnit: "unicode-scalar",
    pageCount: pages.length,
    pages,
    diagnostics: [],
  };
}
