"""Synthetic changes/result counterexamples for scripts/renewal-triage.py.

Run: python3 -m unittest discover -s tests -p 'test_renewal_triage.py'
"""
import contextlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, 'scripts', 'renewal-triage.py')
spec = importlib.util.spec_from_file_location('renewal_triage', SCRIPT)
triage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(triage)


def loc(side, page, unit, text, start=0):
    return {'side': side, 'pageIndex': page - 1, 'unitId': unit, 'rawRange': [start, start + len(text)],
            'charIds': ['c'], 'text': text, 'quads': [[0, 0, 1, 0, 0, 1, 1, 1]], 'direction': [1, 0],
            'precision': 'native'}


def placed(cells):
    """(page, unit, text) cells in reading order with their raw start in the unit: the cells of one
    unit follow each other with one raw space between, as a source unit reads."""
    at, out = {}, []
    for page, unit, text in cells:
        start = at.get((page, unit), 0)
        out.append((page, unit, text, start))
        at[(page, unit)] = start + len(text) + 1
    return out


def ops(left, right):
    """Text operations as the product reports them: the common prefix and suffix are equal, the rest
    is deleted and inserted, and each part keeps the source units and raw positions its characters
    come from."""
    def chars(cells):
        out = []
        for i, (page, unit, text, start) in enumerate(placed(cells)):
            out += ([(' ', (page, unit, start - 1))] if i else []) + [(c, (page, unit, start + k)) for k, c in enumerate(text)]
        return out

    def locs(side, part):
        out = []
        for c, (page, unit, at) in part:
            if c == ' ':
                continue
            if out and (out[-1]['pageIndex'] + 1, out[-1]['unitId']) == (page, unit) and out[-1]['rawRange'][1] == at:
                out[-1] = loc(side, page, unit, out[-1]['text'] + c, out[-1]['rawRange'][0])
            else:
                out.append(loc(side, page, unit, c, at))
        return out
    a, b = chars(left), chars(right)
    p = 0
    while p < min(len(a), len(b)) and a[p][0] == b[p][0]:
        p += 1
    s = 0
    while s < min(len(a), len(b)) - p and a[-1 - s][0] == b[-1 - s][0]:
        s += 1
    parts = [('equal', a[:p], b[:p]), ('delete', a[p:len(a) - s], []), ('insert', [], b[p:len(b) - s]),
             ('equal', a[len(a) - s:], b[len(b) - s:])]
    return [{'kind': k, 'text': ''.join(c for c, _ in (l or r)), 'left': locs('left', l), 'right': locs('right', r)}
            for k, l, r in parts if l or r]


def card(id, kind, left=(), right=(), row_key=None, table=None, confidence='candidate', facts=()):
    """left/right: (page, unitId, text) cells in reading order. A result-format-2 card."""
    old, new = ' '.join(c[2] for c in left), ' '.join(c[2] for c in right)
    return {'id': id, 'kind': kind, 'facts': list(facts),
            'structurePath': {'section': 'clauses', 'entity': None, 'field': None, 'table': table,
                              'rowKey': row_key, 'confidence': confidence},
            'left': [loc('left', *c) for c in placed(left)], 'right': [loc('right', *c) for c in placed(right)],
            'oldText': old, 'newText': new, 'hasTextChange': old != new, 'textOps': ops(left, right)}


def shown(id, kind, side, text, cuts, page=11, unit='u1'):
    """A one-sided card whose own text is `text`, its source locations cut at raw offsets `cuts` of
    one unit: ranges that meet are together or apart exactly as the card's text shows them."""
    locs = [loc(side, page, unit, text[a:b], a) for a, b in zip(cuts, cuts[1:] + [len(text)])]
    d = card(id, kind)
    d[side], d['oldText' if side == 'left' else 'newText'], d['hasTextChange'] = locs, text, True
    d['textOps'] = [{'kind': 'delete' if side == 'left' else 'insert', 'text': text,
                     'left': locs if side == 'left' else [], 'right': locs if side == 'right' else []}]
    return d


def group(left=(), right=()):
    return {'reason': 'ambiguous_match', 'message': 'm', 'defaultVisible': True,
            'left': [loc('left', *c) for c in placed(left)], 'right': [loc('right', *c) for c in placed(right)]}


def result(diffs, unresolved=()):
    return {'status': 'complete_for_scope', 'coreVersion': 'test', 'extractors': [{'version': 't'}] * 2,
            'differences': list(diffs), 'unresolved': list(unresolved)}


def change(id, block, kind, left='', right='', edits=(), pages=(1, 1), category='Material'):
    return {'id': id, 'block': block, 'kind': kind, 'category': category, 'notes': [''],
            'edits': [{'old': e[0], 'new': e[1], **({'category': e[2]} if len(e) > 2 else {})} for e in edits],
            'left_text': left, 'right_text': right,
            'left_pages': [pages[0]] if pages[0] else [], 'right_pages': [pages[1]] if pages[1] else []}


def run(changes, res, tables=None, digest=None):
    """tables: declared identity tables ({'table', 'identity', 'events'}) for these changes."""
    with tempfile.TemporaryDirectory() as d:
        cp, rp, ep, ip = (os.path.join(d, n) for n in ('changes.json', 'result.json', 'events.json', 'identity.json'))
        with open(cp, 'w') as f:
            json.dump({'changes': changes}, f)
        with open(rp, 'w') as f:
            json.dump(res, f)
        with open(ip, 'w') as f:
            json.dump({'version': 'test', 'pairs': [{'pair': 'test', 'changes_sha256': digest or triage.sha256(cp),
                                                     'tables': tables or []}]}, f)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            triage.main(cp, rp, ep, ip)
        with open(ep) as f:
            events = json.load(f)
    return json.loads(out.getvalue()), {e['id']: e for e in events}


def table(name, identity, *events):
    return {'table': name, 'identity': list(identity), 'events': [e['id'] for e in events]}


ROW_1315 = ('ATR 72-600 | 1315 | CS-BTE | 2012 | 20,490,000 | Cobalt',
            'ATR 72-600 | 1315 | CS-BTE | 2012 | 19,210,000 | Cobalt')
VALUE = [('20,490,000', '19,210,000')]


def row_card(id, msn, reg, old='20,490,000', new='19,210,000', row_key=None, units=('a', 'b')):
    cells = lambda v: [(11, units[0], 'ATR 72-600'), (11, units[0], msn), (11, units[0], reg), (11, units[0], v)]
    right = [(11, units[1], t) for _, _, t in cells(new)]
    return card(id, 'Replaced', cells(old), right, row_key=row_key, table='recovered_rows')


AIRCRAFT = (1, 2)  # MSN and registration cells of the author rows below


