"""Independent synthetic reading task; the product never reads this source."""
from pathlib import Path
import hashlib,json
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT=Path(__file__).resolve().parent
def filler(label,n):
    return ' '.join(f'The {label} condition {i+1} remains in force during the policy period for approved operations.' for i in range(n))+' '
def paragraph(amount,days):
    return filler('general',9)+f'The limit shall not exceed USD {amount} for any claim, provided the written notice has been received. '+filler('written',8)+f'The office must receive the report within {days} days after the event. '+filler('final',6)
def wrapped(text):
    words=text.split(); lines=[]
    while words:
        line=[]
        while words and stringWidth(' '.join(line+[words[0]]),'Helvetica',10)<=510:
            line.append(words.pop(0))
        # Avoid a sentence-ending wrap so the paragraph stays continuous.
        if words and len(line)>1 and line[-1].endswith(('.',':',';','!','?')): words.insert(0,line.pop())
        lines.append(' '.join(line))
    return lines
records={}
for name,amount,days,fee,pages in [('before','1,000,000','30','100',2),('after','1,500,000','45','150',3)]:
    target=ROOT/f'{name}.pdf'; c=canvas.Canvas(str(target),pagesize=(600,850),invariant=1); fragments={}
    for page in range(pages):
        c.setFont('Helvetica-Bold',13);c.drawString(42,810,'SYNTHETIC REVIEW FLOW - NO REAL POLICY')
        if page==0:
            c.setFont('Helvetica',10); y=776
            for line in wrapped(paragraph(amount,days)):
                for key,word in [('amount','USD '+amount),('days',days+' days')]:
                    if word in line:
                        x=42+stringWidth(line[:line.index(word)],'Helvetica',10)
                        fragments[key]={'pageIndex':0,'text':word,'region':[x,850-y-12,x+stringWidth(word,'Helvetica',10),850-y+4]}
                c.drawString(42,y,line);y-=14
            assert y>190,y
            c.drawString(42,150,f'Administration charge: USD {fee}')
        else:
            c.setFont('Helvetica',10);c.drawString(42,760,'The remaining terms are unchanged.')
        c.setFont('Helvetica',9);c.drawString(42,35,'REVIEW COPY - CHECK THE ORIGINAL SOURCES')
        c.showPage()
    c.save()
    records[name]={'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'pages':pages,'paragraph':paragraph(amount,days),'charge':fee,'fragments':fragments}
(ROOT/'author-input.json').write_text(json.dumps({'purpose':'Synthetic long-clause and review-navigation regression, not business acceptance','expectedEdits':[{'old':'USD 1,000,000','new':'USD 1,500,000'},{'old':'30 days','new':'45 days'},{'old':'USD 100','new':'USD 150'}],'repeatedNoticeCounts':{'before':2,'after':3},'files':records},indent=2)+'\n')
print(json.dumps({k:{'sha256':v['sha256'],'pages':v['pages']} for k,v in records.items()},indent=2))
