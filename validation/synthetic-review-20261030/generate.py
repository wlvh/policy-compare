#!/usr/bin/env python3
"""Author-defined synthetic policy PDFs. Never reads any product output.

Python 3, reportlab, PyMuPDF and Pillow are used only to regenerate the files.
Shipped PDFs are the frozen inputs; running the product needs none of these.
"""
import copy
import hashlib
import io
import json
from pathlib import Path
import tempfile

import fitz
from PIL import Image
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
BASELINE = '33ec5ba4448a686d65490f15e7be8c32d30bd74c'
W, H = 612, 792
INK, MUTED, BLUE = '#182738', '#56687B', '#255E82'
CASES = []


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def text(value, x, y, *, font='Helvetica', size=10, role='body', table=None, row=None, field=None, fragments=None):
    return dict(type='text', text=value, x=x, y=y, font=font, size=size, role=role,
                table=table, row=row, field=field, fragments=fragments)


def line(x1, y1, x2, y2, color='#C8D5DE', width=0.5):
    return dict(type='line', x1=x1, y1=y1, x2=x2, y2=y2, color=color, width=width)


def page(case, title, page_no=1):
    return [
        text('NORTHSTAR / POLICY SCHEDULE', 42, 753, font='Helvetica-Bold', size=16, role='heading'),
        text(title, 42, 729, size=11, role='heading'),
        text(f'Synthetic fixture {case} | Fictional records and values', 42, 709, size=8, role='label'),
        line(42, 696, 570, 696, color=BLUE, width=1.3),
        line(42, 54, 570, 54),
        text('TEST DATA ONLY - NOT AN INSURANCE CONTRACT', 42, 39, size=7, role='footer'),
        text(f'Sheet {page_no}', 536, 39, size=7, role='footer'),
    ]


def table(elements, headers, rows, *, y=662, xs=None, row_step=26, name='schedule', draw_order='row', fragment=None):
    xs = xs or ([48, 232, 424] if len(headers) == 3 else [48, 126, 320, 450])
    for x, head in zip(xs, headers):
        elements.append(text(head, x, y, font='Helvetica-Bold', size=9, role='column_heading', table=name, field=head))
    elements.append(line(42, y - 9, 570, y - 9))
    pieces = []
    for r, cells in enumerate(rows):
        baseline = y - 29 - r * row_step
        rid = str(cells[0]).split('\n')[0]
        for j, cell in enumerate(cells):
            for k, part in enumerate(str(cell).split('\n')):
                frag = fragment if fragment and part == 'Alpha Air' else None
                pieces.append((r, j, k, text(part, xs[j], baseline - k * 14, role='cell', table=name,
                                           row=rid, field=headers[j], fragments=frag)))
    if draw_order == 'column':
        pieces.sort(key=lambda p: (p[1], p[0], p[2]))
    elements.extend(p[3] for p in pieces)


def event(n, old='', new='', edits=(), *, kind='Replaced', pages=(1, 1), block='schedule'):
    return dict(id=n, block=block, kind=kind, category='Unclassified', notes=[],
                left_text=old, right_text=new,
                left_pages=[pages[0]] if pages[0] else [], right_pages=[pages[1]] if pages[1] else [],
                edits=[dict(old=a, new=b) for a, b in edits])


def identity(table_name, headers, events, columns=(0,), pages=(1, 1), basis=None):
    return dict(table=table_name, heading=' | '.join(headers), events=list(events), identity=list(columns),
                pages=dict(left=[pages[0]] if pages[0] else [], right=[pages[1]] if pages[1] else []),
                basis=basis or '作者预先声明：印刷列标题和本样本记录号共同确定原文记录；仅供独立评价使用。')


def register(cid, title, english, left, right, changes, identities, expectations, *, scope='supported', note='', raster=False):
    CASES.append(dict(id=cid, title=title, english=english, scope=scope, pages=dict(left=left, right=right),
                      changes=changes, tables=identities, expectations=expectations, note=note, raster=raster))


H4 = ['MSN', 'Operator', 'Limit', 'Basis']
NORMAL = [['1315', 'Alpha Air', 'USD 100', 'annual'], ['1760', 'Beta Air', 'USD 1000', 'annual'],
          ['2156', 'Delta Air', 'USD 400', 'annual']]


def ordinary(cid, title, before, after, headers=H4):
    a, b = page(cid, title), page(cid, title)
    table(a, headers, before)
    table(b, headers, after)
    return [a], [b]


