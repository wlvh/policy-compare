# Saved from the issue-2 session scratch directory at handoff. OUT/scratch defaults to tmp/issue-2-chain
# (ignored by git); set NODE_ENV_SH to a file that puts Node 24 on PATH if the default node is older.
# Distinct failing test methods per before-fix triage run (subtests counted once).
import re, sys, glob, os
d = sys.argv[1]
for f in sorted(glob.glob(os.path.join(d, 'triage-on-*.txt')), key=os.path.getmtime):
    names = set()
    for l in open(f):
        m = re.match(r'^(FAIL|ERROR): (\S+) \(([^)]+)\)', l)
        if m: names.add(m.group(3))
    print(os.path.basename(f)[10:-4], len(names), sorted(n.split('.')[-1] for n in names) if len(names) < 4 else '')
