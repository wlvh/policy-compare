# The scorer on the four open triage findings' inputs (d5de336 scorer)

Run as a temporary test in tests/scorer.test.ts (removed afterwards), with the `grader`, `card`, `of`,
`op`, `slice` and `at` helpers of that file. Each event is `must_detect`; the answer's runs are the
lines named.

| Input | Scorer |
|---|---|
| Added row `1315 Hull USD 100`; the only card shows `1315 Hull USD 100,000` | FAIL: discovered, not attributed (the amount is not a whole number there) |
| control: the card shows `1315 Hull USD 100` | PASS |
| Removed row, the same two cases | FAIL / PASS |
| Added row `1315 USD 100 USD 100`; the card shows `1315 USD 100` | FAIL: not discovered (the card does not contain the event's whole text) |
| `USD 100 -> USD 200`, runs on both lines; card h changes only `USD -> EUR` on the Hull line, card l only `EUR -> USD` on the Liability line; Replaced or Added+Removed allowed | FAIL: not discovered or attributed (two Replaced cards are never paired; neither card holds both texts) |

A one-character cell (r4416771405) is the same case as the equal cells: the scorer needs the event's
whole text, so an Added row `1315 A USD 100` is not shown by a card `1315 USD 100`.

Output lines:

```
PROBE added row, amount inside USD 100,000 FAIL {"eventId":"E1","branch":"text","verdict":"FAIL","discovery":true,"attribution":false,...}
PROBE added row control PASS {"eventId":"E1","branch":"text","verdict":"PASS","discovery":true,"attribution":true,...}
PROBE removed row, amount inside USD 100,000 FAIL {"eventId":"E1","branch":"text","verdict":"FAIL","discovery":true,"attribution":false,...}
PROBE removed row control PASS {"eventId":"E1","branch":"text","verdict":"PASS","discovery":true,"attribution":true,...}
PROBE added row, two equal cells, one shown FAIL {"eventId":"E1","branch":"text","verdict":"FAIL","discovery":false,"attribution":false,...}
PROBE two currency-only Replaced cards FAIL {"eventId":"E1","branch":"text","verdict":"FAIL","discovery":false,"attribution":false,...}
```
