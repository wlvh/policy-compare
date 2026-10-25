#!/usr/bin/env python3
"""Optional visual QA: render every fixture page with Poppler and make contact sheets."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parent


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dataset",type=Path,default=ROOT/"dataset")
    p.add_argument("--output",type=Path,default=ROOT/"qa")
    args=p.parse_args()
    if not shutil.which("pdftoppm"):
        raise SystemExit("Install Poppler (pdftoppm) to run optional visual QA.")
    manifest=json.loads((args.dataset/"manifest.json").read_text())
    render_dir=args.output/"rendered_pages"
    render_dir.mkdir(parents=True,exist_ok=True)
    jobs=[]
    for case in manifest["cases"]:
        for side in ("before","after"):
            jobs.append((case,side))
    def render(job):
        case,side=job
        prefix=render_dir/(case["case_id"]+"_"+side)
        pdf=args.dataset/"cases"/case["case_id"]/(side+".pdf")
        subprocess.run(["pdftoppm","-r","72","-png",str(pdf),str(prefix)],
                       check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        paths=sorted(render_dir.glob(prefix.name+"-*.png"),
                     key=lambda p:int(p.stem.rsplit("-",1)[1]))
        if len(paths)!=case["page_counts"][side]:
            raise RuntimeError("Rendered page count mismatch: "+str(pdf))
        return [(case["case_id"],side,i,path) for i,path in enumerate(paths)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages=[item for group in pool.map(render,jobs) for item in group]
    font=ImageFont.truetype(str(ROOT/"assets"/"DejaVuSans.ttf"),13)
    sheets=[]
    cell_w,cell_h=250,388
    for start in range(0,len(pages),16):
        sheet=Image.new("RGB",(cell_w*4,cell_h*4),"#dbe3ea")
        draw=ImageDraw.Draw(sheet)
        for j,(case,side,page,path) in enumerate(pages[start:start+16]):
            x=(j%4)*cell_w;y=(j//4)*cell_h
            im=Image.open(path).convert("RGB")
            thumb=ImageOps.contain(im,(cell_w-14,cell_h-52))
            sheet.paste(thumb,(x+(cell_w-thumb.width)//2,y+41))
            draw.text((x+7,y+4),case[:29],font=font,fill="#172c40")
            draw.text((x+7,y+21),side+" / page "+str(page+1),font=font,fill="#172c40")
        out=args.output/f"contact_{start//16+1:02d}.png"
        sheet.save(out)
        sheets.append(str(out))
    (args.output/"render_manifest.json").write_text(json.dumps({
        "renderer":"Poppler pdftoppm at 72 dpi",
        "pages_rendered":len(pages),"contact_sheets":sheets,
        "visual_review_is_separate_from_programmatic_fixture_checks":True,
    },indent=2)+"\n")
    print(json.dumps({"pages":len(pages),"contact_sheets":sheets}))


if __name__=="__main__":
    main()
