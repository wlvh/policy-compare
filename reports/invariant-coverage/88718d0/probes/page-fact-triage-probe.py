"""PR #9 comment 6519605001 (the user's): the triage's page_number_only check on the texts of Codex
r4421658769, against the scorer's reading since 733abbe (contradicted, or undecided for a spaced
currency). Usage: probe.py <dir with tests/ and scripts/>"""
import importlib.util, sys
spec = importlib.util.spec_from_file_location('triage', sys.argv[1] + '/scripts/renewal-triage.py')
triage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(triage)
for name, a, b in (('per-page amount', 'Premium per page 100USD', 'Premium per page 200USD'),
                   ('percentage', 'Page 10%', 'Page 20%'),
                   ('currency sign', 'Cost per page 100€', 'Cost per page 200€'),
                   ('percentage as the total', 'Page 3 of 10%', 'Page 3 of 11%'),
                   ('currency after a space (scorer: undecided)', 'Cost per page 100 USD', 'Cost per page 200 USD'),
                   ('control: Page 3 of 10 -> Page 4 of 10', 'Page 3 of 10', 'Page 4 of 10')):
    print(f'{name}: {a!r} -> {b!r}: {triage.fact_check({"oldText": a, "newText": b, "facts": ["page_number_only"]})["page_number_only"]}')
