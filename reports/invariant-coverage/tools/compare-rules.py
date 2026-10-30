"""Rules and browser-rules reports of two evidence folders: every differing field, commit aside.
Usage, from the repository root: python3 compare-rules.py <old folder name> <new folder name>"""
import json, sys
R = 'reports/invariant-coverage'
old, new = sys.argv[1], sys.argv[2]
def walk(a, b, path, out):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in ('commit', 'codeCommit'): walk(a.get(k), b.get(k), f'{path}.{k}', out)
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)): walk(x, y, f'{path}[{i}]', out)
    elif a != b:
        out.append((path, a, b))
for n in ('rules-mupdf', 'rules-pdfjs', 'browser-rules-mupdf', 'browser-rules-pdfjs'):
    a, b = json.load(open(f'{R}/{old}/{n}.json')), json.load(open(f'{R}/{new}/{n}.json'))
    out = []; walk(a, b, '', out)
    print(f'{n}: {len(out)} field(s) differ from {old} apart from the commit')
    for p, x, y in out:
        rec = eval('b' + p.split('.invariants')[0].replace('.records', "['records']")) if '.records[' in p else None
        where = f" (case {rec['caseId']})" if rec else ''
        print(f'  {p}{where}\n    {old}: {x}\n    {new}: {y}')
