# Probe: a card text joined from several occurrences of a repeated header (the pre-0be4819 shape)

Run on the 8c48dac scorer as a temporary test in tests/scorer.test.ts (removed afterwards):

```ts
const lines = (v: (p: number) => string) => docOf([0, 1, 2, 3].flatMap((page) => [{ text: `REPEATED HEADER LIMIT: ${v(page)}`, y: 40, page }, { text: `Body ${page + 1}.`, page }]));
const [left, right] = [lines(() => "USD 1000"), lines((p) => (p === 2 ? "USD 2000" : "USD 1000"))];
const L = [0, 1, 2, 3].map((p) => at(left, "left", "REPEATED HEADER LIMIT: USD 1000", p));
const R = [0, 1, 2, 3].map((p) => at(right, "right", `REPEATED HEADER LIMIT: ${p === 2 ? "USD 2000" : "USD 1000"}`, p));
const joined = { ...card("joined", L, R), occurrences: [0, 1, 2, 3].map((p) => ({ left: [L[p]], right: [R[p]] })), repeat: { left: 4, right: 4, leftPages: 4, rightPages: 4 } };
// graded with no expected events
```

Output:

```
PROBE FAIL ["card joined states occurrence or page counts that differ from the documents' page counts or from the occurrences of its own text it cites","card joined shows its own text on the left side outside the occurrences it counts there","card joined shows its own text on the right side outside the occurrences it counts there"]
```