# P01: a byte-identical control. Its expected change list is genuinely empty.
a, b = ordinary('P01', 'Unchanged schedule', NORMAL, NORMAL)
register('P01', '完全相同的输入', 'Unchanged schedule', a, b, [], [],
         ['两份 PDF 字节相同，正文、金额、记录与位置均无作者修改。',
          '不得生成内容变化；处理范围与覆盖状态仍需如实。'])

# P02: the last reviewed numeric-length issue, now exercised through actual PDFs.
after = copy.deepcopy(NORMAL); after[0][2] = 'USD 2000'
a, b = ordinary('P02', 'One amount changes length', NORMAL, after)
ch = [event(1, ' | '.join(NORMAL[0]), ' | '.join(after[0]), [('USD 100', 'USD 2000')])]
register('P02', '100 变为 2000，旁边另有 1000', 'One amount changes length', a, b, ch,
         [identity('schedule', H4, [1])],
         ['1315 的 USD 100 变为 USD 2000；1760 的 USD 1000 未改。',
          '变化须来自 1315 自己的实际编辑，金额必须完整；不得借邻行拼出答案。',
          '可接受正确单卡或有各自完整来源的合法多卡。'])

before = copy.deepcopy(NORMAL); before[1][2] = 'USD 100'
after = copy.deepcopy(before); after[0][2] = after[1][2] = 'USD 200'
a, b = ordinary('P03', 'Two independent equal changes', before, after)
ch = [event(i + 1, ' | '.join(before[i]), ' | '.join(after[i]), [('USD 100', 'USD 200')]) for i in range(2)]
register('P03', '两个独立来源发生相同金额变化', 'Two independent equal changes', a, b, ch,
         [identity('schedule', H4, [1, 2])],
         ['1315 与 1760 各自独立发生一次 USD 100→USD 200。',
          '必须保留两次出现的不同原文位置；允许完整聚合，不允许丢一次或重复消费同一处。'])

before = copy.deepcopy(NORMAL); before[1][2] = 'USD 400'
after = copy.deepcopy(before); after[0][2], after[1][2] = 'USD 300', 'USD 200'
a, b = ordinary('P04', 'Different edits on adjacent records', before, after)
ch = [event(1, ' | '.join(before[0]), ' | '.join(after[0]), [('USD 100', 'USD 300')]),
      event(2, ' | '.join(before[1]), ' | '.join(after[1]), [('USD 400', 'USD 200')])]
register('P04', '相邻记录的两项不同金额编辑', 'Different edits on adjacent records', a, b, ch,
         [identity('schedule', H4, [1, 2])],
         ['真实编辑分别是 1315:100→300、1760:400→200。',
          '不得交换记录的另一侧，或拼成作者没有做过的 100→200。',
          '本例检验产品实际产生的卡；拒绝人为伪造卡仍由原评分器探针证明。'])

headers = ['MSN', 'Operator', 'Hull Limit', 'War Limit']
before = [['1315', 'Alpha Air', 'USD 100', 'USD 100'], ['1760', 'Beta Air', 'USD 100', 'USD 999'],
          ['2156', 'Delta Air', 'USD 300', 'USD 400']]
after = copy.deepcopy(before); after[0][3] = 'USD 200'
a, b = ordinary('P05', 'Repeated values in different cells', before, after, headers)
register('P05', '同一记录两格同额，只改后一格', 'Repeated values in different cells', a, b,
         [event(1, ' | '.join(before[0]), ' | '.join(after[0]), [('USD 100', 'USD 200')])],
         [identity('schedule', headers, [1])],
         ['只有 1315 的 War Limit 从 USD 100 变为 USD 200；Hull Limit 未改。',
          '须人工结合作者布局与卡片来源检查列归属；原分诊的文字命中不能独立证明是哪一列。',
          '不得从 1760 借金额，也不得把未改变的同额单元格当作本次变化来源。'])

after = copy.deepcopy(before[1:])
a, b = ordinary('P06', 'A source row with duplicate cells removed', before, after, headers)
register('P06', '删除的原文行有两个相同金额格', 'A source row with duplicate cells removed', a, b,
         [event(1, ' | '.join(before[0]), '', kind='Removed', pages=(1, 0))],
         [identity('schedule', headers, [1], pages=(1, 0))],
         ['原文中的 1315 行删除，其两个 USD 100 都来自该行；1760 与 2156 内容保留。',
          '允许显示原文删除或未配内容；不得把文字删除直接表述成业务记录确定退出。',
          '完整行恢复不能从另一记录借第二份相同金额。'])

