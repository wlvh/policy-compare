"""Time allocate() on n identical cells over n-1 occurrences, with a per-call limit. Usage: probe.py <dir> <n>..."""
import importlib.util, sys, time
spec = importlib.util.spec_from_file_location('triage', sys.argv[1] + '/scripts/renewal-triage.py')
tri = importlib.util.module_from_spec(spec); spec.loader.exec_module(tri)
for n in map(int, sys.argv[2:]):
    t0 = time.time(); r = tri.allocate(['0'] * n, ' '.join(['0'] * (n - 1))); dt = time.time() - t0
    print(f'allocate {n} cells "0" over {n - 1} occurrences: {dt:.4f}s, {len(r) if hasattr(r, "__len__") else r} placed')
