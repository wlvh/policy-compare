# Saved from the issue-2 session scratch directory at handoff. OUT/scratch defaults to tmp/issue-2-chain
# (ignored by git); set NODE_ENV_SH to a file that puts Node 24 on PATH if the default node is older.
# Compare two retriage.json files by their changed events (verdict, accepted cards, full row).
import json, sys
def flat(p):
    x = json.load(open(p)); out = []
    for r in x['runs']:
        for c in r['changedEvents']:
            out.append(json.dumps([r['set'], r['case'], r['engine'], c], sort_keys=True, ensure_ascii=False))
    return x['newScript']['rev'][:7], sorted(out)
(ra, a), (rb, b) = flat(sys.argv[1]), flat(sys.argv[2])
print(ra, len(a), '|', rb, len(b), '| same' if a == b else '| DIFF')
