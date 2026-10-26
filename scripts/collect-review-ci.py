"""Collect actual Linux CI evidence for an explicitly frozen product revision."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
run_id=sys.argv[1]
product=sys.argv[2] if len(sys.argv)>2 else subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
product=subprocess.check_output(['git','rev-parse',product],cwd=ROOT,text=True).strip()
repo='wlvh/policy-compare'
def gh(*args):return subprocess.check_output(['gh',*args,'--repo',repo],cwd=ROOT,text=True)
meta=json.loads(gh('run','view',run_id,'--json','databaseId,headSha,status,conclusion,url,event,jobs'))
assert meta['status']=='completed','Wait for the actual workflow to complete.'
assert meta['headSha']==product,'The CI head must be the named frozen product, not a different revision.'
out=ROOT/'reports/ci-review-fixes'/run_id;out.mkdir(parents=True,exist_ok=True)
(out/'run.json').write_text(json.dumps(meta,indent=2)+'\n')
(out/'run.log').write_text(gh('run','view',run_id,'--log'))
subprocess.run(['gh','run','download',run_id,'--repo',repo,'--dir',str(out/'artifacts')],cwd=ROOT,check=True)
def read_one(pattern):
    found=list((out/'artifacts').rglob(pattern));assert len(found)==1,(pattern,len(found));return json.loads(found[0].read_text())
tested_refs=[];functional={};container_status={}
expected_tree=subprocess.check_output(['git','rev-parse',product+'^{tree}'],cwd=ROOT,text=True).strip()
for engine in ['pdfjs','mupdf']:
    env=read_one('ci-environment-'+engine+'.json');tested_refs.append(env['commit'])
    tree=subprocess.check_output(['gh','api',f'repos/{repo}/git/commits/{env["commit"]}','--jq','.tree.sha'],cwd=ROOT,text=True).strip()
    assert tree==expected_tree,'CI test merge tree differs from the review head.'
    browser=read_one('browser-tests-'+engine+'.json');rules=read_one('rules-'+engine+'.json');review=read_one('review-regressions-'+engine+'.json');browser_review=read_one('browser-review-regressions-'+engine+'.json');container=read_one('container-'+engine+'.json')
    functional[engine]={'rules':rules['status'],'browserStats':browser['stats'],'reviewPdf':review['status'],'reviewBrowser':browser_review['status'],'environment':env}
    container_status[engine]=container['status']
summary={'productRevision':product,'runId':int(run_id),'runUrl':meta['url'],'status':'PASS' if meta['conclusion']=='success' else 'FAIL','treeEquality':'PASS','productTree':expected_tree,'testMergeRefs':sorted(set(tested_refs)),'containerStatus':container_status,'functional':functional,'scope':'Linux functional and container checks; not target-device browser performance','jobs':[{k:j[k] for k in ['name','status','conclusion']} for j in meta['jobs']],'files':{str(p.relative_to(ROOT)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(out.rglob('*')) if p.is_file()}}
(ROOT/'reports/ci-review-fixes.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['productRevision','runUrl','status','treeEquality','containerStatus','functional']},ensure_ascii=False,indent=2))
