import { describe, it, expect } from "vitest";
import {
  quantize,
  scalarOffsets,
  canonical,
} from "../packages/contracts/index";
import { normalize, tokenize, lcsLength } from "../packages/compare-core/text";
describe("scalar and normalization contract", () => {
  it("retains scalar offsets, combining sources and shared ligature mapping", () => {
    expect(scalarOffsets("A😀e\u0301")).toEqual([0, 1, 3, 4, 5]);
    const x = normalize("ﬁe\u0301😀", []);
    expect(x.matchText).toBe("fié😀");
    expect(x.mapping).toEqual([[0], [0], [1, 2], [3]]);
  });
  it("quantizes symmetrically and rejects nonfinite values", () => {
    expect(quantize(-1.2345)).toBe(-1.235);
    expect(Object.is(quantize(-0), -0)).toBe(false);
    expect(() => quantize(Infinity)).toThrow();
  });
  it("orders canonical output independent of object insertion", () => {
    expect(canonical({ z: 1, a: 2 })).toBe(canonical({ a: 2, z: 1 }));
  });
  it("excludes whitespace from matching score but retains symbols", () => {
    const a = tokenize("a b c d e f g h i j"),
      b = tokenize("a b c d e f g h i k");
    expect((2 * lcsLength(a, b)) / (a.length + b.length)).toBe(0.9);
    expect(tokenize("1.5% ± ☑")).toEqual(["1.5", "%", "±", "☑"]);
  });
});