class RecordIdentity(unittest.TestCase):
    """Round 8: row identity comes only from the acceptance-side declaration."""
    def test_identity_comes_from_the_declaration_only(self):
        c = change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE)
        declared = {'52': {'table': 'aircraft', 'identity': list(AIRCRAFT)}}
        ident = triage.expected_identity(c, declared)
        self.assertEqual((ident['cells'], ident['source'], ident['table']), (['1315', 'CS-BTE'], 'declared', 'aircraft'))
        # Per side: an identifier that changes is the left value on the left, the right value on the right.
        c = change(21, 'avn111', 'Replaced', 'AVN111 | Sanctions Clause', 'AVN111A | Sanctions Clause')
        ident = triage.expected_identity(c, {'21': {'table': 'clauses', 'identity': [0]}})
        self.assertEqual((ident['left'], ident['right']), (['AVN111'], ['AVN111A']))
        # Neither the block id nor a name-like cell is identity without a declaration.
        for declared in (None, {}, {'52': {'table': 'rates', 'identity': []}}):
            ident = triage.expected_identity(change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE), declared)
            self.assertEqual((ident['cells'], ident['source']), ([], None))
        self.assertIsNone(triage.expected_identity(change(1, 'premium', 'Replaced', 'USD 1', 'USD 2')))

    def test_an_undeclared_row_is_not_evaluated_even_on_the_right_card(self):
        right = row_card('r', '1315', 'CS-BTE', row_key='1315')
        c = change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11))
        summary, ev = run([c], result([right]))
        self.assertEqual((ev['52']['verdict'], ev['52']['atoms']), ('not_evaluable', ['same_card_identity_unconfirmed']))
        self.assertEqual(summary['tableRowEvents']['noDeclaredIdentity'], ['52'])
        _, ev = run([c], result([right]), [table('aircraft', AIRCRAFT, c)])
        self.assertEqual(ev['52']['verdict'], 'correct')
        # A declaration bound to another changes file is not used.
        summary, ev = run([c], result([right]), [table('aircraft', AIRCRAFT, c)], digest='0' * 64)
        self.assertEqual(ev['52']['verdict'], 'not_evaluable')
        self.assertIsNone(summary['inputs']['identity']['pair'])

    def test_a_declared_composite_identity_needs_every_cell(self):
        # One aircraft has two parties: the record is the MSN with its party.
        c = change(77, 'cp_1351', 'Replaced', '1351 | Ostra Export | Lender | AVN67B', '1351 | Ostra Export | Lender | AVN67C',
                   [('AVN67B', 'AVN67C')], pages=(15, 15))
        other = change(78, 'cp_1351_b', 'Replaced', '1351 | Northfield Bank | Lessor | AVN67B',
                       '1351 | Northfield Bank | Lessor | AVN67B', [], pages=(15, 15))
        parties = [table('parties', [0, 1], c, other)]
        wrong = card('w', 'Replaced', [(15, 'a', '1351 Northfield Bank Lessor AVN67B')],
                     [(15, 'b', '1351 Northfield Bank Lessor AVN67C')])
        _, ev = run([c, other], result([wrong]), parties)
        self.assertEqual(ev['77']['verdict'], 'misattributed')
        right = card('r', 'Replaced', [(15, 'a', '1351 Ostra Export Lender AVN67B')], [(15, 'b', '1351 Ostra Export Lender AVN67C')])
        _, ev = run([c, other], result([right]), parties)
        self.assertEqual(ev['77']['verdict'], 'correct')

    def test_unchanged_value_cells_do_not_confirm_a_row(self):
        c = change(1, 'wl_x', 'Replaced', '15.0% | 03/10/2024 | MKV 1426 | 24AV0381',
                   '15.0% | 03/10/2024 | MKV 1426 | 25AV0412', [('24AV0381', '25AV0412')], pages=(8, 8))
        wrong = card('w', 'Replaced', [(8, 'a', '15.0% 03/10/2024 HPX 0624 24AV0381')],
                     [(8, 'b', '15.0% 03/10/2024 HPX 0624 25AV0412')])
        summary, ev = run([c], result([wrong]), [table('lines', [2], c)])
        self.assertNotEqual(ev['1']['verdict'], 'correct')
        self.assertEqual(ev['1']['atoms'], ['same_card_identity_unconfirmed'])

    def test_correct_amount_on_the_wrong_record_is_misattributed(self):
        events = [change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11)),
                  change(48, 'ac_1760', 'Removed', 'ATR 72-600 | 1760 | ZK-ENV | 2013', pages=(11, 0))]
        by_key = row_card('k', '1760', 'ZK-ENV', row_key='1760')
        _, ev = run(events[:1], result([by_key]), [table('aircraft', AIRCRAFT, *events[:1])])
        self.assertEqual(ev['52']['verdict'], 'misattributed')
        # Without a rowKey, another record's identity in the same unit is the contradiction.
        by_unit = row_card('u', '1760', 'ZK-ENV')
        _, ev = run(events, result([by_unit]), [table('aircraft', AIRCRAFT, *events)])
        self.assertEqual(ev['52']['verdict'], 'misattributed')
        self.assertEqual(ev['52']['acceptedCards'], [])
        # The removed row 1760 shown as a modified row is not its removal either.
        self.assertEqual(ev['48']['verdict'], 'misattributed')
        self.assertEqual(ev['48']['acceptedCards'], [])

    def test_one_correct_card_plus_a_misattributed_one_is_not_complete(self):
        good, bad = row_card('g', '1315', 'CS-BTE', row_key='1315'), row_card('x', '1760', 'ZK-ENV', row_key='1760')
        c = change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11))
        summary, ev = run([c], result([good, bad]), [table('aircraft', AIRCRAFT, c)])
        self.assertEqual(ev['52']['verdict'], 'misattributed')
        self.assertEqual(ev['52']['atoms'], ['same_card_plus_misattributed'])
        self.assertEqual(ev['52']['outcome'], 'incomplete')
        self.assertEqual(ev['52']['acceptedCards'], ['g'])
        # The rejected candidate is not hidden from the unexplained cards.
        self.assertEqual((summary['unexplainedCards'], summary['unexplainedCandidateCards']), (1, 1))

    def test_rows_sharing_the_same_values_each_keep_their_own_card(self):
        row_1760 = ('ATR 72-600 | 1760 | ZK-ENV | 2013 | 20,490,000 | Tasman',
                    'ATR 72-600 | 1760 | ZK-ENV | 2013 | 19,210,000 | Tasman')
        events = [change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11)),
                  change(53, 'ac_1760', 'Replaced', *row_1760, VALUE, pages=(11, 11))]
        cards = [row_card('a', '1315', 'CS-BTE', row_key='1315'),
                 row_card('b', '1760', 'ZK-ENV', row_key='1760', units=('c', 'd'))]
        summary, ev = run(events, result(cards), [table('aircraft', AIRCRAFT, *events)])
        self.assertEqual((ev['52']['verdict'], ev['53']['verdict']), ('correct', 'correct'))
        self.assertEqual((ev['52']['acceptedCards'], ev['53']['acceptedCards']), (['a'], ['b']))
        self.assertEqual(summary['unexplainedCards'], 0)

    def test_value_correct_and_full_row_are_reported_separately(self):
        partial = card('p', 'Replaced', [(11, 'a', '1315 CS-BTE 20,490,000')], [(11, 'b', '1315 CS-BTE 19,210,000')])
        c = change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11))
        summary, ev = run([c], result([partial]), [table('aircraft', AIRCRAFT, c)])
        self.assertEqual(ev['52']['verdict'], 'correct')
        self.assertFalse(ev['52']['row']['fullRowRecovered'])
        self.assertEqual(summary['tableRowEvents']['changeCorrectlyAttributed'], ['52'])
        self.assertEqual(summary['tableRowEvents']['fullRowRecovered'], [])

    # Review of PR #11 (fixed in #9): the completeness check reads the full
    # source text of the accepted record unit, not its 80-character preview,
    # and never the other units of the card.
    LONG = ('ATR 72-600 | 1315 | Kestrel Regional Airways Holdings Limited (Operator and Lessee) | 20,490,000',
            'ATR 72-600 | 1315 | Kestrel Regional Airways Holdings Limited (Operator and Lessee) | 19,210,000')

    def test_a_long_row_in_one_source_unit_is_full(self):
        row = lambda v: 'ATR 72-600 1315 Kestrel Regional Airways Holdings Limited (Operator and Lessee) ' + v
        self.assertGreater(len(row('20,490,000')), 80)
        whole = card('w', 'Replaced', [(11, 'a', row('20,490,000'))], [(11, 'b', row('19,210,000'))])
        c = change(52, 'ac_1315', 'Replaced', *self.LONG, VALUE, pages=(11, 11))
        _, ev = run([c], result([whole]), [table('aircraft', [1], c)])
        self.assertEqual(ev['52']['verdict'], 'correct')
        self.assertTrue(ev['52']['row']['fullRowRecovered'])

    def test_an_identity_after_the_preview_is_on_the_record(self):
        # Review r4415969212: the primary identity metric read the 80-character
        # previews and missed an MSN printed after a long operator name.
        name = 'Kestrel Regional Airways Holdings Limited (Operator, Lessee and Manager)'
        row = lambda v: f'{name} ATR 72-600 1315 {v}'
        self.assertGreater(row('').index('1315'), 80)
        whole = card('w', 'Replaced', [(11, 'a', row('20,490,000'))], [(11, 'b', row('19,210,000'))])
        c = change(52, 'ac_1315', 'Replaced', f'{name} | ATR 72-600 | 1315 | 20,490,000',
                   f'{name} | ATR 72-600 | 1315 | 19,210,000', VALUE, pages=(11, 11))
        summary, ev = run([c], result([whole]), [table('aircraft', [2], c)])
        self.assertEqual(ev['52']['verdict'], 'correct')
        self.assertTrue(ev['52']['row']['primaryIdentityOnRecord'])
        self.assertEqual(summary['tableRowEvents']['acceptedWithoutPrimaryIdentity'], [])
        added = card('n', 'Added', right=[(11, 'b', row('19,210,000'))])
        c = change(63, 'ac_1315', 'Added', '', f'{name} | ATR 72-600 | 1315 | 19,210,000', pages=(0, 11))
        summary, ev = run([c], result([added]), [table('aircraft', [2], c)])
        self.assertEqual(ev['63']['verdict'], 'correct')
        self.assertTrue(ev['63']['row']['primaryIdentityOnRecord'])

    def test_a_replaced_row_needs_each_cell_once_for_the_full_row(self):
        """r4417329496: two author cells USD 100 are not both recovered from one."""
        c = change(52, 'ac_1315', 'Replaced', '1315 | USD 100 | USD 100 | Alpha', '1315 | USD 200 | USD 200 | Alpha',
                   [('USD 100', 'USD 200')], pages=(11, 11))
        short = card('s', 'Replaced', [(11, 'a', '1315 USD 100 Alpha')], [(11, 'b', '1315 USD 200 Alpha')])
        _, ev = run([c], result([short]), [table('aircraft', [0], c)])
        self.assertFalse(ev['52']['row']['fullRowRecovered'])
        whole = card('w', 'Replaced', [(11, 'a', '1315 USD 100 USD 100 Alpha')], [(11, 'b', '1315 USD 200 USD 200 Alpha')])
        _, ev = run([c], result([whole]), [table('aircraft', [0], c)])
        self.assertTrue(ev['52']['row']['fullRowRecovered'])

    def test_a_replaced_value_does_not_match_a_signed_value(self):
        """r4417560178: the edit 100 -> 200 is not -100 -> -200."""
        c = change(72, 'ac_1315', 'Replaced', '1315 | Hull | 100', '1315 | Hull | 200', [('100', '200')], pages=(11, 11))
        signed = card('s', 'Replaced', [(11, 'a', '1315 Hull -100')], [(11, 'b', '1315 Hull -200')])
        _, ev = run([c], result([signed]), [table('aircraft', [0], c)])
        self.assertNotEqual(ev['72']['verdict'], 'correct')
        # Controls: the unsigned value, and a hyphen after a letter, which is no sign.
        for old, new in (('1315 Hull 100', '1315 Hull 200'), ('1315 Hull-100', '1315 Hull-200')):
            plain = card('p', 'Replaced', [(11, 'a', old)], [(11, 'b', new)])
            _, ev = run([c], result([plain]), [table('aircraft', [0], c)])
            self.assertEqual(ev['72']['verdict'], 'correct', old)

    def test_the_full_row_reads_only_the_records_identity_units(self):
        """#11 comment 6508818754: Alpha of record 1760 does not complete record 1315."""
        c = change(74, 'ac_1315', 'Replaced', '1315 | Alpha | USD 100', '1315 | Alpha | USD 200',
                   [('USD 100', 'USD 200')], pages=(11, 11))
        two = card('t', 'Replaced', [(11, 'a', '1315 Hull USD 100'), (11, 'b', '1760 Alpha USD 100')],
                   [(11, 'c', '1315 Hull USD 200'), (11, 'd', '1760 Alpha USD 200')])
        _, ev = run([c], result([two]), [table('aircraft', [0], c)])
        self.assertEqual(ev['74']['verdict'], 'correct')
        self.assertFalse(ev['74']['row']['fullRowRecovered'])
        # Control: the record's own unit holds every cell.
        own = card('o', 'Replaced', [(11, 'a', '1315 Alpha USD 100')], [(11, 'c', '1315 Alpha USD 200')])
        _, ev = run([c], result([own]), [table('aircraft', [0], c)])
        self.assertEqual((ev['74']['verdict'], ev['74']['row']['fullRowRecovered']), ('correct', True))

    def test_a_split_row_is_full_from_its_two_cards(self):
        """PR #11 comment 6511266424: the full row reads the old side on the Removed card and the new
        side on the Added card."""
        c = change(75, 'ac_1315', 'Replaced', '1315 | Hull | USD 100', '1315 | Hull | USD 200', [('USD 100', 'USD 200')],
                   pages=(11, 11))
        removed = card('o', 'Removed', [(11, 'a', '1315 Hull USD 100')])
        _, ev = run([c], result([removed, card('n', 'Added', right=[(11, 'b', '1315 Hull USD 200')])]), [table('aircraft', [0], c)])
        self.assertEqual((ev['75']['verdict'], ev['75']['row']['fullRowRecovered']), ('split_attributable', True))
        # Control: the Added card misses Hull.
        _, ev = run([c], result([removed, card('n', 'Added', right=[(11, 'b', '1315 USD 200')])]), [table('aircraft', [0], c)])
        self.assertFalse(ev['75']['row']['fullRowRecovered'])

    def test_a_split_row_reads_only_the_units_where_its_identity_was_confirmed(self):
        """PR #11 comment 6511895761: on a split too, Alpha of record 1760 does not complete record 1315."""
        c = change(76, 'ac_1315', 'Replaced', '1315 | Alpha | USD 100', '1315 | Alpha | USD 200',
                   [('USD 100', 'USD 200')], pages=(11, 11))
        removed = card('o', 'Removed', [(11, 'a', '1315 Hull USD 100'), (11, 'b', '1760 Alpha USD 100')])
        added = card('n', 'Added', right=[(11, 'c', '1315 Hull USD 200'), (11, 'd', '1760 Alpha USD 200')])
        _, ev = run([c], result([removed, added]), [table('aircraft', [0], c)])
        self.assertEqual(ev['76']['verdict'], 'split_attributable')
        self.assertFalse(ev['76']['row']['fullRowRecovered'])
        self.assertEqual([[r['unitId'] for r in ev['76']['row']['acceptedRecord'][s]] for s in ('left', 'right')], [['a'], ['c']])
        # Control: the record's own units hold every cell.
        own = [card('o', 'Removed', [(11, 'a', '1315 Alpha USD 100')]), card('n', 'Added', right=[(11, 'c', '1315 Alpha USD 200')])]
        _, ev = run([c], result(own), [table('aircraft', [0], c)])
        self.assertEqual((ev['76']['verdict'], ev['76']['row']['fullRowRecovered']), ('split_attributable', True))

    def test_a_cell_only_in_another_unit_of_the_card_does_not_complete_the_row(self):
        name = 'Kestrel Regional Airways Holdings Limited (Operator and Lessee)'
        split = card('s', 'Replaced', [(11, 'a', 'ATR 72-600 1315 20,490,000'), (11, 'c', name)],
                     [(11, 'b', 'ATR 72-600 1315 19,210,000'), (11, 'd', name)])
        c = change(52, 'ac_1315', 'Replaced', *self.LONG, VALUE, pages=(11, 11))
        _, ev = run([c], result([split]), [table('aircraft', [1], c)])
        self.assertEqual(ev['52']['verdict'], 'correct')
        self.assertFalse(ev['52']['row']['fullRowRecovered'])
        self.assertEqual([r['unitId'] for r in ev['52']['row']['acceptedRecord']['left']], ['a'])


