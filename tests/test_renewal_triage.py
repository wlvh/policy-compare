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
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, 'scripts', 'renewal-triage.py')
spec = importlib.util.spec_from_file_location('renewal_triage', SCRIPT)
triage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(triage)


def loc(side, page, unit, text):
    return {'side': side, 'pageIndex': page - 1, 'unitId': unit, 'rawRange': [0, len(text)], 'charIds': ['c'],
            'text': text, 'quads': [[0, 0, 1, 0, 0, 1, 1, 1]], 'direction': [1, 0], 'precision': 'native'}


def ops(left, right):
    """Text operations as the product reports them: the common prefix and suffix are equal, the rest
    is deleted and inserted, and each part keeps the source units its characters come from."""
    def chars(cells):
        out = []
        for i, (page, unit, text) in enumerate(cells):
            out += ([(' ', (page, unit))] if i else []) + [(c, (page, unit)) for c in text]
        return out

    def locs(side, part):
        out = []
        for c, (page, unit) in part:
            if out and (out[-1]['pageIndex'] + 1, out[-1]['unitId']) == (page, unit):
                out[-1] = loc(side, page, unit, out[-1]['text'] + c)
            else:
                out.append(loc(side, page, unit, c))
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


def card(id, kind, left=(), right=(), category='Material', row_key=None, table=None, confidence='candidate'):
    """left/right: (page, unitId, text) cells in reading order."""
    old, new = ' '.join(c[2] for c in left), ' '.join(c[2] for c in right)
    return {'id': id, 'kind': kind, 'category': category,
            'structurePath': {'section': 'clauses', 'entity': None, 'field': None, 'table': table,
                              'rowKey': row_key, 'confidence': confidence},
            'left': [loc('left', *c) for c in left], 'right': [loc('right', *c) for c in right],
            'oldText': old, 'newText': new, 'hasTextChange': old != new, 'textOps': ops(left, right)}


def group(left=(), right=()):
    return {'reason': 'ambiguous_match', 'message': 'm', 'defaultVisible': True,
            'left': [loc('left', *c) for c in left], 'right': [loc('right', *c) for c in right]}


def result(diffs, unresolved=()):
    return {'status': 'complete_for_scope', 'coreVersion': 'test', 'extractors': [{'version': 't'}] * 2,
            'differences': list(diffs), 'unresolved': list(unresolved)}


def change(id, block, kind, left='', right='', edits=(), pages=(1, 1), category='Material'):
    return {'id': id, 'block': block, 'kind': kind, 'category': category, 'notes': [''],
            'edits': [{'old': e[0], 'new': e[1], **({'category': e[2]} if len(e) > 2 else {})} for e in edits],
            'left_text': left, 'right_text': right,
            'left_pages': [pages[0]] if pages[0] else [], 'right_pages': [pages[1]] if pages[1] else []}


def run(changes, res):
    with tempfile.TemporaryDirectory() as d:
        cp, rp, ep = (os.path.join(d, n) for n in ('changes.json', 'result.json', 'events.json'))
        with open(cp, 'w') as f:
            json.dump({'changes': changes}, f)
        with open(rp, 'w') as f:
            json.dump(res, f)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            triage.main(cp, rp, ep)
        with open(ep) as f:
            events = json.load(f)
    return json.loads(out.getvalue()), {e['id']: e for e in events}


ROW_1315 = ('ATR 72-600 | 1315 | CS-BTE | 2012 | 20,490,000 | Cobalt',
            'ATR 72-600 | 1315 | CS-BTE | 2012 | 19,210,000 | Cobalt')
VALUE = [('20,490,000', '19,210,000')]


def row_card(id, msn, reg, old='20,490,000', new='19,210,000', row_key=None, units=('a', 'b')):
    cells = lambda v: [(11, units[0], 'ATR 72-600'), (11, units[0], msn), (11, units[0], reg), (11, units[0], v)]
    right = [(11, units[1], t) for _, _, t in cells(new)]
    return card(id, 'Replaced', cells(old), right, row_key=row_key, table='recovered_rows')


