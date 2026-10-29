"""Shows the T4 page check discriminates on real results, not merely stays silent.

usage: python3 page-probe.py OLD_SCRIPT NEW_SCRIPT INPUTS SET=DIR [SET=DIR ...] > page-probe.json
For every event whose accepted card spans several pages on a side, the author's stated pages on
that side are moved to the card's other pages, where the author text is not. Both scripts then
re-triage the result with these changed answers; an old script that only asks "does any source
touch the page" keeps accepting, a page-bound one must not.
"""
import copy, gzip, json, os, subprocess, sys, tempfile
old_script, new_script, inputs, *pairs = sys.argv[1:]
def load(d, n):
    for ext, op in (('.json', open), ('.json.gz', gzip.open)):
        if os.path.exists(f'{d}/{n}{ext}'):
            return json.load(op(f'{d}/{n}{ext}'))
def triage(script, changes, result):
    with tempfile.TemporaryDirectory() as t:
        cp, rp, ep = (os.path.join(t, n) for n in ('c.json', 'r.json', 'e.json'))
        json.dump({'changes': changes}, open(cp, 'w')); json.dump(result, open(rp, 'w'))
        subprocess.run([sys.executable, script, cp, rp, '--events', ep], capture_output=True, check=True)
        return {e['id']: e for e in json.load(open(ep))}
out = []
for name, d in (p.split('=', 1) for p in pairs):
    for case in ('aviation_2024_vs_2025', 'bizav_2024_vs_2025'):
        changes = json.load(open(f'{inputs}/testdata/renewal/{case}/changes.json'))['changes']
        for engine in ('mupdf', 'pdfjs'):
            res = load(d, f'{case}-{engine}')
            cards = {c['id']: c for c in res['differences']}
            ev = triage(new_script, changes, res)
            moved = []
            for c in changes:
                e = ev.get(str(c['id']))
                if not e or e.get('scope') != 'body':
                    continue
                for a in e['atomEvidence']:
                    for cid in a['accepted']:
                        cand = next((x for x in a['candidates'] if x['card'] == cid), None)
                        if cand is None:  # table-row cells keep cellHits, not candidates
                            continue
                        for side in ('left', 'right'):
                            card_pages = {l['pageIndex'] + 1 for l in cards[cid][side]}
                            held = {r['page'] for r in cand[side]}
                            elsewhere = sorted(card_pages - held)
                            if len(card_pages) > 1 and held and elsewhere:
                                moved.append((c['id'], side, elsewhere))
            seen = set()
            for cid, side, pages in moved:
                if (cid, side) in seen:
                    continue
                seen.add((cid, side))
                probe = copy.deepcopy(changes)
                ch = next(x for x in probe if x['id'] == cid)
                ch[f'{side}_pages'] = pages
                old, new = (triage(s, probe, res)[str(cid)] for s in (old_script, new_script))
                out.append({'set': name, 'case': case, 'engine': engine, 'event': cid, 'side': side,
                            'statedPagesMovedTo': pages,
                            'old': {'verdict': old['verdict'], 'acceptedCards': old['acceptedCards']},
                            'new': {'verdict': new['verdict'], 'acceptedCards': new['acceptedCards']}})
summary = {'probes': len(out),
           'oldStillAccepts': sum(1 for x in out if x['old']['acceptedCards']),
           'newStillAccepts': sum(1 for x in out if x['new']['acceptedCards'])}
json.dump({'summary': summary, 'probes': out}, sys.stdout, indent=1)
print()
