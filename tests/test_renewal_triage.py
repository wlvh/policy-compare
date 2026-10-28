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


def card(id, kind, left=(), right=(), category='Material', row_key=None, table=None, confidence='candidate'):
    """left/right: (page, unitId, text) cells in reading order."""
    return {'id': id, 'kind': kind, 'category': category,
            'structurePath': {'section': 'clauses', 'entity': None, 'field': None, 'table': table,
                              'rowKey': row_key, 'confidence': confidence},
            'left': [loc('left', *c) for c in left], 'right': [loc('right', *c) for c in right],
            'oldText': ' '.join(c[2] for c in left), 'newText': ' '.join(c[2] for c in right)}


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