class MovedIsNotAddedOrRemoved(unittest.TestCase):
    """Review of PR #11 (fixed in #9): a card that keeps the text on both sides,
    such as an unchanged move, neither adds nor removes it."""
    TEXT = 'Proof of Loss: The Insured shall provide Underwriters with complete documentation.'

    def test_unchanged_move_is_not_a_removal(self):
        moved = card('m', 'Moved', [(4, 'a', self.TEXT)], [(5, 'b', self.TEXT)])
        summary, ev = run([change(30, 'pol', 'Removed', left=self.TEXT, pages=(4, 0))], result([moved]))
        self.assertNotEqual(ev['30']['verdict'], 'correct')
        self.assertEqual(ev['30']['acceptedCards'], [])
        self.assertEqual((summary['acceptedCards'], summary['unexplainedCards']), (0, 1))

    def test_unchanged_move_is_not_an_addition(self):
        moved = card('m', 'Moved', [(4, 'a', self.TEXT)], [(5, 'b', self.TEXT)])
        summary, ev = run([change(31, 'pol', 'Added', right=self.TEXT, pages=(0, 5))], result([moved]))
        self.assertNotEqual(ev['31']['verdict'], 'correct')
        self.assertEqual(ev['31']['acceptedCards'], [])
        self.assertEqual((summary['acceptedCards'], summary['unexplainedCards']), (0, 1))

    def test_real_removal_and_addition_are_still_accepted(self):
        removed = card('r', 'Removed', [(4, 'a', self.TEXT)])
        added = card('n', 'Added', right=[(5, 'b', self.TEXT)])
        summary, ev = run([change(30, 'pol', 'Removed', left=self.TEXT, pages=(4, 0)),
                           change(31, 'pol', 'Added', right=self.TEXT, pages=(0, 5))], result([removed, added]))
        self.assertEqual((ev['30']['verdict'], ev['30']['acceptedCards']), ('correct', ['r']))
        self.assertEqual((ev['31']['verdict'], ev['31']['acceptedCards']), ('correct', ['n']))
        self.assertEqual(summary['unexplainedCards'], 0)

    def test_text_removed_inside_a_replaced_card_is_still_a_removal(self):
        rewritten = card('w', 'Replaced', [(4, 'a', 'Claims. ' + self.TEXT)], [(4, 'b', 'Claims.')])
        _, ev = run([change(30, 'pol', 'Removed', left=self.TEXT, pages=(4, 0))], result([rewritten]))
        self.assertEqual((ev['30']['verdict'], ev['30']['acceptedCards']), ('correct', ['w']))


class ReplacementNeedsTheEdit(unittest.TestCase):
    """Review of PR #11 (fixed in #9): a Replaced or Moved-with-edit atom is accepted only on cards
    whose text operations change that very fragment, in the unit that holds it. Holding the old text
    on the left and the new text on the right is not enough, on one card or on two."""
    PARA = 'Hull USD 100; liability USD 200.'
    EDIT = change(40, 'hull', 'Replaced', 'Hull USD 100 applies.', 'Hull USD 200 applies.', [('USD 100', 'USD 200')])
    ROW = change(41, 'ac_1315', 'Replaced', 'ATR 72-600 | 1315 | USD 100', 'ATR 72-600 | 1315 | USD 200',
                 [('USD 100', 'USD 200')])

    def test_cards_without_the_edit_are_not_accepted(self):
        unchanged = {
            'same card, unchanged move': ([self.EDIT], [card('m', 'Moved', [(1, 'a', self.PARA)], [(1, 'b', self.PARA)])]),
            'same card, called Replaced': ([self.EDIT], [card('m', 'Replaced', [(1, 'a', self.PARA)],
                                                               [(1, 'b', self.PARA)])]),
            'same card, right record': ([self.ROW], [card('m', 'Moved', [(1, 'a', '1315 ' + self.PARA)],
                                                          [(1, 'b', '1315 ' + self.PARA)], row_key='1315')]),
            'same card, only another unit changed': ([self.EDIT], [card(
                'm', 'Replaced', [(1, 'a', self.PARA), (1, 'c', 'Deductible USD 5,000')],
                [(1, 'b', self.PARA), (1, 'd', 'Deductible USD 7,500')])]),
            'split, two unchanged moves': ([self.EDIT], [
                card('o', 'Moved', [(1, 'a', 'Hull USD 100 applies.')], [(1, 'b', 'Hull USD 100 applies.')]),
                card('n', 'Moved', [(1, 'c', 'Hull USD 200 applies.')], [(1, 'd', 'Hull USD 200 applies.')])]),
        }
        for name, (events, cards) in unchanged.items():
            with self.subTest(name):
                summary, ev = run(events, result(cards), [table('aircraft', [1], self.ROW)])
                e = ev[str(events[0]['id'])]
                self.assertNotIn(e['verdict'], ('correct', 'split_attributable'))
                self.assertEqual(e['acceptedCards'], [])
                self.assertEqual((summary['acceptedCards'], summary['unexplainedCards']), (0, len(cards)))

    def test_cards_with_the_edit_are_still_accepted(self):
        moved = change(42, 'pol', 'Moved', self.PARA, self.PARA, pages=(1, 2))
        insert = change(43, 'pay', 'Replaced', 'The insurer pays approved losses.',
                        'The insurer pays approved covered losses.', [('approved losses', 'approved covered losses')])
        edited = {
            # The old value still appears elsewhere on the right after a real replacement.
            'same card, old value kept elsewhere': (self.EDIT, [card(
                'r', 'Replaced', [(1, 'a', 'Hull USD 100 applies. Liability USD 100.')],
                [(1, 'b', 'Hull USD 200 applies. Liability USD 100.')])], 'correct', ['r']),
            'same card, right record': (self.ROW, [card('r', 'Replaced', [(1, 'a', 'ATR 72-600 1315 USD 100')],
                                                        [(1, 'b', 'ATR 72-600 1315 USD 200')], row_key='1315')],
                                        'correct', ['r']),
            'split, removed and added': (self.EDIT, [card('o', 'Removed', [(1, 'a', 'Hull USD 100 applies.')]),
                                                     card('n', 'Added', right=[(1, 'b', 'Hull USD 200 applies.')])],
                                         'split_attributable', ['n', 'o']),
            # An author move without an edit is still met by the unchanged move on the stated pages.
            'author move, unchanged move': (moved, [card('m', 'Moved', [(1, 'a', self.PARA)], [(2, 'b', self.PARA)])], 'correct', ['m']),
            'insertion only': (insert, [card('i', 'Replaced', [(1, 'a', 'The insurer pays approved losses.')],
                                             [(1, 'b', 'The insurer pays approved covered losses.')])], 'correct', ['i']),
        }
        for name, (event, cards, verdict, accepted) in edited.items():
            with self.subTest(name):
                summary, ev = run([event], result(cards), [table('aircraft', [1], self.ROW)])
                e = ev[str(event['id'])]
                self.assertEqual((e['verdict'], e['acceptedCards']), (verdict, accepted))
                self.assertEqual(summary['unexplainedCards'], 0)


class AMoveNeedsAMove(unittest.TestCase):
    """PR #11 comment 6511895761: a card that keeps the paragraph where it was reports no move."""
    PARA = 'Hull cover is USD 100 for the aircraft.'

    def test_a_card_that_keeps_the_paragraph_in_place_shows_no_move(self):
        moved = change(44, 'hull', 'Moved', self.PARA, self.PARA, pages=(4, 4))
        kept = card('k', 'Replaced', [(4, 'a', self.PARA + ' Liability excluded.')], [(4, 'b', self.PARA + ' Liability included.')])
        summary, ev = run([moved], result([kept]))
        self.assertEqual((ev['44']['verdict'], ev['44']['acceptedCards']), ('not_evaluable', []))
        self.assertEqual(ev['44']['atoms'], ['same_card_without_move'])
        self.assertEqual(summary['unexplainedCards'], 1)
        # Controls: a card that reports the move, and the paragraph removed in one place and added in another.
        cases = {'moved card': ([card('m', 'Moved', [(4, 'a', self.PARA)], [(4, 'c', self.PARA)])], 'correct', ['m']),
                 'split': ([card('o', 'Removed', [(4, 'a', self.PARA)]), card('n', 'Added', right=[(4, 'c', self.PARA)])],
                           'split_attributable', ['n', 'o'])}
        for name, (cards, verdict, accepted) in cases.items():
            with self.subTest(name):
                _, ev = run([moved], result([kept] + cards))
                self.assertEqual((ev['44']['verdict'], ev['44']['acceptedCards']), (verdict, accepted))

    def test_a_card_carrying_the_moved_paragraphs_edit_shows_it(self):
        """A moved and edited paragraph may show as a replacement (the author expects that for bizav #26)."""
        moved = change(45, 'hull', 'Moved', self.PARA, self.PARA.replace('100', '200'), [('USD 100', 'USD 200')], pages=(4, 4))
        replaced = card('r', 'Replaced', [(4, 'a', self.PARA)], [(4, 'b', self.PARA.replace('100', '200'))])
        _, ev = run([moved], result([replaced]))
        self.assertEqual((ev['45']['verdict'], ev['45']['acceptedCards']), ('correct', ['r']))
        # Control: a card that keeps the moved paragraph unchanged around another change.
        kept = card('k', 'Replaced', [(4, 'a', self.PARA + ' Liability excluded.')], [(4, 'b', self.PARA + ' Liability included.')])
        _, ev = run([change(46, 'hull', 'Moved', self.PARA, self.PARA, pages=(4, 4))], result([kept]))
        self.assertEqual(ev['46']['atoms'], ['same_card_without_move'])


