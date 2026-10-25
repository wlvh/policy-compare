import * as mupdf from 'mupdf';
import { VERSION, hashBytes, quantize, type DocInput, type Page, type Quad } from '../contracts/index';

export const EXTRACTOR_VERSION = 'mupdf/1.28.1+scalar-fix.1';
export const TEXT_OPTIONS = 'preserve-ligatures,preserve-whitespace,preserve-images,inhibit-spaces,clip';
export const LIMITS = { bytes: 30 * 1024 * 1024, pages: 100, scalars: 500_000 };

export class PdfSession {
  private document: mupdf.Document;
  readonly hash: string;
  readonly pageCount: number;
  private disposed = false;
  constructor(bytes: Uint8Array, password = '') {
    if (bytes.byteLength > LIMITS.bytes) throw new Error('文件超过 30 MiB 上限');
    this.hash = hashBytes(bytes);
    this.document = mupdf.Document.openDocument(bytes, 'application/pdf');
    try {
      if (this.document.needsPassword() && !this.document.authenticatePassword(password)) throw new Error('PASSWORD_REQUIRED：请输入本地 PDF 密码');
      this.pageCount = this.document.countPages();
      if (!this.pageCount || this.pageCount > LIMITS.pages) throw new Error('PDF 页数必须在 1–100 页以内');
    } catch (e) { this.document.destroy(); throw e; }
  }
  extractPage(pageIndex: number): Page {
    if (this.disposed) throw new Error('文档已关闭');
    const page = this.document.loadPage(pageIndex);
    let text: mupdf.StructuredText | undefined;
    try {
      const bounds = page.getBounds();
      const ox = bounds[0], oy = bounds[1];
      const out: Page = { pageIndex, width: quantize(bounds[2]-ox), height: quantize(bounds[3]-oy),
        transform: [1,0,0,1,-ox,-oy], inverseTransform: [1,0,0,1,ox,oy], chars: [], lines: [], issues: [], coverageState: 'text' };
      text = page.toStructuredText(TEXT_OPTIONS);
      let offset = 0;
      text.walk({
        beginLine(_box, mode, direction) {
          out.lines.push({ id: `p${pageIndex}:l${out.lines.length}`, charIds: [], direction: direction.map(quantize) as [number,number], writingMode: mode ? 'vertical' : 'horizontal', baseline: [0,0], baselineProvenance: 'measured' });
        },
        onChar: (c, origin, font, size, quad) => {
          try {
            const id = `${this.hash}:p${pageIndex}:c${out.chars.length}`;
            const line = out.lines.at(-1)!;
            const xy = [quantize(origin[0]-ox), quantize(origin[1]-oy)] as [number,number];
            if (!line.charIds.length) line.baseline = xy;
            line.charIds.push(id);
            const n = Array.from(c).length;
            out.chars.push({ id, text: c, rawRange: [offset,offset+n], origin: xy,
              quad: quad.map((v,i) => quantize(v - (i%2 ? oy : ox))) as Quad,
              size: quantize(size), style: font.getName(), provenance: 'extracted', precision: 'glyph', sharedGeometry: null });
            offset += n;
          } finally { font.destroy(); }
        },
        onImageBlock(box,_matrix,image) {
          try { out.issues.push({ pageIndex, region: [box[0]-ox,box[1]-oy,box[2]-ox,box[3]-oy].map(quantize) as [number,number,number,number],
            reason: 'unverified_image_text_region', evidence: 'MuPDF StructuredText image block', message: '图片区域未做文字比较（没有 OCR）', defaultVisible: true }); }
          finally { image.destroy(); }
        },
      });
      if (!out.chars.length && out.issues.length) for (const issue of out.issues) { issue.reason = 'raster_only_content'; issue.message = '此页只有图片，正文文字尚未比较'; }
      if (out.chars.some(c => c.text.includes('\uFFFD') || /[\uD800-\uDFFF]/u.test(c.text))) out.issues.push({ pageIndex, region: [0,0,out.width,out.height], reason: 'encoding_unknown', evidence: 'replacement or isolated surrogate character', message: '存在无法可靠解码的字符', defaultVisible: true });
      if (page instanceof mupdf.PDFPage) {
        const annotations = page.getAnnotations(), widgets = page.getWidgets();
        if (annotations.length || widgets.length) out.issues.push({ pageIndex, region: [0,0,out.width,out.height], reason: 'unsupported_objects', evidence: `${annotations.length} annotation objects; ${widgets.length} widgets`, message: '批注及交互表单对象未作完整比较', defaultVisible: true });
        annotations.forEach(a=>a.destroy()); widgets.forEach(w=>w.destroy());
      }
      out.coverageState = out.issues.length ? 'suspect' : out.chars.length ? 'text' : 'confirmed_blank';
      // Multiple code points sharing a glyph retain the original, unsplit quad.
      const geometry = new Map<string, typeof out.chars>();
      for (const c of out.chars) { const key = JSON.stringify(c.quad); const list = geometry.get(key) ?? []; list.push(c); geometry.set(key,list); }
      for (const list of geometry.values()) if (list.length > 1) for (const c of list) { c.sharedGeometry = list[0].id; c.precision = 'shared_glyph'; }
      return out;
    } finally { text?.destroy(); page.destroy(); }
  }
  metadata(): Omit<DocInput,'pages'> {
    return { schemaVersion: VERSION, contentHash: this.hash, extractor: { name: 'MuPDF.js', version: EXTRACTOR_VERSION, options: { structuredText: TEXT_OPTIONS, actualText: 'engine-default', clip: true } }, pageCount: this.pageCount, coordinateSystem: 'display-top-left-pt/ul-ur-ll-lr', indexUnit: 'unicode-scalar', diagnostics: [] };
  }
  async extract(onPage?: (page:Page)=>void, cancelled?:()=>boolean, retainPages=true): Promise<DocInput> {
    const pages: Page[] = []; let total = 0;
    for (let i=0;i<this.pageCount;i++) {
      if (cancelled?.()) throw new Error('CANCELLED');
      let page: Page;
      try { page = this.extractPage(i); }
      catch { page = { pageIndex:i,width:595,height:842,transform:[1,0,0,1,0,0],inverseTransform:[1,0,0,1,0,0],chars:[],lines:[],coverageState:'failed',issues:[{pageIndex:i,region:[0,0,595,842],reason:'page_failed',evidence:'MuPDF page extraction exception; bounds unavailable',message:'页面解析失败，未完成文字比较',defaultVisible:true}] }; }
      total += page.chars.reduce((n,c)=>n+c.rawRange[1]-c.rawRange[0],0);
      if (total > LIMITS.scalars) throw new Error('文档超过 500,000 个 Unicode 标量上限');
      if(retainPages)pages.push(page); onPage?.(page);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {...this.metadata(),pages};
  }
  render(pageIndex:number, scale=1.25): { png:Uint8Array; width:number; height:number } {
    if (this.disposed) throw new Error('文档已关闭');
    const page = this.document.loadPage(pageIndex);
    let pix: mupdf.Pixmap | undefined;
    try { const b=page.getBounds(); const bounded=Math.min(Math.max(scale,0.25),2,Math.sqrt(4_000_000/((b[2]-b[0])*(b[3]-b[1])))); pix=page.toPixmap(mupdf.Matrix.scale(bounded,bounded),mupdf.ColorSpace.DeviceRGB,false,true); return {png:pix.asPNG().slice(),width:pix.getWidth(),height:pix.getHeight()}; }
    finally {pix?.destroy();page.destroy();}
  }
  destroy() { if (!this.disposed) {this.disposed=true;this.document.destroy();} }
}
export async function extractPdf(bytes:Uint8Array,password=''):Promise<DocInput> {
  const session=new PdfSession(bytes,password);try{return await session.extract();}finally{session.destroy();}
}
