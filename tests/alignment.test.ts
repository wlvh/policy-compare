import { it, expect } from "vitest";
import { jointAlign, monotone } from "../packages/compare-core/alignment";
import { compare } from "../packages/compare-core/index";
import { textDoc } from "./helpers";
it("joint alignment chooses split jointly instead of consuming its first part", () => {
  const a = ["ab cd", "ef"],
    b = ["ab", "cd", "ef"];
  const pairs = jointAlign(
    a,
    b,
    (a, b) => (a.join(" ") === b.join(" ") ? 1 : a[0] === b[0] ? 0.7 : null),
    () => true,
  );
  expect(pairs[0].b).toEqual(["ab", "cd"]);
  expect(pairs[1].a).toEqual(["ef"]);
});
it("weighted monotone anchors exclude crossing links and equal coordinates", () => {
  const x = [
    { l: 1, r: 3, w: 1 },
    { l: 2, r: 1, w: 3 },
    { l: 3, r: 2, w: 3 },
    { l: 3, r: 4, w: 1 },
  ];
  expect(
    monotone(
      x,
      (x) => x.l,
      (x) => x.r,
      (x) => x.w,
    ),
  ).toEqual([x[1], x[2]]);
});
it("a cross-chapter move with one word changed preserves internal text edits", () => {
  const old =
    "The insurer shall pay all approved losses under this contract for operations in all declared regions during the stated period.";
  const next = old.replace("approved", "covered");
  const left = textDoc([
    { text: "SECTION A" },
    { text: "PAYMENT" },
    { text: old },
    { text: "SECTION B" },
    { text: "Separate unrelated coverage terms apply." },
  ]);
  const right = textDoc([
    { text: "SECTION A" },
    { text: "SECTION B" },
    { text: "Separate unrelated coverage terms apply." },
    { text: "PAYMENT" },
    { text: next },
  ]);
  const r = compare(left, right);
  expect(
    r.differences.some(
      (d) =>
        d.kind === "Moved" &&
        d.hasTextChange &&
        d.oldText === old &&
        d.newText === next,
    ),
  ).toBe(true);
});
it("repeated originals with distinct headings do not match across context", () => {
  const make = (first: string) =>
    textDoc([
      { text: "ALPHA" },
      { text: first },
      { text: "BETA" },
      { text: "The insurer covers all approved operations worldwide." },
    ]);
  const r = compare(
    make("The insurer covers all approved operations worldwide."),
    make("The insurer covers all approved operations domestically."),
  );
  expect(r.differences.filter((d) => d.hasTextChange)).toHaveLength(1);
  expect(r.differences[0].kind).toBe("Replaced");
});
