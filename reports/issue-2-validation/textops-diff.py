"""Cards whose text operations differ between two sets of saved comparison results.

usage: python3 reports/issue-2-validation/textops-diff.py OLD_DIR NEW_DIR OUT_MD
Each DIR holds <case>-<engine>.json or .json.gz. A card is matched by its id; the
card's kind, texts, facts and structure path are compared too. For each card
whose operations differ, the changed (non-equal) operations of both versions are
listed. Comparison results are only read, never re-extracted.
"""
import gzip
import json
import os
import sys

CASES = ['aviation_2024_vs_2025', 'bizav_2024_vs_2025']
ENGINES = ['mupdf', 'pdfjs']


def load(directory, name):
    path = os.path.join(directory, name + '.json')
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    with gzip.open(path + '.gz') as f:
        return json.load(f)


def edits(card):
    return [(o['kind'], o['text']) for o in card['textOps'] if o['kind'] != 'equal']


def main(old_dir, new_dir, out):
    lines = [f'# Text operations: `{old_dir}` -> `{new_dir}`', '']
    for case in CASES:
        for engine in ENGINES:
            a, b = load(old_dir, f'{case}-{engine}'), load(new_dir, f'{case}-{engine}')
            cb = {d['id']: d for d in b['differences']}
            key = lambda d: (d['kind'], d['oldText'], d['newText'], d.get('facts'), d['structurePath'])
            same = [d for d in a['differences'] if d['id'] in cb and key(d) == key(cb[d['id']])]
            moved = [d for d in same if d['textOps'] != cb[d['id']]['textOps']]
            lines += [f'## {case} {engine}', '',
                      f'- cards: {len(a["differences"])} -> {len(b["differences"])}; same id, kind, texts, facts and '
                      f'structure path: {len(same)}; operations differ on {len(moved)}', '']
            for d in moved:
                lines.append(f'### `{d["id"]}` ({d["kind"]})')
                for label, card in (('before', d), ('after', cb[d['id']])):
                    shown = '; '.join(f'{k} `{t}`' for k, t in edits(card))
                    lines.append(f'- {label}: {shown[:600]}{" ..." if len(shown) > 600 else ""}')
                lines.append('')
    with open(out, 'w') as f:
        f.write('\n'.join(lines))


if __name__ == '__main__':
    main(*sys.argv[1:])