class TheOtherSideHoldsWholeNumbers(unittest.TestCase):
    """PR #9 comment 6512254699: a card keeping "Limit USD 1000" adds or removes "Limit USD 100"."""

    def test_a_longer_number_on_the_other_side_is_not_the_paragraph(self):
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(48, 'lim', kind, **{side: 'Limit USD 100'}, pages=(0, 1) if kind == 'Added' else (1, 0))
            cells = {'left': [(1, 'a', 'Limit USD 1000')], 'right': [(1, 'b', 'Limit USD 1000 Limit USD 100')]}
            if kind == 'Removed':
                cells = {'left': cells['right'], 'right': cells['left']}
            _, ev = run([c], result([card('r', 'Replaced', **cells)]))
            self.assertEqual((ev['48']['verdict'], ev['48']['acceptedCards']), ('correct', ['r']), kind)
            # Control: the paragraph itself kept on the other side is no addition or removal.
            kept = card('k', 'Replaced', [(1, 'a', 'Limit USD 100 applies')], [(1, 'b', 'Limit USD 100 applied')])
            _, ev = run([c], result([kept]))
            self.assertEqual(ev['48']['atoms'], ['kept_on_other_side'], kind)


class PagesBoundTheText(unittest.TestCase):
    """Review of PR #11 (T4, fixed in #9): the text must be found in sources on the author's pages.
    A card holding it on another page, with unrelated text on the stated page, is not evidence."""
    TEXT = 'Proof of Loss: The Insured shall provide Underwriters with complete documentation.'
    OTHER = 'Unrelated wording that stays on its page.'

    def removed(self, left, pages):
        return change(30, 'pol', 'Removed', left=self.TEXT, pages=pages), card('w', 'Removed', left)

    def added(self, right, pages):
        return change(31, 'pol', 'Added', right=self.TEXT, pages=pages), card('w', 'Added', right=right)

    def test_text_only_on_another_page_is_not_accepted(self):
        cases = {
            'removed': self.removed([(1, 'a', self.TEXT), (2, 'b', self.OTHER)], (2, 0)),
            'added': self.added([(1, 'a', self.TEXT), (2, 'b', self.OTHER)], (0, 2)),
            'replaced': (change(40, 'hull', 'Replaced', 'Hull USD 100 applies.', 'Hull USD 200 applies.',
                                [('USD 100', 'USD 200')], pages=(2, 2)),
                         card('w', 'Replaced', [(1, 'a', 'Hull USD 100 applies.'), (2, 'c', self.OTHER)],
                              [(1, 'b', 'Hull USD 200 applies.'), (2, 'd', self.OTHER)])),
        }
        for name, (event, wrong) in cases.items():
            with self.subTest(name):
                summary, ev = run([event], result([wrong]))
                e = ev[str(event['id'])]
                self.assertNotIn(e['verdict'], ('correct', 'split_attributable'))
                self.assertEqual(e['acceptedCards'], [])
                self.assertEqual((summary['acceptedCards'], summary['unexplainedCards']), (0, 1))

    def test_text_on_the_stated_or_any_page_is_accepted_with_its_own_source(self):
        spanning = change(30, 'pol', 'Removed', left=self.TEXT, pages=(1, 0))
        spanning['left_pages'] = [1, 2]
        cases = {
            'removed on its page': (*self.removed([(1, 'a', self.OTHER), (2, 'b', self.TEXT)], (2, 0)), 'left', {(2, 'b')}),
            'added on its page': (*self.added([(1, 'a', self.OTHER), (2, 'b', self.TEXT)], (0, 2)), 'right', {(2, 'b')}),
            'no page stated': (*self.removed([(1, 'a', self.TEXT), (2, 'b', self.OTHER)], (0, 0)), 'left', {(1, 'a')}),
            'across the stated pages': (spanning, card('w', 'Removed', [(1, 'a', 'Proof of Loss: The Insured shall'),
                                                                     (2, 'b', 'provide Underwriters with complete documentation.')]),
                                        'left', {(1, 'a'), (2, 'b')}),
        }
        for name, (event, right_card, side, where) in cases.items():
            with self.subTest(name):
                summary, ev = run([event], result([right_card]))
                e = ev[str(event['id'])]
                self.assertEqual((e['verdict'], e['acceptedCards']), ('correct', ['w']))
                self.assertEqual(summary['unexplainedCards'], 0)
                refs = e['atomEvidence'][0]['candidates'][0][side]
                self.assertEqual({(r['page'], r['unitId']) for r in refs}, where)
        # Starting on page 1, the paragraph is not on page 2 alone.
        only_two = dict(spanning, left_pages=[2])
        _, ev = run([only_two], result([cases['across the stated pages'][1]]))
        self.assertEqual(ev['30']['acceptedCards'], [])


class AddedRemovedRows(unittest.TestCase):
    ADDED = change(63, 'ac_55228', 'Added', right='Airbus A220 | 55228 | VH-JXP | 39,000,000', pages=(0, 11))
    DECLARED = [table('aircraft', AIRCRAFT, ADDED)]

    def test_cells_must_share_one_record(self):
        whole = card('w', 'Added', right=[(11, 'u1', t) for t in ('Airbus A220', '55228', 'VH-JXP', '39,000,000')])
        _, ev = run([self.ADDED], result([whole]), self.DECLARED)
        self.assertEqual(ev['63']['verdict'], 'correct')
        self.assertTrue(ev['63']['row']['fullRowRecovered'])

    def test_a_cell_amount_matches_only_as_a_whole_number(self):
        """r4416863588: "USD 100" inside "USD 100,000" is another amount, for Added and Removed rows."""
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(64, 'ac_1315', kind, **{side: '1315 | Hull | USD 100'}, pages=(0, 11) if kind == 'Added' else (11, 0))
            unit = lambda text: [(11, 'u1', text)]
            other = card('x', kind, **{side: unit('1315 Hull USD 100,000')})
            _, ev = run([c], result([other]), [table('aircraft', [0], c)])
            self.assertNotEqual(ev['64']['verdict'], 'correct', kind)
            self.assertFalse(ev['64']['row']['fullRowRecovered'], kind)
            own = card('y', kind, **{side: unit('1315 Hull USD 100')})
            _, ev = run([c], result([own]), [table('aircraft', [0], c)])
            self.assertEqual(ev['64']['verdict'], 'correct', kind)

    def test_repeated_cells_need_their_own_occurrences(self):
        """r4416863597: two author cells "USD 100" are not both recovered from one "USD 100"."""
        c = change(65, 'ac_1315', 'Added', right='1315 | USD 100 | USD 100', pages=(0, 11))
        short = card('x', 'Added', right=[(11, 'u1', '1315 USD 100')])
        _, ev = run([c], result([short]), [table('aircraft', [0], c)])
        self.assertNotEqual(ev['65']['verdict'], 'correct')
        self.assertFalse(ev['65']['row']['fullRowRecovered'])
        self.assertEqual(ev['65']['atoms'], ['in_record', 'in_record', 'record_short'])
        whole = card('y', 'Added', right=[(11, 'u1', '1315 USD 100 USD 100')])
        _, ev = run([c], result([whole]), [table('aircraft', [0], c)])
        self.assertEqual(ev['65']['verdict'], 'correct')
        self.assertTrue(ev['65']['row']['fullRowRecovered'])

    def test_a_single_character_cell_is_checked_too(self):
        """r4416771405: the A of 1315 | A | USD 100 was dropped from the row."""
        c = change(66, 'ac_1315', 'Added', right='1315 | A | USD 100', pages=(0, 11))
        _, ev = run([c], result([card('x', 'Added', right=[(11, 'u1', '1315 USD 100')])]), [table('aircraft', [0], c)])
        self.assertNotEqual(ev['66']['verdict'], 'correct')
        self.assertFalse(ev['66']['row']['fullRowRecovered'])
        _, ev = run([c], result([card('y', 'Added', right=[(11, 'u1', '1315 A USD 100')])]), [table('aircraft', [0], c)])
        self.assertEqual(ev['66']['verdict'], 'correct')
        self.assertTrue(ev['66']['row']['fullRowRecovered'])

    def test_overlapping_cells_need_separate_occurrences(self):
        """r4417192877: USD 100 and 100 are not both recovered from one "USD 100"."""
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(67, 'ac_1315', kind, **{side: '1315 | USD 100 | 100'}, pages=(0, 11) if kind == 'Added' else (11, 0))
            _, ev = run([c], result([card('x', kind, **{side: [(11, 'u1', '1315 USD 100')]})]), [table('aircraft', [0], c)])
            self.assertNotEqual(ev['67']['verdict'], 'correct', kind)
            self.assertFalse(ev['67']['row']['fullRowRecovered'], kind)
            _, ev = run([c], result([card('y', kind, **{side: [(11, 'u1', '1315 USD 100 100')]})]), [table('aircraft', [0], c)])
            self.assertEqual(ev['67']['verdict'], 'correct', kind)

    def test_a_cell_value_does_not_match_a_signed_value(self):
        """r4417384098: 100 is not found in -100."""
        c = change(68, 'ac_1315', 'Added', right='1315 | Hull | 100', pages=(0, 11))
        _, ev = run([c], result([card('x', 'Added', right=[(11, 'u1', '1315 Hull -100')])]), [table('aircraft', [0], c)])
        self.assertNotEqual(ev['68']['verdict'], 'correct')
        self.assertFalse(ev['68']['row']['fullRowRecovered'])
        _, ev = run([c], result([card('y', 'Added', right=[(11, 'u1', '1315 Hull 100')])]), [table('aircraft', [0], c)])
        self.assertEqual(ev['68']['verdict'], 'correct')

    def test_a_source_range_listed_twice_is_one_occurrence(self):
        """r4417511075: a card that lists the range of USD 100 twice shows it once."""
        c = change(71, 'ac_1315', 'Added', right='1315 | USD 100 | USD 100', pages=(0, 11))
        twice = card('x', 'Added', right=[(11, 'u1', '1315'), (11, 'u1', 'USD 100')])
        twice['right'].append(dict(twice['right'][1]))
        _, ev = run([c], result([twice]), [table('aircraft', [0], c)])
        self.assertFalse(ev['71']['row']['fullRowRecovered'])
        self.assertNotEqual(ev['71']['verdict'], 'correct')
        # Control: the unit holds the amount twice, at two ranges.
        both = card('y', 'Added', right=[(11, 'u1', '1315'), (11, 'u1', 'USD 100'), (11, 'u1', 'USD 100')])
        _, ev = run([c], result([both]), [table('aircraft', [0], c)])
        self.assertEqual((ev['71']['verdict'], ev['71']['row']['fullRowRecovered']), ('correct', True))

    def test_contiguous_source_ranges_join_without_a_space(self):
        """#11 comment 6508515495: USD 100 is not in USD 100,000 split before the comma."""
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(73, 'ac_1315', kind, **{side: '1315 | Hull | USD 100'}, pages=(0, 11) if kind == 'Added' else (11, 0))
            # The card shows 1315 Hull USD 100,000; its two locations meet before the comma.
            split = shown('x', kind, side, '1315 Hull USD 100,000', [0, 17])
            _, ev = run([c], result([split]), [table('aircraft', [0], c)])
            self.assertNotEqual(ev['73']['verdict'], 'correct', kind)
            self.assertFalse(ev['73']['row']['fullRowRecovered'], kind)
            # Control: ranges that meet but that the card shows apart are two words (a PDF places
            # words apart without a space in its stream).
            apart = card('y', kind, **{side: [(11, 'u1', '1315 Hull USD'), (11, 'u1', '100')]})
            apart[side][1]['rawRange'] = [13, 16]
            _, ev = run([c], result([apart]), [table('aircraft', [0], c)])
            self.assertEqual((ev['73']['verdict'], ev['73']['row']['fullRowRecovered']), ('correct', True), kind)

    def test_a_join_is_read_where_the_card_shows_it_not_anywhere_on_the_card(self):
        """#11 comment 6512133284: "100 ,000" spaced in a note elsewhere on the card does not split
        the amount the card shows whole."""
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(77, 'ac_1315', kind, **{side: '1315 | Hull | USD 100'}, pages=(0, 11) if kind == 'Added' else (11, 0))
            note = shown('x', kind, side, '1315 Hull USD 100,000; Note 100 ,000', [0, 14, 17, 21])
            _, ev = run([c], result([note]), [table('aircraft', [0], c)])
            self.assertNotEqual(ev['77']['verdict'], 'correct', kind)
            self.assertFalse(ev['77']['row']['fullRowRecovered'], kind)

    def test_a_card_naming_another_record_does_not_attribute_this_row(self):
        """PR #11 comment 6513304357: an Added card holding 1315 Hull USD 100 but claiming rowKey 1760."""
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(78, 'ac_1315', kind, **{side: '1315 | Hull | USD 100'}, pages=(0, 11) if kind == 'Added' else (11, 0))
            other = card('x', kind, **{side: [(11, 'u1', '1315 Hull USD 100')]}, row_key='1760')
            _, ev = run([c], result([other]), [table('aircraft', [0], c)])
            self.assertEqual((ev['78']['verdict'], ev['78']['acceptedCards']), ('misattributed', []), kind)
            # Control: the card names this record.
            own = card('y', kind, **{side: [(11, 'u1', '1315 Hull USD 100')]}, row_key='1315')
            _, ev = run([c], result([own]), [table('aircraft', [0], c)])
            self.assertEqual((ev['78']['verdict'], ev['78']['row']['fullRowRecovered']), ('correct', True), kind)

    def test_a_card_whose_row_the_product_left_unresolved_is_not_evaluated(self):
        """PR #11 comment 6513806516: an Added card with confidence "unresolved" does not certify the row."""
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(79, 'ac_1315', kind, **{side: '1315 | Hull | USD 100'}, pages=(0, 11) if kind == 'Added' else (11, 0))
            open_ = card('x', kind, **{side: [(11, 'u1', '1315 Hull USD 100')]}, confidence='unresolved')
            _, ev = run([c], result([open_]), [table('aircraft', [0], c)])
            self.assertEqual((ev['79']['verdict'], ev['79']['acceptedCards']), ('not_evaluable', []), kind)
            self.assertNotEqual(ev['79']['row']['fullRowRecovered'], True, kind)
            # Control: the same card as a candidate correspondence is correct.
            _, ev = run([c], result([card('y', kind, **{side: [(11, 'u1', '1315 Hull USD 100')]})]), [table('aircraft', [0], c)])
            self.assertEqual((ev['79']['verdict'], ev['79']['row']['fullRowRecovered']), ('correct', True), kind)

    def test_cells_find_a_non_overlapping_allocation_when_one_exists(self):
        """r4417384107: 1315 | A | A B | B B is all in "1315 A A B B B"."""
        for kind in ('Added', 'Removed'):
            side = 'right' if kind == 'Added' else 'left'
            c = change(69, 'ac_1315', kind, **{side: '1315 | A | A B | B B'}, pages=(0, 11) if kind == 'Added' else (11, 0))
            _, ev = run([c], result([card('x', kind, **{side: [(11, 'u1', '1315 A A B B B')]})]), [table('aircraft', [0], c)])
            self.assertEqual((ev['69']['verdict'], ev['69']['row']['fullRowRecovered']), ('correct', True), kind)

    def test_identical_cells_are_allocated_without_trying_their_orders(self):
        """r4417631513: ten identical cells against nine copies took seconds, each more ten times longer."""
        for n in (10, 24):
            start = time.monotonic()
            self.assertEqual(triage.allocate(['0'] * n, ' '.join(['0'] * (n - 1))), ['0'] * (n - 1))
            self.assertLess(time.monotonic() - start, 1.0, n)
        self.assertEqual(triage.allocate(['0 0', '0', '0'], '0 0 0'), ['0 0', '0'])

    def test_cells_scattered_over_different_records_are_not_complete(self):
        ident = card('i', 'Added', right=[(11, 'u1', '55228'), (11, 'u1', 'VH-JXP')])
        other = card('o', 'Added', right=[(11, 'u2', 'Airbus A220'), (11, 'u2', '39,000,000')])
        _, ev = run([self.ADDED], result([ident, other]), self.DECLARED)
        self.assertNotEqual(ev['63']['verdict'], 'correct')
        self.assertNotEqual(ev['63']['outcome'], 'complete')
        self.assertEqual(ev['63']['atoms'], ['outside_record', 'in_record', 'in_record', 'outside_record'])

    def test_row_inside_another_records_card(self):
        neighbour = ('Airbus A320', '40001', 'VH-AAA')
        merged = card('m', 'Replaced', [(11, 'u0', t) for t in neighbour],
                      [(11, 'u1', t) for t in (*neighbour, 'Airbus A220', '55228', 'VH-JXP', '39,000,000')])
        _, ev = run([self.ADDED], result([merged]), self.DECLARED)
        self.assertEqual((ev['63']['verdict'], ev['63']['atoms'][0]), ('not_evaluable', 'merged_into_neighbour_card'))
        paired = card('p', 'Replaced', [(11, 'u0', t) for t in neighbour],
                      [(11, 'u1', t) for t in ('Airbus A220', '55228', 'VH-JXP', '39,000,000')])
        _, ev = run([self.ADDED], result([paired]), self.DECLARED)
        self.assertEqual((ev['63']['verdict'], ev['63']['atoms'][0]), ('misattributed', 'paired_with_other_record'))

    def test_cells_without_any_record_identity_are_not_evaluable(self):
        a = card('a', 'Added', right=[(11, 'u1', 'Airbus A220'), (11, 'u1', 'VH-JXP')])
        b = card('b', 'Added', right=[(11, 'u2', '39,000,000')])
        _, ev = run([self.ADDED], result([a, b]), self.DECLARED)
        self.assertEqual(ev['63']['verdict'], 'not_evaluable')


