#!/usr/bin/env python3
"""Summarize saved evidence for human review; does not score or alter product results."""
import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('raw', type=Path)
args = parser.parse_args()
here = Path(__file__).resolve().parent
repo = here.parents[1]
pack = repo / 'validation/synthetic-review-20261030'
read = lambda p: json.loads(p.read_text())
write = lambda p, x: p.write_text(json.dumps(x, ensure_ascii=False, indent=2) + '\n')
layout = read(pack / 'author-layout.json')
manifest = read(pack / 'manifest.json')
run = read(args.raw / 'run-summary.json')
records = []
for record in run['records']:
    case, engine = record['case'], record['engine']
    directory = args.raw / case / engine
    result = read(directory / 'result.json')
    docs = {side: read(directory / (side + '.doc.json')) for side in ['left', 'right']}
    index = {side: {c['id']: (p['pageIndex'], c) for p in doc['pages'] for c in p['chars']}
             for side, doc in docs.items()}

    def origins(side, refs):
        groups = defaultdict(lambda: {'text': '', 'charIds': []})
        seen = set()
        for ref in refs:
            for id_ in ref['charIds']:
                if id_ in seen:
                    continue
                seen.add(id_)
                page, char = index[side][id_]
                if char['provenance'] != 'extracted':
                    continue
                x, y = char['origin']
                matches = []
                for n, item in enumerate(layout[case][side]):
                    a, b, c, d = item['bbox_top_left']
                    # Authored rectangles identify placements, not business identity inferred by product.
                    if item['page'] == page + 1 and a - .1 <= x < c and b <= y <= d:
                        matches.append(n)
                key = tuple(matches)
                groups[key]['text'] += char['text']
                groups[key]['charIds'].append(id_)
        return [{**g, 'authorPlacements': [{'index': n, **layout[case][side][n]} for n in k]}
                for k, g in groups.items()]

    cards = []
    for card in result['differences']:
        cards.append({k: card[k] for k in ['id', 'kind', 'oldText', 'newText', 'structurePath', 'matchEvidence', 'facts']})
        cards[-1]['fullSources'] = {s: origins(s, card[s]) for s in ['left', 'right']}
        cards[-1]['changedOperations'] = [
            {'kind': op['kind'], 'text': op['text'],
             'sources': {s: origins(s, op[s]) for s in ['left', 'right']}}
            for op in card['textOps'] if op['kind'] != 'equal'
        ]
    placements = {}
    for side, doc in docs.items():
        chars = [c for p in doc['pages'] for c in p['chars'] if c['provenance'] == 'extracted']
        placements[side] = []
        for n, item in enumerate(layout[case][side]):
            a, b, c, d = item['bbox_top_left']
            got = ''.join(ch['text'] for page in doc['pages'] if page['pageIndex'] == item['page'] - 1
                          for ch in page['chars'] if ch['provenance'] == 'extracted'
                          and a - .1 <= ch['origin'][0] < c and b <= ch['origin'][1] <= d)
            placements[side].append({'authorIndex': n, 'authored': item['text'], 'extracted': got,
                                     'sameIgnoringWhitespace': ''.join(got.split()) == ''.join(item['text'].split()),
                                     'table': item['table'], 'row': item['row'], 'field': item['field'], 'page': item['page']})
    row = {'case': case, 'engine': engine, 'status': result['status'], 'cards': cards,
           'coverage': result['coverage'],
           'unresolved': [{k: v for k, v in u.items() if k not in ['left', 'right']} for u in result['unresolved']],
           'authorPlacements': placements, 'rawTriage': record['triageSummary']}
    records.append(row)
write(here / 'source-audit.json', records)

lines = ['# 原始输出摘录（仅供人工核对，不自动给结论）', '']
for row in records:
    lines += [f"## {row['case']} / {row['engine']}", '',
              f"处理 `{row['status']}`；{len(row['cards'])} 卡；{len(row['unresolved'])} 未决；"
              f"原分诊 `{row['rawTriage']['verdicts']}`；未解释 {row['rawTriage']['unexplainedCards']}。", '']
    for card in row['cards']:
        lines += [f"- `{card['id']}` / {card['kind']} / `{card['matchEvidence']['method']}` / rowKey `{(card['structurePath'] or {}).get('rowKey')}`",
                  f"  - 旧：{card['oldText'] or '（空）'}", f"  - 新：{card['newText'] or '（空）'}"]
        for op in card['changedOperations']:
            sources = []
            for side, groups in op['sources'].items():
                for group in groups:
                    placements = ';'.join(f"p{p['page']} {p['table']}/{p['row']}/{p['field']} [{p['text']}]" for p in group['authorPlacements'])
                    sources.append(f"{side}:{group['text']} @ {placements or 'unmapped'}")
            lines += [f"  - {op['kind']} `{op['text']}`；" + ' / '.join(sources)]
    lines += ['']
(here / 'raw-cards.md').write_text('\n'.join(lines).rstrip() + '\n')

print('records', len(records))
for row in records:
    mismatches = [v for vs in row['authorPlacements'].values() for v in vs if not v['sameIgnoringWhitespace']]
    if mismatches:
        print(row['case'], row['engine'], 'placement mismatches', len(mismatches),
              [(m['authored'], m['extracted']) for m in mismatches[:4]])
