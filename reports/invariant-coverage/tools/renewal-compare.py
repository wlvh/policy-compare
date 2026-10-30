"""Renewal of two trees: product cards, then per-event triage verdicts and accepted cards.
Usage, from the repository root:
  python3 renewal-compare.py <old results dir> <old evidence folder> <new results dir> <new evidence folder>
Results dirs hold <comparison>-<engine>.json as written by full-chain.sh; evidence folders hold renewal/*.events.json."""
import json, collections, sys
OLD, OV, NEW, NV = sys.argv[1:5]
R = 'reports/invariant-coverage'
def ev(path):
    return {e['id']: e for e in json.load(open(path))}
def key(e):
    return (e['verdict'], tuple(sorted(e.get('acceptedCards') or [])), json.dumps(e.get('row'), sort_keys=True), json.dumps(e.get('atomEvidence'), sort_keys=True))
for c in ('aviation_2024_vs_2025', 'bizav_2024_vs_2025'):
    for e in ('mupdf', 'pdfjs'):
        n = f'{c}-{e}'
        old = json.load(open(f'{OLD}/{n}.json')); new = json.load(open(f'{NEW}/{n}.json'))
        oc, nc = old['differences'], new['differences']
        other = sorted(k for k in set(old) | set(new) if k not in ('differences', 'coreVersion') and old.get(k) != new.get(k))
        print(f'## {n}: cards {len(oc)} -> {len(nc)}; cards identical (all fields): {oc == nc}; other fields differing: {other}; coreVersion {old["coreVersion"]} -> {new["coreVersion"]}')
        A = ev(f'{R}/{OV}/renewal/{n}.events.json'); B = ev(f'{R}/{NV}/renewal/{n}.events.json')
        print('  verdicts old', dict(collections.Counter(x['verdict'] for x in A.values())))
        print('  verdicts new', dict(collections.Counter(x['verdict'] for x in B.values())))
        diff = [i for i in A if i not in B or key(A[i]) != key(B[i])]
        print(f'  differing events (verdict, accepted cards, row flags, written-out evidence): {diff}')
        for i in diff:
            print(f'    #{i}: {A[i]["verdict"]} -> {B.get(i, {}).get("verdict")}; accepted {sorted(A[i].get("acceptedCards") or [])} -> {sorted(B.get(i, {}).get("acceptedCards") or [])}')