class SidesAndSplits(unittest.TestCase):
    PARA = change(13, 'repo_limit', 'Replaced', 'Repossession Expenses: USD 5,000,000 any one Aircraft.',
                  'Repossession Expenses: USD 7,500,000 any one Aircraft.', [('USD 5,000,000', 'USD 7,500,000')],
                  pages=(3, 3))

    def test_unresolved_hit_on_one_side_is_not_both_sides(self):
        g = group(left=[(3, 'g1', 'Repossession Expenses: USD 5,000,000 any one Aircraft.')])
        # The right side of the group is on another page than the event.
        g['right'] = [loc('right', 9, 'g2', 'USD 7,500,000')]
        _, ev = run([self.PARA], result([], [g]))
        atom = ev['13']['atomEvidence'][0]
        self.assertEqual(ev['13']['verdict'], 'one_side_only')
        self.assertEqual([(h['side'], h['page']) for h in atom['unresolved']], [('left', 3)])

    def test_both_sides_only_in_an_unresolved_group_are_not_evaluable(self):
        g = group([(3, 'g1', 'USD 5,000,000 any one Aircraft')], [(3, 'g2', 'USD 7,500,000 any one Aircraft')])
        _, ev = run([self.PARA], result([], [g]))
        self.assertEqual((ev['13']['verdict'], ev['13']['atoms']), ('not_evaluable', ['in_unresolved_group']))

    def test_one_side_in_cards(self):
        _, ev = run([self.PARA], result([card('r', 'Removed', [(3, 'a', 'USD 5,000,000 any one Aircraft.')])]))
        self.assertEqual(ev['13']['verdict'], 'one_side_only')

    def test_paragraph_split_needs_the_author_context(self):
        rem = card('r', 'Removed', [(3, 'a', 'Repossession Expenses: USD 5,000,000 any one Aircraft.')])
        add = card('a', 'Added', right=[(3, 'b', 'Repossession Expenses: USD 7,500,000 any one Aircraft.')])
        _, ev = run([self.PARA], result([rem, add]))
        self.assertEqual(ev['13']['verdict'], 'split_attributable')
        bare = card('a', 'Added', right=[(3, 'b', 'USD 7,500,000')])
        _, ev = run([self.PARA], result([rem, bare]))
        self.assertEqual(ev['13']['verdict'], 'not_evaluable')

    def test_row_split_needs_the_record_on_both_sides(self):
        c = change(73, 'hg_dxb', 'Replaced', 'Dubai (OMDW) | Al Maktoum Hangars | Shared',
                   'Dubai (OMDW) | Desert Falcon Hangars | Shared', [('Al Maktoum Hangars', 'Desert Falcon Hangars')],
                   pages=(15, 15))
        rem = card('r', 'Removed', [(15, 'a', 'Dubai (OMDW)'), (15, 'a', 'Al Maktoum Hangars'), (15, 'a', 'Shared')])
        add = card('a', 'Added', right=[(15, 'b', 'Dubai (OMDW)'), (15, 'b', 'Desert Falcon Hangars')])
        bases = [table('bases', [0], c)]
        _, ev = run([c], result([rem, add]), bases)
        self.assertEqual(ev['73']['verdict'], 'split_attributable')
        lone = card('a', 'Added', right=[(15, 'b', 'Desert Falcon Hangars')])
        _, ev = run([c], result([rem, lone]), bases)
        self.assertEqual((ev['73']['verdict'], ev['73']['atoms']), ('not_evaluable', ['separate_cards']))