class RecordIdentity(unittest.TestCase):
    def test_identity_comes_from_author_ids_not_unchanged_values(self):
        ident = triage.expected_identity(change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE))
        self.assertEqual(ident, {'cells': ['1315'], 'source': 'author_block_id'})
        # The first unchanged cells are a percentage and a date: never used as identity.
        ident = triage.expected_identity(change(1, 'wl_x', 'Replaced', '15.0% | 03/10/2024 | MKV 1426 | 24AV0381',
                                                '15.0% | 03/10/2024 | MKV 1426 | 25AV0412'))
        self.assertEqual(ident, {'cells': ['MKV 1426'], 'source': 'identifier_like_cell'})
        ident = triage.expected_identity(change(1, 'cp_M-FNKB_Selwyn', 'Replaced', 'M-FNKB | Selwyn Ltd | AVN67B',
                                                'M-FNKB | Selwyn Ltd | AVN67C'))
        self.assertEqual(ident['cells'], ['M-FNKB', 'Selwyn Ltd'])
        self.assertIsNone(triage.expected_identity(change(1, 'premium', 'Replaced', 'USD 1', 'USD 2')))

    def test_unchanged_value_cells_do_not_confirm_a_row(self):
        c = change(1, 'wl_x', 'Replaced', '15.0% | 03/10/2024 | MKV 1426 | 24AV0381',
                   '15.0% | 03/10/2024 | MKV 1426 | 25AV0412', [('24AV0381', '25AV0412')], pages=(8, 8))
        wrong = card('w', 'Replaced', [(8, 'a', '15.0% 03/10/2024 HPX 0624 24AV0381')],
                     [(8, 'b', '15.0% 03/10/2024 HPX 0624 25AV0412')])
        summary, ev = run([c], result([wrong]))
        self.assertNotEqual(ev['1']['verdict'], 'correct')
        self.assertEqual(ev['1']['atoms'], ['same_card_identity_unconfirmed'])

    def test_correct_amount_on_the_wrong_record_is_misattributed(self):
        events = [change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11)),
                  change(48, 'ac_1760', 'Removed', 'ATR 72-600 | 1760 | ZK-ENV | 2013', pages=(11, 0))]
        by_key = row_card('k', '1760', 'ZK-ENV', row_key='1760')
        _, ev = run(events[:1], result([by_key]))
        self.assertEqual(ev['52']['verdict'], 'misattributed')
        # Without a rowKey, another record's identity in the same unit is the contradiction.
        by_unit = row_card('u', '1760', 'ZK-ENV')
        _, ev = run(events, result([by_unit]))
        self.assertEqual(ev['52']['verdict'], 'misattributed')
        self.assertEqual(ev['52']['acceptedCards'], [])
        # The removed row 1760 shown as a modified row is not its removal either.
        self.assertEqual(ev['48']['verdict'], 'misattributed')
        self.assertEqual(ev['48']['acceptedCards'], [])

    def test_one_correct_card_plus_a_misattributed_one_is_not_complete(self):
        good, bad = row_card('g', '1315', 'CS-BTE', row_key='1315'), row_card('x', '1760', 'ZK-ENV', row_key='1760')
        summary, ev = run([change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11))], result([good, bad]))
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
        summary, ev = run(events, result(cards))
        self.assertEqual((ev['52']['verdict'], ev['53']['verdict']), ('correct', 'correct'))
        self.assertEqual((ev['52']['acceptedCards'], ev['53']['acceptedCards']), (['a'], ['b']))
        self.assertEqual(summary['unexplainedCards'], 0)

    def test_value_correct_and_full_row_are_reported_separately(self):
        partial = card('p', 'Replaced', [(11, 'a', '1315 CS-BTE 20,490,000')], [(11, 'b', '1315 CS-BTE 19,210,000')])
        summary, ev = run([change(52, 'ac_1315', 'Replaced', *ROW_1315, VALUE, pages=(11, 11))], result([partial]))
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
        _, ev = run([change(52, 'ac_1315', 'Replaced', *self.LONG, VALUE, pages=(11, 11))], result([whole]))
        self.assertEqual(ev['52']['verdict'], 'correct')
        self.assertTrue(ev['52']['row']['fullRowRecovered'])

    def test_a_cell_only_in_another_unit_of_the_card_does_not_complete_the_row(self):
        name = 'Kestrel Regional Airways Holdings Limited (Operator and Lessee)'
        split = card('s', 'Replaced', [(11, 'a', 'ATR 72-600 1315 20,490,000'), (11, 'c', name)],
                     [(11, 'b', 'ATR 72-600 1315 19,210,000'), (11, 'd', name)])
        _, ev = run([change(52, 'ac_1315', 'Replaced', *self.LONG, VALUE, pages=(11, 11))], result([split]))
        self.assertEqual(ev['52']['verdict'], 'correct')
        self.assertFalse(ev['52']['row']['fullRowRecovered'])
        self.assertEqual([r['unitId'] for r in ev['52']['row']['acceptedRecord']['left']], ['a'])