before = copy.deepcopy(NORMAL); after = copy.deepcopy(before); after[0] = ['9999', 'Orion Air', 'USD 100', 'annual']
a, b = ordinary('P07', 'Equal value does not identify a record', before, after)
register('P07', '金额和位置相同，身份不同', 'Equal value does not identify a record', a, b,
         [event(1, ' | '.join(before[0]), '', kind='Removed', pages=(1, 0)),
          event(2, '', ' | '.join(after[0]), kind='Added', pages=(0, 1))],
         [identity('schedule', H4, [1, 2])],
         ['旧原文为 1315 / Alpha Air，新原文为 9999 / Orion Air，金额都为 USD 100。',
          '可分别展示两侧或保留身份未定；不得仅因金额或坐标相同，确定它们是同一业务记录。',
          '作者 Added/Removed 仅描述纸面文字，不断言业务新增或退出。'])

headers = ['MSN', 'Operator', 'Hull Limit', 'War Limit']
before = [['1315', 'Alpha Air', 'USD 100', 'USD 300'], ['1760', 'Beta Air', 'USD 500', 'USD 700'],
          ['2156', 'Delta Air', 'USD 600', 'USD 800']]
after = copy.deepcopy(before); after[0][2:] = ['USD 200', 'USD 400']
a, b = ordinary('P08', 'Two edits inside one source record', before, after, headers)
register('P08', '同一记录中的两项编辑不能交叉配对', 'Two edits inside one source record', a, b,
         [event(1, ' | '.join(before[0]), ' | '.join(after[0]), [('USD 100', 'USD 200'), ('USD 300', 'USD 400')])],
         [identity('schedule', headers, [1])],
         ['1315 的 Hull 为 100→200，War 为 300→400。',
          '同一记录也不能把两项编辑改写成 100→400 和 300→200；来源位置须对应具体单元格。'])

headers = ['MSN', 'Operator', 'Cover', 'Terms']
before = [['1315', 'Alpha Air\nHoldings', 'Hull\nand war', 'USD 1000\nper annum'],
          ['1760', 'Beta Air', 'Liability', 'USD 2000'], ['2156', 'Delta Air', 'Hull', 'USD 3000']]
after = copy.deepcopy(before); after[0][3] = 'USD 1000\nper month'
a, b = page('P09', 'Ordinary partial-cell wrapping'), page('P09', 'Ordinary partial-cell wrapping')
table(a, headers, before, row_step=48); table(b, headers, after, row_step=48)
register('P09', '部分单元格换行的正向', 'Ordinary partial-cell wrapping', [a], [b],
         [event(1, '1315 | Alpha Air Holdings | Hull and war | USD 1000 per annum',
                '1315 | Alpha Air Holdings | Hull and war | USD 1000 per month', [('per annum', 'per month')])],
         [identity('schedule', headers, [1])],
         ['1315 的普通续行中，per annum 变为 per month，金额未改。',
          '保留正确归属与完整来源；不得把普通续行确定成另一条记录。'])

headers = ['MSN', 'Operator', 'Terms']
before = [['123\n(a)', 'Alpha Air\nHoldings', 'USD 1000\nper annum'],
          ['456', 'Beta Air', 'USD 2000'], ['789', 'Delta Air', 'USD 3000']]
after = copy.deepcopy(before); after[0][2] = 'USD 1000\nper month'; after[1][2] = 'USD 2500'
a, b = page('P10', 'All cells wrap, with font fragments'), page('P10', 'All cells wrap, with font fragments')
frag = [('Alpha ', 'Helvetica'), ('Air', 'Helvetica-Oblique')]
table(a, headers, before, row_step=48, fragment=frag)
table(b, headers, after, row_step=48, fragment=frag, draw_order='column')
register('P10', '全格两行，名称由两个字体片段绘制', 'All cells wrap, with font fragments', [a], [b],
         [event(1, '123 (a) | Alpha Air Holdings | USD 1000 per annum',
                '123 (a) | Alpha Air Holdings | USD 1000 per month', [('per annum', 'per month')]),
          event(2, '456 | Beta Air | USD 2000', '456 | Beta Air | USD 2500', [('USD 2000', 'USD 2500')])],
         [identity('schedule', headers, [1, 2], basis='作者绘制的第一逻辑行第一格为123与续行(a)，第二条普通记录为456。歧义行允许产品未决；不得把(a)定成新行键。')],
         ['全格换行的局部歧义可保留原文及身份未定；(a) 不得成为确定行键。',
          '相邻正常记录 456 的 2000→2500 应继续可核对。',
          '必须查看实际两引擎 Doc：若未形成分片，此引擎仅覆盖换行，不能声称覆盖提取片段反例。'])

