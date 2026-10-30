import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { compare } from "../packages/compare-core/index";
import { textDoc } from "./helpers";
it("product modules never import rule answers or case-specific identifiers", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
      x.isDirectory()
        ? x.name === "node_modules"
          ? []
          : walk(dir + "/" + x.name)
        : [dir + "/" + x.name],
    );
  for (const file of ["apps", "packages", "profiles", "engines"]
    .flatMap(walk)
    .filter((p) => /\.(ts|tsx)$/.test(p)))
    expect(readFileSync(file, "utf8")).not.toMatch(
      /expected\.json|source\.json|layout\.json|R(?:0[1-9]|[12][0-9]|3[0-2])_|validation\/dataset/,
    );
});
it("mixed extraction engines are rejected by the shared core", () => {
  const a = textDoc([{ text: "USD 100" }]),
    b = textDoc([{ text: "USD 200" }]);
  b.extractor.name = "other-engine";
  expect(() => compare(a, b)).toThrow("同一引擎");
});
