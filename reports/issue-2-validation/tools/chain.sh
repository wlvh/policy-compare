#!/usr/bin/env bash
# Saved from the issue-2 session scratch directory at handoff. OUT/scratch defaults to tmp/issue-2-chain
# (ignored by git); set NODE_ENV_SH to a file that puts Node 24 on PATH if the default node is older.
# Final chain on the committed HEAD: two-engine gates, renewal + triage, text-operation
# listing, rule records, before-fix tests (product and triage), and the re-triage of the
# 32 stored results (/9 -> current). Nothing in the working tree may change while it runs.
set -u
S=${S:-$PWD/tmp/issue-2-chain}; T=reports/issue-2-validation/tools; mkdir -p "$S"
cd "$(git rev-parse --show-toplevel)"
[ -n "${NODE_ENV_SH:-}" ] && source "$NODE_ENV_SH"
R=$(pwd); rev=$(git rev-parse HEAD); P=reports/issue-2-validation; N=$P/$rev
echo "head $rev"
bash $T/gates.sh $S/gates-$rev > $S/gates-$rev.log 2>&1; echo "gates $?"
bash $P/run-renewal.sh > $S/renewal-$rev.log 2>&1; echo "renewal $?"
python3 $P/textops-diff.py $P/dabc8c2a024e8714cdc71fc0a47ba7e11ab23673 $N $N/textops-diff.md; echo "textops $?"
mkdir -p $N/regression && cp $S/gates-$rev/* $N/regression/
mkdir -p $N/rules-format2
for e in mupdf pdfjs; do pnpm exec tsx $P/rules-format2.ts $e $P/80af5b1bcd752e95886f0c98c4494b91f778cd9d/regression/rules-$e.json $N/rules-format2/rules-format2-$e.json; done > $S/rf2-$rev.log 2>&1; echo "rules-format2 $?"
B=$S/bf-$rev; rm -rf $B; mkdir -p $B
for old in dabc8c2 437e9f3; do
  rm -rf tmp/wt-before && git worktree add -q --detach tmp/wt-before $rev && (cd tmp/wt-before && git checkout -q $old -- packages apps scripts/renewal-triage.py && ln -s $R/node_modules node_modules && for d in packages/*/; do [ -d $R/$d/node_modules ] && ln -sfn $R/$d/node_modules $d/node_modules; done; { echo "# final tests ($rev) with product, interface, contract and triage code of $old"; npx vitest run --outputFile=/dev/null 2>&1 | grep -E "^ *×|Tests |Test Files"; } > $B/verify-core-on-$old.txt); git worktree remove --force tmp/wt-before; echo "before-fix product $old: $(tail -1 $B/verify-core-on-$old.txt)"
done
for old in dabc8c2 367020b b0f41cb d1ce767 6b29460 aeaec53 e4b9dfd 8f63087 c14276c be1ed04 441a81d 4f38eda ce7df65 72eb95f cc99133 5410ae8 9e9104f 99d521c 3527ab2 c5a5330 81048e3 cc4dc8d 081f370 8bf16df; do
  T=$S/bft/$old; rm -rf $T; mkdir -p $T/scripts $T/tests; git show $old:scripts/renewal-triage.py > $T/scripts/renewal-triage.py; cp tests/test_renewal_triage.py $T/tests/
  v=$(grep "^TOOL" $T/scripts/renewal-triage.py | grep -o "renewal-triage/[0-9]*")
  { echo "# final triage tests ($rev) with scripts/renewal-triage.py of $old ($v)"; (cd $T && timeout 600 python3 -m unittest discover -s tests -p 'test_renewal_triage.py' 2>&1 | grep -E "^FAIL:|^ERROR:|^Ran|^OK|^FAILED"); } > $B/triage-on-$old.txt
  echo "before-fix triage $old: $(tail -1 $B/triage-on-$old.txt)"
done
python3 $P/retriage.py tmp/renewal-inputs $S/retriage-$rev 2b9c225 v3-85dae98=reports/v3-review/results \
  eec627f=$P/eec627f1a8ceb6bc62d7bf273d8c031989b798fa 6e6b541=$P/6e6b54176803534c316a353d6bb76d87bdf03015 \
  ee0f0a5=$P/ee0f0a5f259b2cff43b27a16fc8af57f3bd22f59 60bf50c=$P/60bf50c7d7ee292fd0b538d41a090a3e17ea1497 \
  80af5b1=$P/80af5b1bcd752e95886f0c98c4494b91f778cd9d 9ccc044=$P/9ccc044678487bc44a77e1bf15ac601ae11edfc5 \
  dabc8c2=$P/dabc8c2a024e8714cdc71fc0a47ba7e11ab23673 > $S/retriage-$rev.log 2>&1; echo "retriage $?"
echo "chain done"