headers = ['MSN', 'Operator', 'Terms', 'Rate']
before = [['123\n(a)\n(b)', 'Alpha Air\nHoldings\nLimited', 'USD 1000\nper annum\nnet', '0.10%\nnet\nannual'],
          ['456', 'Beta Air', 'USD 2000', '0.20%'], ['789', 'Delta Air', 'USD 3000', '0.30%']]
after = copy.deepcopy(before); after[0][3] = '0.10%\nnet\nmonthly'; after[1][2] = 'USD 2500'
a, b = page('P11', 'All cells span three lines'), page('P11', 'All cells span three lines')
table(a, headers, before, row_step=66, fragment=frag, draw_order='column')
table(b, headers, after, row_step=66, fragment=frag, draw_order='column')
register('P11', '全格三行，第三行发生修改', 'All cells span three lines', [a], [b],
         [event(1, '123 (a) (b) | Alpha Air Holdings Limited | USD 1000 per annum net | 0.10% net annual',
                '123 (a) (b) | Alpha Air Holdings Limited | USD 1000 per annum net | 0.10% net monthly', [('annual', 'monthly')]),
          event(2, '456 | Beta Air | USD 2000 | 0.20%', '456 | Beta Air | USD 2500 | 0.20%', [('USD 2000', 'USD 2500')])],
         [identity('schedule', headers, [1, 2], basis='作者绘制逻辑记录123的第一格为123/(a)/(b)三行；可保留局部结构未决。下一条普通记录为456。')],
         ['第三行 annual→monthly 必须保留，(a)/(b) 不得被确定为独立记录号。',
          '允许歧义逻辑行未评价；邻行 456 的金额修改仍单独核查。'])

h_a, h_b = H4, ['Registration', 'Model', '2026 Share %', 'Premium USD']
a, b = page('P12', 'Adjacent tables have separate identities'), page('P12', 'Adjacent tables have separate identities')
old_a = [['123', 'Alpha Air', 'USD 100', 'annual'], ['456', 'Beta Air', 'USD 200', 'annual'], ['789', 'Delta Air', 'USD 300', 'annual']]
new_a = copy.deepcopy(old_a[1:])
old_b = [['888', 'Model B', '10%', 'USD 50'], ['999', 'Model C', '20%', 'USD 60']]
new_b = [['123', 'Model D', '15%', 'USD 100']] + copy.deepcopy(old_b)
table(a, h_a, old_a, name='hull_schedule'); table(b, h_a, new_a, name='hull_schedule')
table(a, h_b, old_b, y=530, name='premium_schedule'); table(b, h_b, new_b, y=530, name='premium_schedule')
register('P12', '年份、百分号、币种表头应隔开身份范围', 'Adjacent tables have separate identities', [a], [b],
         [event(1, ' | '.join(old_a[0]), '', kind='Removed', pages=(1, 0), block='hull_schedule'),
          event(2, '', ' | '.join(new_b[0]), kind='Added', pages=(0, 1), block='premium_schedule')],
         [identity('hull_schedule', h_a, [1], pages=(1, 0)), identity('premium_schedule', h_b, [2], pages=(0, 1))],
         ['第一表删除MSN123的原文；第二表新增Registration123的原文，标题中含2026、%和USD。',
          '不得跨表把两处123定成同一记录；原分诊不能单独证明表边界，需核对作者布局和产品来源。',
          '保留未配原文或身份未定均可；不能推断业务记录进入/退出。'])

