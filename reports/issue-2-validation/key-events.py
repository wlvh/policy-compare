"""Key-event and page-furniture evidence for issue #2, from existing outputs.

usage: python3 reports/issue-2-validation/key-events.py REPORT_DIR CHANGES_ROOT

Reads, for each pair and engine, the comparison result (<case>-<engine>.json)
and the shared triage's per-event file (<case>-<engine>.events.json, written
by scripts/renewal-triage.py). It does not judge events itself: verdicts are
the triage's. It adds product facts (match method, rowKey, category, pages)
for the issue's key ranges and lists, for the five page-furniture events,
the aggregated cards and any other card that still carries furniture text.
Writes REPORT_DIR/key-events.json and REPORT_DIR/key-events.md.
"""
import json
import os
import re
import sys

KEY = {
    'aviation_2024_vs_2025': [
        ('承保份额', range(36, 44)),
        ('机队新增/退出', [48, 49, 50, 51, 63, 64, 65, 66]),
        ('机队价值重估', range(52, 60)),
        ('机队承租人', [60, 61, 62]),
        ('发动机', range(67, 73)),
        ('合同方', range(73, 80)),
        ('保期与换行/合并残留', [3, 55, 56, 60, 61, 91]),
    ],
    'bizav_2024_vs_2025': [
        ('机队新增/退出', [41, 63]),
        ('机队价值重估', range(43, 52)),
        ('合同方', range(67, 71)),
        ('机库', [71, 72, 73]),
        ('保期与换行/合并残留', [5, 43, 47, 49, 50, 51, 69]),
    ],
}
squash = lambda s: re.sub(r'\s+', '', s or '')


def pages(locs):
    return sorted({l['pageIndex'] + 1 for l in locs})


def main(report, changes_root):
    out, md = {}, ['# 关键事件与页面附属核对', '',
                   '由 `key-events.py` 从比较结果和共同分诊（`scripts/renewal-triage.py`）的逐事件文件生成；',
                   '结论列是分诊脚本的 `verdict`，产品列取自结果卡片。', '']
    for case, groups in KEY.items():
        changes = json.load(open(os.path.join(changes_root, case, 'changes.json'), encoding='utf-8'))['changes']
        for engine in ('mupdf', 'pdfjs'):
            result = json.load(open(os.path.join(report, f'{case}-{engine}.json'), encoding='utf-8'))
            events = {e['id']: e for e in json.load(open(os.path.join(report, f'{case}-{engine}.events.json'), encoding='utf-8'))}
            cards = {d['id']: d for d in result['differences']}
            rows = []
            md += [f'## {case} · {engine}', '',
                   '| 范围 | 作者事件 | 类型 | 结论 | 接受卡片 | 产品对应方式 | 行标识 rowKey | 类别 | 左/右页 | 整行恢复 |',
                   '|---|---|---|---|---|---|---|---|---|---|']
            for name, ids in groups:
                for i in ids:
                    e = events[str(i)]
                    accepted = [cards[c] for c in e.get('acceptedCards', []) if c in cards]
                    row = {
                        'range': name, 'id': i, 'kind': e['kind'], 'verdict': e['verdict'],
                        'atoms': [{k: a.get(k) for k in ('old', 'new', 'state', 'verdict', 'reason', 'category', 'accepted')}
                                  for a in e.get('atomEvidence', [])],
                        'expectedIdentity': (e.get('row') or {}).get('expectedIdentity'),
                        'fullRowRecovered': (e.get('row') or {}).get('fullRowRecovered'),
                        'cards': [{'id': d['id'], 'kind': d['kind'], 'category': d['category'],
                                   'method': d['matchEvidence']['method'],
                                   'rowKey': (d['structurePath'] or {}).get('rowKey'),
                                   'leftPages': pages(d['left']), 'rightPages': pages(d['right']),
                                   'oldText': d['oldText'], 'newText': d['newText']} for d in accepted],
                    }
                    rows.append(row)
                    c = row['cards']
                    md.append('| {} | {} | {} | {} | {} | {} | {} | {} | {} | {} |'.format(
                        name, i, e['kind'], e['verdict'],
                        '<br>'.join(f"`{x['id']}`" for x in c) or '—',
                        '<br>'.join(x['method'] for x in c) or '—',
                        '<br>'.join(x['rowKey'] or '—' for x in c) or '—',
                        '<br>'.join(f"{x['kind']}/{x['category']}" for x in c) or '—',
                        '<br>'.join(f"{x['leftPages']}/{x['rightPages']}" for x in c) or '—',
                        {True: '是', False: '否', None: '—'}[row['fullRowRecovered']]))
            # Page furniture: aggregated cards and leftovers carrying the same text.
            furniture = [d for d in result['differences'] if (d['structurePath'] or {}).get('section') == 'page_furniture']
            fevents = []
            md += ['', '页面附属：', '', '| 作者事件 | 作者原文（旧 → 新） | 聚合卡片 | 类型/类别 | 出现位置数 | 基准/待审页数 | 仍带该原文的其他卡片 |', '|---|---|---|---|---|---|---|']
            for ch in (x for x in changes if x['kind'] == 'Header'):
                texts = [t for t in (squash(ch.get('left_text')), squash(ch.get('right_text'))) if t and 'N' not in t[-3:]]
                if ch['left_text'].startswith('Page n'):
                    hits = [d for d in furniture if re.search(r'Page\d+of\d+', squash(d['oldText'] + d['newText']))]
                    others = [d for d in result['differences'] if d not in furniture and re.search(r'Page\d+of\d+', squash(d['oldText'] + d['newText']))]
                else:
                    hits = [d for d in furniture if any(t in squash(d['oldText'] + d['newText']) for t in texts)]
                    others = [d for d in result['differences'] if d not in furniture and any(t in squash(d['oldText'] + d['newText']) for t in texts)]
                item = {'id': ch['id'], 'left': ch.get('left_text'), 'right': ch.get('right_text'),
                        'cards': [{'id': d['id'], 'kind': d['kind'], 'category': d['category'], 'occurrences': len(d['occurrences']),
                                   'leftPages': len({l['pageIndex'] for o in d['occurrences'] for l in o['left']}),
                                   'rightPages': len({l['pageIndex'] for o in d['occurrences'] for l in o['right']}),
                                   'reviewReasons': d['reviewReasons'], 'oldText': d['oldText'], 'newText': d['newText']} for d in hits],
                        'otherCardsWithText': [{'id': d['id'], 'kind': d['kind'], 'category': d['category'],
                                                'section': (d['structurePath'] or {}).get('section'),
                                                'oldText': d['oldText'][:120], 'newText': d['newText'][:120]} for d in others]}
                fevents.append(item)
                md.append('| {} | {} → {} | {} | {} | {} | {} | {} |'.format(
                    ch['id'], ch.get('left_text') or '（无）', ch.get('right_text') or '（无）',
                    '<br>'.join(f"`{x['id']}`" for x in item['cards']) or '—',
                    '<br>'.join(f"{x['kind']}/{x['category']}" for x in item['cards']) or '—',
                    '<br>'.join(str(x['occurrences']) for x in item['cards']) or '—',
                    '<br>'.join(f"{x['leftPages']}/{x['rightPages']}" for x in item['cards']) or '—',
                    '<br>'.join(f"`{x['id']}` {x['kind']}/{x['category']}（{x['section']}）" for x in item['otherCardsWithText']) or '无'))
            md.append('')
            out[f'{case}-{engine}'] = {'keyEvents': rows, 'pageFurniture': fevents}
    json.dump(out, open(os.path.join(report, 'key-events.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(report, 'key-events.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
