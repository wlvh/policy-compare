"""Codex PR #11 comment 6509987949: fact_check() reads page numbers without whole-number boundaries.
Usage: probe.py <dir with scripts/>"""
import importlib.util, sys
spec = importlib.util.spec_from_file_location('triage', sys.argv[1] + '/scripts/renewal-triage.py')
tri = importlib.util.module_from_spec(spec); spec.loader.exec_module(tri)
for old, new in (('Page 1.1', 'Page 2.1'), ('Page 100,000', 'Page 200,000'), ('Schedule Page 3 of 10,5', 'Schedule Page 3 of 11,5'),
                 ('Page 1 of 10', 'Page 2 of 10'), ('Page 3', 'Page 4')):
    print(f'{old!r} -> {new!r}: page_number_only {tri.fact_check({"oldText": old, "newText": new, "facts": ["page_number_only"]})["page_number_only"]}')