a, b = page('P13', 'An explicit page-number reference'), page('P13', 'An explicit page-number reference')
old, new = 'Reference: Page 3 of 10.', 'Reference: Page 4 of 10.'
a += [text('DOCUMENT REFERENCE', 48, 658, font='Helvetica-Bold', size=10), text(old, 48, 632)]
b += [text('DOCUMENT REFERENCE', 48, 658, font='Helvetica-Bold', size=10), text(new, 48, 632)]
register('P13', '明确的页码表达变化', 'An explicit page-number reference', [a], [b],
         [event(1, old, new, [('Page 3 of 10', 'Page 4 of 10')], block='reference')], [],
         ['正文引用中的 Page 3 of 10 变为 Page 4 of 10，须保留原文变化。',
          '允许声明页码表达变化，也允许不作分类；不得据此证明引用指向的实际页一定正确。'])

a, b = page('P14', 'Amounts and literal hash signs'), page('P14', 'Amounts and literal hash signs')
pairs = [('Printing charge per page 100USD.', 'Printing charge per page 200USD.'),
         ('Adjustment per page 10%.', 'Adjustment per page 20%.'),
         ('Document marker: Page 3 Page #.', 'Document marker: Page # Page 4.')]
for k, (old, new) in enumerate(pairs):
    a.append(text(old, 48, 650 - 65 * k)); b.append(text(new, 48, 650 - 65 * k))
register('P14', 'per page 后的金额、百分比与字面 #', 'Amounts and literal hash signs', [a], [b],
         [event(k + 1, old, new, [(old, new)], block=f'paragraph_{k + 1}') for k, (old, new) in enumerate(pairs)], [],
         ['三项作者编辑分别是100USD→200USD、10%→20%、两段Page表达及字面#的位置改变。',
          '三项都不能被声称只是页码数字变化；允许不主动分类，须保留可见编辑与来源。',
          '若产品未声明页码事实，只能说没有虚假声明，不能写成评分器已验证该事实为假。'])

# Boundary E01: same logical row moves its continuation to the next page.
headers = ['MSN', 'Operator', 'Cover', 'Terms']
a1, a2 = page('E01', 'A row continues on the next page', 1), page('E01', 'A row continues on the next page', 2)
b1, b2 = page('E01', 'A row continues on the next page', 1), page('E01', 'A row continues on the next page', 2)
row = ['1315', 'Alpha Air Holdings', 'Hull and war', 'USD 1000 per annum']
table(a1, headers, [row], y=150, xs=[48, 114, 320, 442])
table(b1, headers, [['1315', 'Alpha Air', 'Hull', 'USD 1000']], y=150, xs=[48, 114, 320, 442])
for x, value, field in zip([114, 320, 442], ['Holdings', 'and war', 'per annum'], headers[1:]):
    b2.append(text(value, x, 650, role='cell', table='schedule', row='1315', field=field))
for p in [a2, b2]:
    p.append(text('General conditions remain unchanged.', 48, 560))
register('E01', '跨页续行，文字本身不变', 'A row continues on the next page', [a1, a2], [b1, b2], [], [],
         ['逻辑记录文字相同，仅部分单元格续行移至第二页；作者布局文件保留两侧位置。',
          '观察拆卡、未决和原文保留；不要求补齐通用跨页识别，既有R24边界保持。',
          '不得凭空声称金额发生变化；changes为空表示没有文字增删，不能据此自动给移动检测打分。'],
         scope='boundary', note='跨页结构探索；不纳入当前支持能力通过率。')

before = copy.deepcopy(NORMAL); after = [copy.deepcopy(before[2]), copy.deepcopy(before[0]), copy.deepcopy(before[1])]
a, b = ordinary('E02', 'Rows reordered without content edits', before, after)
register('E02', '表格整行重排，数值未改', 'Rows reordered without content edits', a, b, [], [],
         ['顺序从1315/1760/2156变为2156/1315/1760；每条记录文字和金额均不变。',
          '观察移动表达、拆卡和审阅负担；不要求本轮补齐R23的完整顺序核验。',
          '不得凭空报金额变化；空changes不能自动证明重排被完整发现。'],
         scope='boundary', note='已登记的表格重排评价边界；单独观察。')

before = copy.deepcopy(NORMAL); after = copy.deepcopy(before); after[0][2] = 'USD 2000'
a, b = ordinary('E03', 'Image-only scanned schedule', before, after)
register('E03', '纯扫描图片中的金额变化', 'Image-only scanned schedule', a, b,
         [event(1, ' | '.join(before[0]), ' | '.join(after[0]), [('USD 100', 'USD 2000')])],
         [identity('schedule', H4, [1])],
         ['可见图像内1315的100→2000；文件没有可提取文字层。',
          '不要求新增OCR；应明确图像文字未比较或覆盖不足，不能把空文本结果表述为整份文件无变化。'],
         scope='boundary', note='纯图像页的覆盖声明探索，不把OCR缺失列为新增功能阻断。', raster=True)