class OneQualifyingHit(unittest.TestCase):
    """Reviews of PR #11 (r4410014301, r4411510471, r4411752201): the actual edit, the record
    identity or paragraph context, the allowed pages and the accepted evidence all come from one
    qualifying occurrence. Unchanged occurrences, other units of the card and other pages lend
    nothing."""
    ROW = change(52, 'ac_1315', 'Replaced', 'ATR | 1315 | USD 100', 'ATR | 1315 | USD 200',
                 [('USD 100', 'USD 200')], pages=(11, 11))
    OTHER = change(53, 'ac_1760', 'Replaced', 'ATR | 1760 | USD 100', 'ATR | 1760 | USD 200',
                   [('USD 100', 'USD 200')], pages=(11, 11))

    def edit_in(self, record):
        """1315 unchanged in units a/c holding both values; the only edit is in the unit of `record`."""
        return card('x', 'Replaced', [(11, 'a', '1315 USD 100 USD 200'), (11, 'b', f'{record} USD 100')],
                    [(11, 'c', '1315 USD 100 USD 200'), (11, 'd', f'{record} USD 200')])

    def test_an_unchanged_occurrence_does_not_lend_its_record_to_another_records_edit(self):
        _, ev = run([self.ROW], result([self.edit_in('1760')]), [table('aircraft', [1], self.ROW)])
        self.assertNotEqual(ev['52']['verdict'], 'correct')
        self.assertEqual(ev['52']['acceptedCards'], [])
        # Declaring the other record as well makes the wrong card a contradiction, not a pass.
        _, ev = run([self.ROW, self.OTHER], result([self.edit_in('1760')]),
                    [table('aircraft', [1], self.ROW, self.OTHER)])
        self.assertNotEqual(ev['52']['verdict'], 'correct')
        self.assertEqual(ev['53']['verdict'], 'correct')
        # Control: the edit is in 1315's own unit.
        own = card('o', 'Replaced', [(11, 'a', '1760 USD 100 USD 200'), (11, 'b', '1315 USD 100')],
                   [(11, 'c', '1760 USD 100 USD 200'), (11, 'd', '1315 USD 200')])
        _, ev = run([self.ROW], result([own]), [table('aircraft', [1], self.ROW)])
        self.assertEqual((ev['52']['verdict'], ev['52']['acceptedCards']), ('correct', ['o']))
        refs = ev['52']['atomEvidence'][0]['candidates'][0]
        self.assertEqual([(r['unitId']) for r in refs['left']] + [(r['unitId']) for r in refs['right']], ['b', 'd'])

    def test_an_edit_spanning_units_takes_identity_only_from_those_units(self):
        c = change(52, 'ac_1315', 'Replaced', '1315 | USD 100 | Alpha', '1315 | USD 200 | Alpha',
                   [('USD 100', 'USD 200')], pages=(11, 11))
        x = card('x', 'Replaced', [(11, 'a', '1315'), (11, 'b', 'USD'), (11, 'c', '100 1760')],
                 [(11, 'a2', '1315'), (11, 'b2', 'USD'), (11, 'c2', '200 1760')])
        _, ev = run([c], result([x]), [table('rows', [0], c)])
        self.assertNotEqual(ev['52']['verdict'], 'correct')
        self.assertEqual(ev['52']['acceptedCards'], [])
        # The unconfirmed occurrence is written out: the units carrying its edit (renewal-triage/13),
        # without the identity.
        self.assertEqual(ev['52']['atomEvidence'][0]['candidates'][0]['identityCells']['left'],
                         {'units': ['c'], 'identity': [], 'otherRecords': []})
        # Control: one unit holds the identity and the edit.
        y = card('y', 'Replaced', [(11, 'a', '1315 USD 100 Alpha')], [(11, 'b', '1315 USD 200 Alpha')])
        _, ev = run([c], result([y]), [table('rows', [0], c)])
        self.assertEqual(ev['52']['verdict'], 'correct')

    PARA = change(13, 'hull', 'Replaced', 'Hull cover is USD 100 for the aircraft.',
                  'Hull cover is USD 200 for the aircraft.', [('USD 100', 'USD 200')], pages=(2, 2))

    def split(self, page_of_paragraph):
        old, new = self.PARA['left_text'], self.PARA['right_text']
        if page_of_paragraph == 'both':
            return [card('r', 'Removed', [(1, 'a', old), (2, 'b', 'USD 100')]),
                    card('n', 'Added', right=[(1, 'c', new), (2, 'd', 'USD 200')])]
        return [card('r', 'Removed', [(page_of_paragraph, 'a', old)]),
                card('n', 'Added', right=[(page_of_paragraph, 'c', new)])]

    def test_split_cards_take_the_paragraph_context_from_the_stated_page(self):
        summary, ev = run([self.PARA], result(self.split('both')))
        self.assertNotEqual(ev['13']['verdict'], 'split_attributable')
        self.assertEqual(ev['13']['acceptedCards'], [])
        self.assertEqual(summary['unexplainedCards'], 2)
        # Controls: the whole paragraph on the stated page; only on another page.
        _, ev = run([self.PARA], result(self.split(2)))
        self.assertEqual((ev['13']['verdict'], ev['13']['acceptedCards']), ('split_attributable', ['n', 'r']))
        _, ev = run([self.PARA], result(self.split(1)))
        self.assertEqual(ev['13']['verdict'], 'not_located')


class WholeNumbers(unittest.TestCase):
    """Review of PR #11 (r4413938264): a number at either end of the author text matches only as a
    whole number. "USD 100" inside "USD 1000" or "USD 100,000", or "0.0425%" inside "10.0425%", is
    another value, so a card changing it is no evidence for the author edit."""
    ROW = change(52, 'ac_1315', 'Replaced', 'ATR | 1315 | USD 100', 'ATR | 1315 | USD 200',
                 [('USD 100', 'USD 200')], pages=(11, 11))
    RATE = change(87, 'rate_1_1', 'Replaced', '1.1 | Contingent Hull | 0.0425%', '1.1 | Contingent Hull | 0.0450%',
                  [('0.0425%', '0.0450%')], pages=(20, 19))

    def amount(self, old, new):
        c = card('x', 'Replaced', [(11, 'a', f'1315 Liability {old}')], [(11, 'b', f'1315 Liability {new}')])
        return run([self.ROW], result([c]), [table('aircraft', [1], self.ROW)])

    def rate(self, old, new):
        c = card('x', 'Replaced', [(20, 'a', f'1.1 Contingent Hull {old}')], [(19, 'b', f'1.1 Contingent Hull {new}')])
        return run([self.RATE], result([c]), [table('premium rates', [0, 1], self.RATE)])

    def test_a_longer_number_is_not_the_author_value(self):
        for old, new in (('USD 1000', 'USD 2000'), ('USD 100,000', 'USD 200,000'), ('USD 100.5', 'USD 200.5')):
            summary, ev = self.amount(old, new)
            self.assertEqual((ev['52']['verdict'], ev['52']['acceptedCards'], summary['unexplainedCards']),
                             ('not_located', [], 1), old)
        _, ev = self.rate('10.0425%', '10.0450%')
        self.assertEqual(ev['87']['verdict'], 'not_located')
        # Controls: the value itself, also before a full stop or after other text.
        for old, new in (('USD 100', 'USD 200'), ('USD 100.', 'USD 200.')):
            _, ev = self.amount(old, new)
            self.assertEqual((ev['52']['verdict'], ev['52']['acceptedCards']), ('correct', ['x']), old)
        _, ev = self.rate('0.0425%', '0.0450%')
        self.assertEqual(ev['87']['verdict'], 'correct')

    def test_a_cut_opening_does_not_end_inside_a_number(self):
        # The 40-character opening of a moved paragraph would cut "USD 1,250,000" after "USD 1,25".
        text = 'Aggregate limit is increased to USD 1,250,000 in all.'
        atoms, _ = triage.fragments(change(9, 'limit', 'Moved', text, text))
        self.assertEqual(atoms[0]['old'], 'Aggregate limit is increased to USD')


def raw_card(id, left, right, operations):
    """A card with its own text operations: left/right are the cited source units
    (page, unit, text), each operation (kind, text, left pieces, right pieces) with pieces
    (page, unit, text, raw start), so order and adjacency in the source can be set exactly."""
    piece = lambda side: lambda x: loc(side, *x)
    old = ''.join(t for k, t, _, _ in operations if k in ('equal', 'delete'))
    new = ''.join(t for k, t, _, _ in operations if k in ('equal', 'insert'))
    return {'id': id, 'kind': 'Replaced', 'facts': [],
            'structurePath': {'section': 'clauses', 'entity': None, 'field': None, 'table': None,
                              'rowKey': None, 'confidence': 'candidate'},
            'left': [loc('left', p, u, t) for p, u, t in left], 'right': [loc('right', p, u, t) for p, u, t in right],
            'oldText': old, 'newText': new, 'hasTextChange': old != new,
            'textOps': [{'kind': k, 'text': t, 'left': list(map(piece('left'), l)), 'right': list(map(piece('right'), r))}
                        for k, t, l, r in operations]}