class MovedIsNotAddedOrRemoved(unittest.TestCase):
    """Review of PR #11 (fixed in #9): a card that keeps the text on both sides,
    such as an unchanged move, neither adds nor removes it."""
    TEXT = 'Proof of Loss: The Insured shall provide Underwriters with complete documentation.'

    def test_unchanged_move_is_not_a_removal(self):
        moved = card('m', 'Moved', [(4, 'a', self.TEXT)], [(5, 'b', self.TEXT)], category='Review')
        summary, ev = run([change(30, 'pol', 'Removed', left=self.TEXT, pages=(4, 0))], result([moved]))
        self.assertNotEqual(ev['30']['verdict'], 'correct')
        self.assertEqual(ev['30']['acceptedCards'], [])
        self.assertEqual((summary['acceptedCards'], summary['unexplainedCards']), (0, 1))

    def test_unchanged_move_is_not_an_addition(self):
        moved = card('m', 'Moved', [(4, 'a', self.TEXT)], [(5, 'b', self.TEXT)], category='Review')
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
            'same card, unchanged move': ([self.EDIT], [card('m', 'Moved', [(1, 'a', self.PARA)], [(1, 'b', self.PARA)],
                                                              category='Review')]),
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
                summary, ev = run(events, result(cards))
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
                'r', 'Replaced', [(1, 'a', 'Hull USD 100 applies; liability USD 100.')],
                [(1, 'b', 'Hull USD 200 applies; liability USD 100.')])], 'correct', ['r']),
            'same card, right record': (self.ROW, [card('r', 'Replaced', [(1, 'a', 'ATR 72-600 1315 USD 100')],
                                                        [(1, 'b', 'ATR 72-600 1315 USD 200')], row_key='1315')],
                                        'correct', ['r']),
            'split, removed and added': (self.EDIT, [card('o', 'Removed', [(1, 'a', 'Hull USD 100 applies.')]),
                                                     card('n', 'Added', right=[(1, 'b', 'Hull USD 200 applies.')])],
                                         'split_attributable', ['n', 'o']),
            # An author move without an edit is still met by the unchanged move on the stated pages.
            'author move, unchanged move': (moved, [card('m', 'Moved', [(1, 'a', self.PARA)], [(2, 'b', self.PARA)],
                                                         category='Review')], 'correct', ['m']),
            'insertion only': (insert, [card('i', 'Replaced', [(1, 'a', 'The insurer pays approved losses.')],
                                             [(1, 'b', 'The insurer pays approved covered losses.')])], 'correct', ['i']),
        }
        for name, (event, cards, verdict, accepted) in edited.items():
            with self.subTest(name):
                summary, ev = run([event], result(cards))
                e = ev[str(event['id'])]
                self.assertEqual((e['verdict'], e['acceptedCards']), (verdict, accepted))
                self.assertEqual(summary['unexplainedCards'], 0)


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

    def test_cells_must_share_one_record(self):
        whole = card('w', 'Added', right=[(11, 'u1', t) for t in ('Airbus A220', '55228', 'VH-JXP', '39,000,000')])
        _, ev = run([self.ADDED], result([whole]))
        self.assertEqual(ev['63']['verdict'], 'correct')
        self.assertTrue(ev['63']['row']['fullRowRecovered'])

    def test_cells_scattered_over_different_records_are_not_complete(self):
        ident = card('i', 'Added', right=[(11, 'u1', '55228'), (11, 'u1', 'VH-JXP')])
        other = card('o', 'Added', right=[(11, 'u2', 'Airbus A220'), (11, 'u2', '39,000,000')])
        _, ev = run([self.ADDED], result([ident, other]))
        self.assertNotEqual(ev['63']['verdict'], 'correct')
        self.assertNotEqual(ev['63']['outcome'], 'complete')
        self.assertEqual(ev['63']['atoms'], ['outside_record', 'in_record', 'in_record', 'outside_record'])

    def test_row_inside_another_records_card(self):
        neighbour = ('Airbus A320', '40001', 'VH-AAA')
        merged = card('m', 'Replaced', [(11, 'u0', t) for t in neighbour],
                      [(11, 'u1', t) for t in (*neighbour, 'Airbus A220', '55228', 'VH-JXP', '39,000,000')])
        _, ev = run([self.ADDED], result([merged]))
        self.assertEqual((ev['63']['verdict'], ev['63']['atoms'][0]), ('not_evaluable', 'merged_into_neighbour_card'))
        paired = card('p', 'Replaced', [(11, 'u0', t) for t in neighbour],
                      [(11, 'u1', t) for t in ('Airbus A220', '55228', 'VH-JXP', '39,000,000')])
        _, ev = run([self.ADDED], result([paired]))
        self.assertEqual((ev['63']['verdict'], ev['63']['atoms'][0]), ('misattributed', 'paired_with_other_record'))

    def test_cells_without_any_record_identity_are_not_evaluable(self):
        a = card('a', 'Added', right=[(11, 'u1', 'Airbus A220'), (11, 'u1', 'VH-JXP')])
        b = card('b', 'Added', right=[(11, 'u2', '39,000,000')])
        _, ev = run([self.ADDED], result([a, b]))
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
        _, ev = run([c], result([rem, add]))
        self.assertEqual(ev['73']['verdict'], 'split_attributable')
        lone = card('a', 'Added', right=[(15, 'b', 'Desert Falcon Hangars')])
        _, ev = run([c], result([rem, lone]))
        self.assertEqual((ev['73']['verdict'], ev['73']['atoms']), ('not_evaluable', ['separate_cards']))