def render_native(path, pages):
    c = canvas.Canvas(str(path), pagesize=(W, H), invariant=1, pageCompression=1)
    c.setTitle('Synthetic policy comparison fixture')
    c.setAuthor('Independent synthetic fixture author')
    layout = []
    for page_index, elements in enumerate(pages):
        for item in elements:
            if item['type'] == 'line':
                c.setStrokeColor(HexColor(item['color'])); c.setLineWidth(item['width'])
                c.line(item['x1'], item['y1'], item['x2'], item['y2'])
                continue
            c.setFillColor(HexColor(MUTED if item['role'] in ('label', 'footer') else INK))
            x = item['x']
            chunks = item['fragments'] or [(item['text'], item['font'])]
            for value, font in chunks:
                c.setFont(font, item['size']); c.drawString(x, item['y'], value)
                x += stringWidth(value, font, item['size'])
            assert x <= W - 32, (path, item['text'], x)
            entry = {k: v for k, v in item.items() if k != 'type'}
            entry.update(page=page_index + 1, bbox_pdf_bottom_left=[item['x'], item['y'] - 3, x, item['y'] + item['size']],
                         bbox_top_left=[item['x'], H - item['y'] - item['size'], x, H - item['y'] + 3])
            layout.append(entry)
        c.showPage()
    c.save()
    return layout


def render(path, pages, raster):
    if not raster:
        return render_native(path, pages)
    with tempfile.TemporaryDirectory() as tmp:
        native = Path(tmp) / 'native.pdf'
        layout = render_native(native, pages)
        doc = fitz.open(native)
        c = canvas.Canvas(str(path), pagesize=(W, H), invariant=1, pageCompression=1)
        c.setTitle('Synthetic image-only policy comparison fixture')
        c.setAuthor('Independent synthetic fixture author')
        for p in doc:
            pix = p.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes('png')))
            c.drawImage(ImageReader(img), 0, 0, width=W, height=H)
            c.showPage()
        c.save()
        return layout


def main():
    identities = dict(version='synthetic-author-identity/1', about=[
        '这些身份与编辑在运行产品前由PDF作者固定。产品只读PDF，分诊才读取本文件。',
        '三类探索样本不混入支持范围通过率；分诊不能代替所有布局、覆盖和事实检查。'], pairs=[])
    manifest = dict(suiteVersion='synthetic-policy-review/1', baselineCode=BASELINE,
                    authoredBeforeProductRun=True, productRunPerformed=False,
                    coordinateSystem='PDF points; top-left bounds also supplied for inspection', cases=[])
    layouts = {}
    for case in CASES:
        folder = ROOT / 'cases' / case['id']
        folder.mkdir(parents=True, exist_ok=True)
        layouts[case['id']] = {'imageOnly': case['raster']}
        for side in ['left', 'right']:
            name = 'before.pdf' if side == 'left' else 'after.pdf'
            layouts[case['id']][side] = render(folder / name, case['pages'][side], case['raster'])
        dump(folder / 'changes.json', dict(case_id=case['id'], changes=case['changes']))
        changes_sha = digest(folder / 'changes.json')
        identities['pairs'].append(dict(pair=case['id'], changes_sha256=changes_sha, tables=case['tables']))
        manifest['cases'].append(dict(id=case['id'], title=case['title'], scope=case['scope'],
            left=f'cases/{case["id"]}/before.pdf', right=f'cases/{case["id"]}/after.pdf',
            changes=f'cases/{case["id"]}/changes.json', identity='identity.json',
            authorLayout='author-layout.json', expectations=case['expectations'], note=case['note'],
            pages={s: len(case['pages'][s]) for s in ['left', 'right']},
            sha256=dict(left=digest(folder / 'before.pdf'), right=digest(folder / 'after.pdf'), changes=changes_sha)))
    dump(ROOT / 'identity.json', identities)
    dump(ROOT / 'author-layout.json', layouts)
    for case in manifest['cases']:
        case['sha256']['identity'] = digest(ROOT / 'identity.json')
    dump(ROOT / 'manifest.json', manifest)
    print(f'Authored {len(CASES)} pairs / {len(CASES)*2} PDFs. No product was executed.')


if __name__ == '__main__':
    main()