class EditEvidence(unittest.TestCase):
    """Reviews of PR #11 r4415075897 and r4415128893, and the source-order gap: a card proves an
    author edit only by an occurrence of the author text read in source order (inside a word or
    number each character right after the previous one) that carries a change inside the part
    the edit changes. A pure insertion or deletion needs no text on its empty side; its other side
    still needs the edit and the record identity or author paragraph around it."""
    PARA = change(13, 'liab', 'Replaced', 'Extra USD 100; Liability USD 100.', 'Extra USD 100; Liability USD 200.',
                  [('USD 100', 'USD 200')], pages=(1, 1))

    def test_whitespace_edits_beside_the_amounts_are_not_the_amount_change(self):
        L, R = 'Extra USD  100; Liability USD 200.', 'Extra USD 100; Liability USD  200.'
        x = raw_card('x', [(1, 'a', L)], [(1, 'b', R)], [
            ('equal', 'Extra USD ', [(1, 'a', 'Extra USD ', 0)], [(1, 'b', 'Extra USD ', 0)]),
            ('delete', ' ', [(1, 'a', ' ', 10)], []),
            ('equal', '100; Liability USD ', [(1, 'a', '100; Liability USD ', 11)], [(1, 'b', '100; Liability USD ', 10)]),
            ('insert', ' ', [], [(1, 'b', ' ', 29)]),
            ('equal', '200.', [(1, 'a', '200.', 30)], [(1, 'b', '200.', 30)])])
        summary, ev = run([self.PARA], result([x]))
        self.assertNotEqual(ev['13']['verdict'], 'correct')
        self.assertEqual((ev['13']['acceptedCards'], summary['unexplainedCards']), ([], 1))
        # Control: a card changing the amount itself.
        y = card('y', 'Replaced', [(1, 'a', 'Extra USD 100; Liability USD 100.')], [(1, 'b', 'Extra USD 100; Liability USD 200.')])
        _, ev = run([self.PARA], result([y]))
        self.assertEqual((ev['13']['verdict'], ev['13']['acceptedCards']), ('correct', ['y']))

    def test_a_pure_insertion_or_deletion_is_accepted_on_its_card(self):
        old, new = 'The insurer pays losses.', 'The insurer pays approved losses.'
        for kind, edit, (l, r) in (('insert', ('', 'approved'), (old, new)), ('delete', ('approved', ''), (new, old))):
            c = change(20, 'pay', 'Replaced', l, r, [edit])
            summary, ev = run([c], result([card('x', 'Replaced', [(1, 'a', l)], [(1, 'b', r)])]))
            self.assertEqual((ev['20']['verdict'], ev['20']['acceptedCards'], summary['unexplainedCards']),
                             ('correct', ['x'], 0), kind)
        # r4416398168: a short paragraph shown whole is its own context, however short.
        for kind, edit, (l, r) in (('insert', ('', 'later'), ('Pay now.', 'Pay later now.')),
                                   ('delete', ('later', ''), ('Pay later now.', 'Pay now.'))):
            c = change(24, 'pay', 'Replaced', l, r, [edit])
            summary, ev = run([c], result([card('x', 'Replaced', [(1, 'a', l)], [(1, 'b', r)])]))
            self.assertEqual((ev['24']['verdict'], ev['24']['acceptedCards'], summary['unexplainedCards']),
                             ('correct', ['x'], 0), kind)
        # The same word added in another paragraph is not this insertion.
        c = change(20, 'pay', 'Replaced', old, new, [('', 'approved')])
        other = card('y', 'Replaced', [(1, 'c', 'The broker the operations.')], [(1, 'd', 'The broker approved the operations.')])
        _, ev = run([c], result([other]))
        self.assertNotEqual(ev['20']['verdict'], 'correct')
        self.assertEqual(ev['20']['acceptedCards'], [])

    def test_characters_out_of_source_order_are_not_an_occurrence(self):
        left = [(1, 'a', 'Liability USD 100.')]
        def amount(pieces, unit_text):
            return raw_card('x', left, [(1, 'b', unit_text)], [
                ('equal', 'Liability ', [(1, 'a', 'Liability ', 0)], [(1, 'b', 'Liability ', 0)]),
                ('delete', 'USD 100', [(1, 'a', 'USD 100', 10)], []),
                ('insert', 'USD 200', [], pieces),
                ('equal', '.', [(1, 'a', '.', 17)], [(1, 'b', '.', 17)])])
        # "USD 200" read from "200 USD" backwards, and from "USD 2X00" skipping the X.
        for pieces, unit_text in (([(1, 'b', 'USD', 14), (1, 'b', ' 200', 9)], 'Liability 200 USD.'),
                                  ([(1, 'b', 'USD 2', 10), (1, 'b', '00', 16)], 'Liability USD 2X00.')):
            _, ev = run([self.PARA_SHORT], result([amount(pieces, unit_text)]))
            self.assertNotEqual(ev['21']['verdict'], 'correct', unit_text)
        # Control: the same text in source order.
        _, ev = run([self.PARA_SHORT], result([amount([(1, 'b', 'USD 200', 10)], 'Liability USD 200.')]))
        self.assertEqual(ev['21']['verdict'], 'correct')

    def test_the_old_and_new_occurrences_must_line_up_in_the_cards_edit(self):
        """r4415913728: edits only in the unchanged part of the author text (the currency codes)
        while the amounts stay paired with each other elsewhere do not show USD 100 -> USD 200."""
        row = change(41, 'ac_1315', 'Replaced', 'ATR | 1315 | Hull USD 100', 'ATR | 1315 | Hull USD 200',
                     [('USD 100', 'USD 200')], pages=(1, 1))
        L, R = '1315 Hull USD 100; Liability EUR 200.', '1315 Hull EUR 100; Liability USD 200.'
        swap = raw_card('x', [(1, 'a', L)], [(1, 'b', R)], [
            ('equal', '1315 Hull ', [(1, 'a', '1315 Hull ', 0)], [(1, 'b', '1315 Hull ', 0)]),
            ('delete', 'USD', [(1, 'a', 'USD', 10)], []),
            ('insert', 'EUR', [], [(1, 'b', 'EUR', 10)]),
            ('equal', ' 100; Liability ', [(1, 'a', ' 100; Liability ', 13)], [(1, 'b', ' 100; Liability ', 13)]),
            ('delete', 'EUR', [(1, 'a', 'EUR', 29)], []),
            ('insert', 'USD', [], [(1, 'b', 'USD', 29)]),
            ('equal', ' 200.', [(1, 'a', ' 200.', 32)], [(1, 'b', ' 200.', 32)])])
        _, ev = run([row], result([swap]), [table('aircraft', [1], row)])
        self.assertNotEqual(ev['41']['verdict'], 'correct')
        self.assertEqual(ev['41']['acceptedCards'], [])
        # The card does change both texts; the reason says that their edits do not line up.
        self.assertEqual(ev['41']['atoms'], ['same_card_unaligned'])
        # Control: the card that changes the Hull amount itself.
        own = card('y', 'Replaced', [(1, 'a', '1315 Hull USD 100; Liability EUR 200.')],
                   [(1, 'b', '1315 Hull USD 200; Liability EUR 200.')])
        _, ev = run([row], result([own]), [table('aircraft', [1], row)])
        self.assertEqual((ev['41']['verdict'], ev['41']['acceptedCards']), ('correct', ['y']))

    def test_either_copy_of_a_repeated_word_may_carry_the_insertion(self):
        """South Sudan, -> South Sudan, Sudan,: the card may mark the first Sudan as inserted."""
        c = change(16, 'excluded', 'Replaced', 'Iran, South Sudan, Syria.', 'Iran, South Sudan, Sudan, Syria.',
                   [('South Sudan, ', 'South Sudan, Sudan, ')], pages=(1, 1))
        L, R = 'Iran, South Sudan, Syria.', 'Iran, South Sudan, Sudan, Syria.'
        first = raw_card('x', [(1, 'a', L)], [(1, 'b', R)], [
            ('equal', 'Iran, South', [(1, 'a', 'Iran, South', 0)], [(1, 'b', 'Iran, South', 0)]),
            ('insert', ' Sudan,', [], [(1, 'b', ' Sudan,', 11)]),
            ('equal', ' Sudan, Syria.', [(1, 'a', ' Sudan, Syria.', 11)], [(1, 'b', ' Sudan, Syria.', 18)])])
        _, ev = run([c], result([first]))
        self.assertEqual((ev['16']['verdict'], ev['16']['acceptedCards']), ('correct', ['x']))

    def test_a_same_card_paragraph_edit_needs_the_author_paragraph(self):
        """r4417631502: the Liability paragraph's card is not the Hull paragraph's edit."""
        hull = ('Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.')
        c = change(24, 'hull', 'Replaced', *hull, [('USD 100', 'USD 200')])
        other = card('l', 'Replaced', [(1, 'a', 'Liability cover is USD 100 per passenger.')],
                     [(1, 'b', 'Liability cover is USD 200 per passenger.')])
        _, ev = run([c], result([other]))
        self.assertNotEqual(ev['24']['verdict'], 'correct')
        self.assertEqual(ev['24']['acceptedCards'], [])
        # Controls: the Hull paragraph's own card, also with the spaces its source units lose or add.
        _, ev = run([c], result([card('h', 'Replaced', [(1, 'a', hull[0])], [(1, 'b', hull[1])])]))
        self.assertEqual((ev['24']['verdict'], ev['24']['acceptedCards']), ('correct', ['h']))
        joined = card('j', 'Replaced', [(1, 'a', 'Hull cover isUSD 100 for the'), (1, 'a', 'aircraft.')],
                      [(1, 'b', 'Hull cover isUSD 200 for the'), (1, 'b', 'aircraft.')])
        _, ev = run([c], result([joined]))
        self.assertEqual((ev['24']['verdict'], ev['24']['acceptedCards']), ('correct', ['j']))

    def test_split_paragraph_context_comes_from_the_units_carrying_the_edit(self):
        """PR #11 comment 6507993515: an unchanged Hull unit does not lend its paragraph to an edit
        that another unit (Liability) makes."""
        hull = ('Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.')
        c = change(25, 'hull', 'Replaced', *hull, [('USD 100', 'USD 200')])
        one = card('one', 'Replaced', [(1, 'a', hull[0] + ' USD'), (1, 'b', '100 Liability')],
                   [(1, 'c', hull[0] + ' USD'), (1, 'd', '999 Liability')])
        two = card('two', 'Replaced', [(1, 'e', hull[1] + ' USD'), (1, 'f', '999 Liability')],
                   [(1, 'g', hull[1] + ' USD'), (1, 'h', '200 Liability')])
        _, ev = run([c], result([one, two]))
        self.assertNotIn(ev['25']['verdict'], ('correct', 'split_attributable'))
        # Control: the Hull paragraph removed and added on two cards.
        _, ev = run([c], result([card('o', 'Removed', [(1, 'a', hull[0])]), card('n', 'Added', right=[(1, 'b', hull[1])])]))
        self.assertEqual((ev['25']['verdict'], ev['25']['acceptedCards']), ('split_attributable', ['n', 'o']))

    def test_the_author_paragraph_must_surround_the_edited_occurrence(self):
        """PR #11 comment 6510958743: the Hull paragraph merely shares a unit with the Liability
        amount the card changes."""
        hull = ('Hull cover is USD 100 for the aircraft.', 'Hull cover is USD 200 for the aircraft.')
        c = change(27, 'hull', 'Replaced', *hull, [('USD 100', 'USD 200')])
        one = card('one', 'Replaced', [(1, 'a', hull[0] + ' Liability USD 100')], [(1, 'b', hull[0] + ' Liability USD 999')])
        two = card('two', 'Replaced', [(1, 'c', hull[1] + ' Liability USD 999')], [(1, 'd', hull[1] + ' Liability USD 200')])
        _, ev = run([c], result([one, two]))
        self.assertNotIn(ev['27']['verdict'], ('correct', 'split_attributable'))
        # Control: the Hull paragraph's own change, in a unit that also holds the Liability line.
        own = card('o', 'Replaced', [(1, 'a', hull[0] + ' Liability USD 100')], [(1, 'b', hull[1] + ' Liability USD 100')])
        _, ev = run([c], result([own]))
        self.assertEqual((ev['27']['verdict'], ev['27']['acceptedCards']), ('correct', ['o']))

    def test_a_whole_paragraph_edit_is_its_own_context(self):
        """PR #11 comment 6509794672: Pay now. -> Pay later. on a Removed and an Added card."""
        c = change(26, 'pay', 'Replaced', 'Pay now.', 'Pay later.', [('Pay now.', 'Pay later.')])
        _, ev = run([c], result([card('o', 'Removed', [(1, 'a', 'Pay now.')]), card('n', 'Added', right=[(1, 'b', 'Pay later.')])]))
        self.assertEqual((ev['26']['verdict'], ev['26']['acceptedCards']), ('split_attributable', ['n', 'o']))
        _, ev = run([c], result([card('r', 'Replaced', [(1, 'a', 'Pay now.')], [(1, 'b', 'Pay later.')])]))
        self.assertEqual((ev['26']['verdict'], ev['26']['acceptedCards']), ('correct', ['r']))

    def test_an_inserted_clause_may_repeat_the_words_after_it(self):
        """The card may pair the words an insertion repeats with the old text after it and mark
        the later copy as inserted: the context the edit keeps still lines up."""
        L = 'Claims: a bird strike (USD 412,500) and a ground claim.'
        R = 'Claims: a bird strike (USD 412,500) and a tail strike and a ground claim.'
        old, new = 'a bird strike (USD 412,500)', 'a bird strike (USD 412,500) and a tail strike'
        c = change(22, 'loss', 'Replaced', L, R, [(old, new)])
        kept, added = 'Claims: a bird strike (USD 412,500) and a ', 'tail strike and a '
        x = raw_card('x', [(1, 'a', L)], [(1, 'b', R)], [
            ('equal', kept, [(1, 'a', kept, 0)], [(1, 'b', kept, 0)]),
            ('insert', added, [], [(1, 'b', added, len(kept))]),
            ('equal', 'ground claim.', [(1, 'a', 'ground claim.', len(kept))], [(1, 'b', 'ground claim.', len(kept + added))])])
        _, ev = run([c], result([x]))
        self.assertEqual((ev['22']['verdict'], ev['22']['acceptedCards']), ('correct', ['x']))
        # Control: the old and new amounts replaced at two ends of the card, unchanged text between.
        c = change(23, 'liab', 'Replaced', 'USD 100 lorem ipsum dolor EUR 7', 'EUR 9 lorem ipsum dolor USD 200',
                   [('USD 100', 'USD 200')])
        mid = ' lorem ipsum dolor '
        y = raw_card('y', [(1, 'a', 'USD 100' + mid + 'EUR 7')], [(1, 'b', 'EUR 9' + mid + 'USD 200')], [
            ('delete', 'USD 100', [(1, 'a', 'USD 100', 0)], []),
            ('insert', 'EUR 9', [], [(1, 'b', 'EUR 9', 0)]),
            ('equal', mid, [(1, 'a', mid, 7)], [(1, 'b', mid, 5)]),
            ('delete', 'EUR 7', [(1, 'a', 'EUR 7', 26)], []),
            ('insert', 'USD 200', [], [(1, 'b', 'USD 200', 24)])])
        _, ev = run([c], result([y]))
        self.assertNotEqual(ev['23']['verdict'], 'correct')
        self.assertEqual(ev['23']['acceptedCards'], [])

    def test_the_identity_sits_in_a_unit_the_edit_changes(self):
        """r4416699649: an occurrence across two units, the identity only in the unit whose text
        is unchanged (\"1315 USD\" beside \"100 1760\" -> \"200 1760\"), does not confirm the record."""
        row = change(42, 'ac_1315', 'Replaced', 'ATR | 1315 | Hull USD 100', 'ATR | 1315 | Hull USD 200',
                     [('USD 100', 'USD 200')], pages=(1, 1))

        def two_units(a, b_old, b_new):
            return raw_card('x', [(1, 'a', a), (1, 'b', b_old)], [(1, 'c', a), (1, 'd', b_new)], [
                ('equal', a + ' ', [(1, 'a', a, 0)], [(1, 'c', a, 0)]),
                ('delete', '1', [(1, 'b', '1', 0)], []),
                ('insert', '2', [], [(1, 'd', '2', 0)]),
                ('equal', b_old[1:], [(1, 'b', b_old[1:], 1)], [(1, 'd', b_new[1:], 1)])])
        _, ev = run([row], result([two_units('1315 USD', '100 1760', '200 1760')]), [table('aircraft', [1], row)])
        self.assertNotEqual(ev['42']['verdict'], 'correct')
        self.assertEqual(ev['42']['acceptedCards'], [])
        # Control: the identity in the unit that carries the edit.
        _, ev = run([row], result([two_units('Hull USD', '100 1760 1315', '200 1760 1315')]), [table('aircraft', [1], row)])
        self.assertEqual((ev['42']['verdict'], ev['42']['acceptedCards']), ('correct', ['x']))

    def test_split_cards_must_change_the_part_the_edit_changes(self):
        """r4416771397: two cards that only swap currency codes are no split of USD 100 -> USD 200."""
        row = change(43, 'ac_1315', 'Replaced', 'ATR | 1315 | Hull USD 100', 'ATR | 1315 | Hull USD 200',
                     [('USD 100', 'USD 200')], pages=(1, 1))
        h = card('h', 'Replaced', [(1, 'a', '1315 Hull USD 100')], [(1, 'b', '1315 Hull EUR 100')])
        l = card('l', 'Replaced', [(1, 'c', '1315 Liability EUR 200')], [(1, 'd', '1315 Liability USD 200')])
        summary, ev = run([row], result([h, l]), [table('aircraft', [1], row)])
        self.assertNotIn(ev['43']['verdict'], ('correct', 'split_attributable'))
        self.assertEqual(ev['43']['acceptedCards'], [])
        # Control: the old row removed on one card and the new row added on another.
        gone = card('r', 'Removed', [(1, 'a', '1315 Hull USD 100')])
        new = card('n', 'Added', right=[(1, 'b', '1315 Hull USD 200')])
        _, ev = run([row], result([gone, new]), [table('aircraft', [1], row)])
        self.assertEqual((ev['43']['verdict'], ev['43']['acceptedCards']), ('split_attributable', ['n', 'r']))

    PARA_SHORT = change(21, 'liab', 'Replaced', 'Liability USD 100.', 'Liability USD 200.', [('USD 100', 'USD 200')],
                        pages=(1, 1))