class CategoriesExclusionsFurniture(unittest.TestCase):
    def test_each_atom_keeps_its_own_category(self):
        c = change(32, 'ppc', 'Replaced', 'Premium due 15th December 2024 per LSW3001 – Premium Payment Clause.',
                   'Premium due 15th December 2025 per LSW3001 - Premium Payment Clause.',
                   [('15th December 2024', '15th December 2025', 'Material'),
                    ('LSW3001 – Premium', 'LSW3001 - Premium', 'Material')], pages=(6, 6))
        cards = [card('m', 'Replaced', [(6, 'a', '15th December 2024')], [(6, 'b', '15th December 2025')]),
                 card('c', 'Replaced', [(6, 'c', 'LSW3001 – Premium')], [(6, 'd', 'LSW3001 - Premium')],
                      category='Cosmetic')]
        _, ev = run([c], result(cards))
        e = ev['32']
        self.assertEqual(e['bestProductCategory'], 'Material')
        self.assertEqual([a['category'] for a in e['atomEvidence']], ['Material', 'Cosmetic'])
        self.assertEqual([a['categoryCheck'] for a in e['atomEvidence']], ['consistent', 'downgraded'])

    def test_excluded_events_keep_text_and_reason_and_never_count(self):
        ws = change(9, 'cov_2_3', 'Replaced', 'a  maximum', 'a maximum', [('a  maximum', 'a maximum')],
                    category='Cosmetic')
        summary, ev = run([ws], result([]))
        self.assertEqual(summary['scored'], 0)
        self.assertEqual(summary['verdicts'], {})
        self.assertEqual(summary['excluded'][0]['id'], '9')
        self.assertEqual(summary['excluded'][0]['edits'][0]['old'], 'a  maximum')
        self.assertIn('whitespace', summary['excluded'][0]['reason'])

    def test_author_roll_forward_is_kept_apart_from_policy_period(self):
        period = change(3, 'period', 'Replaced', 'From 1 June 2024 to 31 May 2025', 'From 1 June 2025 to 31 May 2026',
                        [('1 June 2024 to 31 May 2025', '1 June 2025 to 31 May 2026')], category='RollForward')
        umr = change(1, 'umr', 'Replaced', 'UMR B0731K24', 'UMR B0731K25', [('B0731K24', 'B0731K25')],
                     category='RollForward')
        cards = [card('p', 'Replaced', [(1, 'a', 'From 1 June 2024 to 31 May 2025')],
                      [(1, 'b', 'From 1 June 2025 to 31 May 2026')]),
                 card('u', 'Replaced', [(1, 'c', 'UMR B0731K24')], [(1, 'd', 'UMR B0731K25')])]
        summary, ev = run([period, umr], result(cards))
        self.assertEqual(summary['rollForward']['author'], ['3', '1'])
        self.assertEqual([p['id'] for p in summary['rollForward']['policyPeriod']], ['3'])
        # A policy-period roll-forward shown as Material is an over-alert, not a hidden change.
        self.assertEqual(ev['3']['atomEvidence'][0]['categoryCheck'], 'upgraded')
        self.assertEqual(ev['1']['atomEvidence'][0]['categoryCheck'], 'outside_product_roll_forward_definition')

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
