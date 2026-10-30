"""Codex PR #11 comment 6513158877, triage side: fact_check() on dates_rolled_forward_one_year with partial day or
year numbers. Usage: probe.py <dir with scripts/>"""
import importlib.util, sys
spec = importlib.util.spec_from_file_location('triage', sys.argv[1] + '/scripts/renewal-triage.py')
t = importlib.util.module_from_spec(spec); spec.loader.exec_module(t)
cases = [('year 20240 -> 20250', '1 January 20240 to 31 December 20240', '1 January 20250 to 31 December 20250'),
         ('day 121', '121 January 2024 to 31 December 2024', '121 January 2025 to 31 December 2025'),
         ('year 2024.5', '1 January 2024.5 to 31 December 2024', '1 January 2025.5 to 31 December 2025'),
         ('control: whole dates', '1 January 2024 to 31 December 2024', '1 January 2025 to 31 December 2025')]
for name, old, new in cases:
    print(f'{name}: {t.fact_check({"oldText": old, "newText": new, "facts": ["dates_rolled_forward_one_year"]})}')