class FactsFormatsExclusionsFurniture(unittest.TestCase):
    def test_a_page_fact_needs_whole_page_numbers(self):
        """PR #9 comment 6508095436, PR #11 comment 6509987949: Page 1.1 -> 2.1 is no page change."""
        fact = lambda a, b: triage.fact_check({'oldText': a, 'newText': b, 'facts': ['page_number_only']})['page_number_only']
        for a, b in (('Schedule Page 1.1', 'Schedule Page 2.1'), ('Page 100,000', 'Page 200,000'),
                     ('Schedule Page 3 of 10,5', 'Schedule Page 3 of 11,5')):
            self.assertEqual(fact(a, b), 'contradicted', a)
        for a, b in (('Page 1 of 10', 'Page 2 of 10'), ('Page 3', 'Page 4')):
            self.assertEqual(fact(a, b), 'consistent', a)

    def test_a_date_roll_needs_real_dates(self):
        """PR #9 comment 6508226511: 29 February 2025 does not exist."""
        fact = lambda a, b: triage.fact_check({'oldText': a, 'newText': b, 'facts': ['dates_rolled_forward_one_year']})[
            'dates_rolled_forward_one_year']
        self.assertEqual(fact('29 February 2024 to 28 February 2025', '29 February 2025 to 28 February 2026'), 'contradicted')
        self.assertEqual(fact('01 April 2024 to 31 March 2025', '01 April 2025 to 31 March 2026'), 'consistent')
        # A day or year inside a longer number is no date, as the scorer reads dates (#10 4a12cd0).
        for x, y in (('1.21 April 2024 to 30 June 2024', '1.21 April 2025 to 30 June 2025'),
                     ('1 April 2024.5 to 30 June 2024', '1 April 2025.5 to 30 June 2025')):
            self.assertEqual(fact(x, y), 'contradicted', x)

    def test_stated_facts_are_rechecked_against_the_card_texts(self):
        cards = [card('w', 'Replaced', [(1, 'a', 'Limit  USD 5,000')], [(1, 'b', 'Limit USD 5,000')], facts=['whitespace_only']),
                 card('x', 'Replaced', [(1, 'c', 'per aircraft')], [(1, 'd', 'peraircraft')], facts=['whitespace_only']),
                 card('p', 'Replaced', [(1, 'e', 'Page 1 of 4')], [(1, 'f', 'Page 1 of 5')], facts=['page_number_only']),
                 card('q', 'Replaced', [(1, 'g', 'Limit 1%')], [(1, 'h', 'Limit 5%')], facts=['page_number_only']),
                 card('d', 'Replaced', [(1, 'i', 'PERIOD: 01 April 2024 to 31 March 2025')],
                      [(1, 'j', 'PERIOD: 01 April 2025 to 31 March 2026')], facts=['dates_rolled_forward_one_year'])]
        summary, _ = run([], result(cards))
        self.assertEqual(summary['facts']['stated'],
                         {'whitespace_only': 2, 'page_number_only': 2, 'dates_rolled_forward_one_year': 1})
        self.assertEqual(summary['facts']['contradicted'], [{'card': 'x', 'fact': 'whitespace_only'},
                                                            {'card': 'q', 'fact': 'page_number_only'}])

    def test_a_format_1_result_is_still_read_and_its_categories_are_not_evaluated(self):
        c = change(5, 'lim', 'Replaced', 'Limit USD350,000,000', 'Limit USD400,000,000',
                   [('USD350,000,000', 'USD400,000,000')], pages=(2, 2))
        old = card('d', 'Replaced', [(2, 'a', 'Limit USD350,000,000')], [(2, 'b', 'Limit USD400,000,000')])
        del old['facts']
        old['category'] = 'Cosmetic'
        summary, ev = run([c], dict(result([old]), schemaVersion='policy-compare/0.1.0'))
        self.assertEqual((ev['5']['verdict'], summary['resultFormat']), ('correct', 'policy-compare/0.1.0'))
        self.assertNotIn('categoryCheck', json.dumps(ev['5']))

    def test_excluded_events_keep_text_and_reason_and_never_count(self):
        ws = change(9, 'cov_2_3', 'Replaced', 'a  maximum', 'a maximum', [('a  maximum', 'a maximum')])
        summary, ev = run([ws], result([]))
        self.assertEqual(summary['scored'], 0)
        self.assertEqual(summary['verdicts'], {})
        self.assertEqual(summary['excluded'][0]['id'], '9')
        self.assertEqual(summary['excluded'][0]['edits'][0]['old'], 'a  maximum')
        self.assertIn('whitespace', summary['excluded'][0]['reason'])

    def test_page_furniture_is_listed_not_silently_filtered(self):
        h = change('H2', 'page_furniture', 'Header', 'CLW0100862', 'CLW0100933', [('CLW0100862', 'CLW0100933')],
                   category='RollForward')
        h['left_pages'], h['right_pages'] = [1, 2], [1, 2]
        body = change(1, 'brokerage', 'Replaced', 'BROKERAGE 15.00%', 'BROKERAGE 12.50%', [('15.00%', '12.50%')])
        barcode = card('b', 'Replaced', [(2, 'f', 'C L W 0 1 0 0 8 6 2')], [(2, 'g', 'C L W 0 1 0 0 9 3 3')])
        summary, ev = run([h, body], result([barcode]))
        self.assertEqual((summary['bodyEvents'], summary['pageFurnitureEvents']), (1, 1))
        self.assertEqual(ev['H2']['scope'], 'page_furniture')
        self.assertEqual(ev['H2']['verdict'], 'not_evaluable')
        self.assertEqual(ev['H2']['bodyCardsWithText'], 1)
        self.assertEqual((summary['pageFurnitureCards'], summary['unexplainedCards']), (1, 0))


class Cli(unittest.TestCase):
    def test_compatible_invocation(self):
        c = change(5, 'lim', 'Replaced', 'Limit USD350,000,000', 'Limit USD400,000,000',
                   [('USD350,000,000', 'USD400,000,000')], pages=(2, 2))
        res = result([card('d', 'Replaced', [(2, 'a', 'Limit USD350,000,000')], [(2, 'b', 'Limit USD400,000,000')])])
        with tempfile.TemporaryDirectory() as d:
            cp, rp, ep = (os.path.join(d, n) for n in ('c.json', 'r.json', 'e.json'))
            json.dump({'changes': [c]}, open(cp, 'w'))
            json.dump(res, open(rp, 'w'))
            out = subprocess.run([sys.executable, SCRIPT, cp, rp, '--events', ep], capture_output=True, text=True,
                                 check=True).stdout
            summary, events = json.loads(out), json.load(open(ep))
        self.assertEqual(summary['outcomes'], {'complete': 1})
        self.assertEqual(summary['verdicts'], {'correct': 1})
        self.assertEqual(events[0]['atoms'], ['same_card'])
        self.assertEqual(events[0]['atomEvidence'][0]['candidates'][0]['left'][0]['unitId'], 'a')
        self.assertNotIn('charIds', events[0]['atomEvidence'][0]['candidates'][0]['left'][0])


if __name__ == '__main__':
    unittest.main()
