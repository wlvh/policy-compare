"""Independent varied long PDF workloads; oracle written from the mutation, not the product."""
from pathlib import Path
import json,hashlib
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'bench/generated'
pdfmetrics.registerFont(TTFont('Bench',str(ROOT/'validation/assets/DejaVuSans.ttf')))
manifest=[]
for family in ['renewal','dense_table','template_change']:
 for size,pages in [('small',8),('standard',45),('capacity',100)]:
  folder=OUT/(family+'-'+size);folder.mkdir(parents=True,exist_ok=True)
  # Each page has its own objects and values. No self comparisons, no copied page loop.
  for side in ['before','after']:
   c=canvas.Canvas(str(folder/(side+'.pdf')),pagesize=(595,842),invariant=1,pageCompression=1)
   def text(s,x,y,size=9):c.setFont('Bench',size);c.drawString(x,y,s)
   for p in range(pages):
    text('SYNTHETIC TEST - PERFORMANCE WORKLOAD',40,813)
    text('REPEATED HEADER LIMIT: USD 5,000,000',40,792)
    text('Portfolio review '+str(p+1),40,762,12)
    text('PAGE '+str(p+1),40,25)
    if family=='dense_table':
     xs=[40,145,265,395,445];headers=['REGISTRATION','SERIAL','MODEL','CCY','AGREED VALUE']
     for label,x in zip(headers,xs):text(label,x,708,7)
     for row in range(22):
      index=p*22+row;amount=f'{1000000+index*125:,}'
      if index==10 and side=='after':amount='9,876,543'
      values=[f'AC-{index:05}',f'SERIAL-{index:06}',f'Type {index%17:02} / {index%9}', 'USD',amount]
      for value,x in zip(values,xs):text(value,x,680-row*25,8)
    else:
     if p==0:
      text('PERIOD:',40,730,8);text('01 April 2025 to 31 March 2026' if side=='after' else '01 April 2024 to 31 March 2025',180,730)
      text('SUMS INSURED:',40,710,8);text('USD 9,876,543' if side=='after' else 'USD 1,234,567',180,710)
     for row in range(10):
      index=p*10+row;y=673-row*53
      text(f'CONDITION {index:05}',40,y,8)
      if family=='template_change':
       prefix='The operator shall document' if side=='before' else 'The insured must record'
       body=f'{prefix} approved operations for asset {index:05} within region {index%31:02}.'
      else:body=f'Approved aircraft {index:05} remains subject to inspection in region {index%31:02}.'
      text(body,40,y-17,8)
      text(f'Notification reference {index:06} applies to event class {index%47:02} and declared operations.',40,y-31,8)
    c.showPage()
   c.save()
  font_size=8 if family=='dense_table' else 9
  ascent,descent=pdfmetrics.getAscentDescent('Bench',font_size)
  x,y=(445,430) if family=='dense_table' else (180,710)
  old_value='1,001,250' if family=='dense_table' else 'USD 1,234,567'
  new_value='9,876,543' if family=='dense_table' else 'USD 9,876,543'
  regions=[[x,842-y-ascent,x+pdfmetrics.stringWidth(value,'Bench',font_size),842-y-descent] for value in [old_value,new_value]]
  manifest.append({'name':family+'-'+size,'family':family,'size':size,'pages_per_document':pages,'paths':[str((folder/(s+'.pdf')).relative_to(ROOT)) for s in ['before','after']], 'sha256':[hashlib.sha256((folder/(s+'.pdf')).read_bytes()).hexdigest() for s in ['before','after']], 'assertion':{'required_status':'complete_for_scope' if size!='capacity' else 'complete_or_budget_partial','new_visible_value':'9,876,543','first_location':{'page_index':0,'regions':regions,'provenance':'authored baseline and font metrics, not engine output'}},'budget_ms':3000 if size=='small' else 20000 if size=='standard' else None})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Generated 9 pairs / 18 PDFs, three families × three capacity levels.')
