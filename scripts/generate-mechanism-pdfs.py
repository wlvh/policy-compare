from pathlib import Path
import io,json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject, RectangleObject
root=Path(__file__).resolve().parents[1]
out=root/'tests/fixtures/mechanisms';out.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('TestUnicode',str(root/'validation/assets/DejaVuSans.ttf')))
buf=io.BytesIO();c=canvas.Canvas(buf,pagesize=(300,400),invariant=1)
c.setFont('TestUnicode',12);c.drawString(70,270,'A😀e\u0301ﬁ');c.drawString(70,230,'SYNTHETIC TEST');c.save()
# ReportLab 4.4.9 emits <1F600>, an invalid odd-length UTF-16BE CMap value.
# Repair the GENERATED test input to the required surrogate pair, not an oracle.
w=PdfWriter();w.append(PdfReader(io.BytesIO(buf.getvalue())))
for ref in w.pages[0]['/Resources']['/Font'].values():
 font=ref.get_object()
 if '/ToUnicode' in font:
  stream=font['/ToUnicode'];stream.set_data(stream.get_data().replace(b'<1F600>',b'<D83DDE00>'))
fixed=io.BytesIO();w.write(fixed);source=fixed.getvalue()
(out/'unicode.pdf').write_bytes(source)
w=PdfWriter();w.append(PdfReader(io.BytesIO(source)));p=w.pages[0];p.cropbox=RectangleObject([40,50,280,350]);p.rotate(90);p[NameObject('/UserUnit')]=NumberObject(2)
with (out/'crop-rotate-userunit.pdf').open('wb') as f:w.write(f)
w=PdfWriter();w.append(PdfReader(io.BytesIO(source)));w.encrypt('fixture-secret')
with (out/'encrypted.pdf').open('wb') as f:w.write(f)
(out/'corrupt.pdf').write_bytes(b'%PDF-1.7\nnot a valid document')
# Independent geometric oracle from the authored baseline/font metrics and the
# known CropBox, rotation and UserUnit; never from either extraction engine.
ascent,descent=pdfmetrics.getAscentDescent('TestUnicode',12)
advance=pdfmetrics.stringWidth('A','TestUnicode',12)
emoji_width=pdfmetrics.stringWidth('😀','TestUnicode',12)
(out/'layout.json').write_text(json.dumps({'provenance':'authored position plus ReportLab font metrics; not engine output','emoji_region':[440+2*descent,60+2*advance,440+2*ascent,60+2*(advance+emoji_width)]},indent=2)+'\n')
print('Generated four mechanism inputs (fictional; independent of rule oracle).')
