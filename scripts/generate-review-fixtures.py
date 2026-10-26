from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfWriter
from pypdf.generic import ArrayObject,DictionaryObject,NameObject,NumberObject,DecodedStreamObject,EncodedStreamObject
root=Path(__file__).resolve().parents[1]/'tests/fixtures/review';root.mkdir(parents=True,exist_ok=True)
for variant in ['short-top','short-body','long-body','headings-body','unclassified-body']:
 for side in ['before','after']:
  c=canvas.Canvas(str(root/f'f1-{variant}-{side}.pdf'),pagesize=(612,792),invariant=1)
  c.setFont('Helvetica',10)
  rows=[('SECTION HULL',40),('DEDUCTIBLE: USD '+('1,000' if side=='before' else '2,000'),60),('SECTION LIABILITY',80),('DEDUCTIBLE: USD '+('2,000' if side=='before' else '1,000'),100)]
  if variant=='headings-body':rows=[(text.removeprefix('SECTION '),y) for text,y in rows]
  if variant=='unclassified-body':rows=[(text.replace('SECTION HULL','Hull coverage').replace('SECTION LIABILITY','Liability coverage'),y) for text,y in rows]
  for text,y in rows:
   if variant in ['long-body','headings-body','unclassified-body'] and text.startswith('DEDUCTIBLE'):text+=' each and every loss arising from declared operations'
   c.drawString(40,792-y-(130 if variant!='short-top' else 0),text)
  c.save()
def base():
 w=PdfWriter();p=w.add_blank_page(612,792)
 font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
 p[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):w._add_object(font)})})
 head=DecodedStreamObject();head.set_data(b'BT /F1 12 Tf 40 740 Td (POLICY SCHEDULE) Tj ET\n')
 return w,p,w._add_object(head)
for side in ['before','after']:
 w,p,head=base();bad=EncodedStreamObject();bad[NameObject('/Filter')]=NameObject('/FlateDecode');bad._data=b'INVALID COMPRESSED BODY '+side.encode();p[NameObject('/Contents')]=ArrayObject([head,w._add_object(bad)]);w.write(root/f'f2-{side}.pdf')
w,p,head=base();image=DecodedStreamObject();image.set_data(bytes([0,0,0]));image.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Image'),NameObject('/Width'):NumberObject(1),NameObject('/Height'):NumberObject(1),NameObject('/ColorSpace'):NameObject('/DeviceRGB'),NameObject('/BitsPerComponent'):NumberObject(8)})
form=DecodedStreamObject();form.set_data(b'q 200 0 0 40 0 0 cm /Im0 Do Q\n');form.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Form'),NameObject('/BBox'):ArrayObject([NumberObject(n) for n in [0,0,200,40]]),NameObject('/Matrix'):ArrayObject([NumberObject(n) for n in [1,0,0,1,100,300]]),NameObject('/Resources'):DictionaryObject({NameObject('/XObject'):DictionaryObject({NameObject('/Im0'):w._add_object(image)})})})
p['/Resources'][NameObject('/XObject')]=DictionaryObject({NameObject('/Fm0'):w._add_object(form)})
body=DecodedStreamObject();body.set_data(b'q /Fm0 Do Q\n');p[NameObject('/Contents')]=ArrayObject([head,w._add_object(body)]);w.write(root/'f5-form.pdf')
print('Review regression PDFs generated separately; original validation fixtures unchanged.')
# Two nested Forms plus an image after the Form verify matrix composition and restore.
w,p,head=base()
im=DecodedStreamObject();im.set_data(bytes([0,0,0]));im.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Image'),NameObject('/Width'):NumberObject(1),NameObject('/Height'):NumberObject(1),NameObject('/ColorSpace'):NameObject('/DeviceRGB'),NameObject('/BitsPerComponent'):NumberObject(8)})
imref=w._add_object(im)
def make_form(data,matrix,bbox,resources):
 f=DecodedStreamObject();f.set_data(data);f.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Form'),NameObject('/BBox'):ArrayObject([NumberObject(n) for n in bbox]),NameObject('/Matrix'):ArrayObject([NumberObject(n) for n in matrix]),NameObject('/Resources'):DictionaryObject({NameObject('/XObject'):DictionaryObject(resources)})});return w._add_object(f)
inner=make_form(b'q 200 0 0 40 0 0 cm /Im0 Do Q\n',[1,0,0,1,20,30],[0,0,200,40],{NameObject('/Im0'):imref})
outer=make_form(b'/Inner Do\n',[2,0,0,1,100,300],[0,0,300,100],{NameObject('/Inner'):inner})
p['/Resources'][NameObject('/XObject')]=DictionaryObject({NameObject('/Outer'):outer,NameObject('/Tail'):imref})
body=DecodedStreamObject();body.set_data(b'q /Outer Do Q q 20 0 0 20 10 10 cm /Tail Do Q\n');p[NameObject('/Contents')]=ArrayObject([head,w._add_object(body)]);w.write(root/'f5-nested-restore.pdf')
# Clean compressed control and a damaged page followed by a successfully compared page.
w,p,head=base();body=DecodedStreamObject();body.set_data(b'BT /F1 12 Tf 40 600 Td (DEDUCTIBLE: USD 1,000) Tj ET\n');p[NameObject('/Contents')]=ArrayObject([head,w._add_object(body.flate_encode())]);w.write(root/'f2-clean.pdf')
for side in ['before','after']:
 w,p,head=base();bad=EncodedStreamObject();bad[NameObject('/Filter')]=NameObject('/FlateDecode');bad._data=b'INVALID COMPRESSED BODY '+side.encode();p[NameObject('/Contents')]=ArrayObject([head,w._add_object(bad)])
 good=w.add_blank_page(612,792);good[NameObject('/Resources')]=p['/Resources'];text=DecodedStreamObject();text.set_data(b'BT /F1 12 Tf 40 600 Td (DEDUCTIBLE: USD '+(b'1,000' if side=='before' else b'2,000')+b') Tj ET\n');good[NameObject('/Contents')]=w._add_object(text);w.write(root/f'f2-mixed-{side}.pdf')
