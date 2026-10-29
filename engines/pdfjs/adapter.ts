import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  VERSION,
  hashBytes,
  quantize,
  scalarOffsets,
  type DocInput,
  type Page,
  type Quad,
} from "../../packages/contracts/index";
import {
  LIMITS,
  type PdfSessionApi,
  type RenderedPage,
} from "../../packages/pdf-adapter/api";
export const EXTRACTOR_VERSION = "pdfjs/6.4.299+strict-streams.1";
export const TEXT_OPTIONS = {
  disableNormalization: true,
  includeMarkedContent: false,
};
export function configureWorker(url: string) {
  pdfjs.GlobalWorkerOptions.workerSrc = url;
}
const node = typeof process !== "undefined" && Boolean(process.versions?.node);
const transform = (a: number[], b: number[]) => pdfjs.Util.transform(a, b);
const point = (m: number[], x: number, y: number) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
export class PdfJsSession implements PdfSessionApi {
  readonly pageCount: number;
  private closed = false;
  private bounds = new Map<number,{width:number;height:number}>();
  timings = {
    nativeTextExtraction: 0,
    sourceAdaptation: 0,
    coverageAnalysis: 0,
  };
  private constructor(
    private doc: pdfjs.PDFDocumentProxy,
    readonly hash: string,
    private task: pdfjs.PDFDocumentLoadingTask,
  ) {
    this.pageCount = doc.numPages;
  }
  static async open(
    bytes: Uint8Array,
    password = "",
    signal?: AbortSignal,
    worker?: pdfjs.PDFWorker,
  ) {
    if (bytes.length > LIMITS.bytes) throw new Error("文件超过 30 MiB 上限");
    const hash = hashBytes(bytes);
    const resource = node
      ? decodeURIComponent(
          new URL("./node_modules/pdfjs-dist/", import.meta.url).pathname,
        )
      : `/pdfjs/${pdfjs.version}/`;
    const task = pdfjs.getDocument({
      data: Uint8Array.from(bytes),
      password,
      worker,
      standardFontDataUrl: resource + "standard_fonts/",
      cMapUrl: resource + "cmaps/",
      cMapPacked: true,
      wasmUrl: resource + "wasm/",
      useWorkerFetch: !node,
      disableFontFace: node,
      // The pinned worker patch also propagates decoder-construction failures
      // that upstream otherwise turns into an empty NullStream unconditionally.
      stopAtErrors: true,
    });
    signal?.addEventListener(
      "abort",
      () => {
        void task.destroy();
      },
      { once: true },
    );
    if (signal?.aborted) {
      await task.destroy();
      throw new Error("CANCELLED");
    }
    try {
      const doc = await task.promise;
      if (!doc.numPages || doc.numPages > LIMITS.pages) {
        await task.destroy();
        throw new Error("PDF 页数必须在 1–100 页以内");
      }
      return new PdfJsSession(doc, hash, task);
    } catch (e) {
      await task.destroy();
      if (e instanceof Error && e.name === "PasswordException")
        throw new Error("PASSWORD_REQUIRED：请输入本地 PDF 密码");
      throw e;
    }
  }
  metadata(): Omit<DocInput, "pages"> {
    return {
      schemaVersion: VERSION,
      contentHash: this.hash,
      extractor: {
        name: "PDF.js",
        version: EXTRACTOR_VERSION,
        adapterVersion: "pdfjs-adapter/3",
        options: {
          ...TEXT_OPTIONS,
          geometry: "engine_run; browser text_layer_range",
          stopAtErrors: true,
          streamFailurePolicy: "throw-invalid-stream/1",
        },
      },
      pageCount: this.pageCount,
      coordinateSystem: "display-top-left-pt/ul-ur-ll-lr",
      indexUnit: "unicode-scalar",
      diagnostics: [],
    };
  }
  async extractPage(pageIndex: number): Promise<Page> {
    if (this.closed) throw new Error("文档已关闭");
    const page = await this.doc.getPage(pageIndex + 1),
      viewport = page.getViewport({ scale: 1 });
    this.bounds.set(pageIndex,{width:quantize(viewport.width),height:quantize(viewport.height)});
    const nativeStart = performance.now();
    const content = await page.getTextContent(TEXT_OPTIONS);
    this.timings.nativeTextExtraction += performance.now() - nativeStart;
    const adaptationStart = performance.now();
    const out: Page = {
      pageIndex,
      width: quantize(viewport.width),
      height: quantize(viewport.height),
      transform: viewport.transform.map(quantize) as Page["transform"],
      inverseTransform: pdfjs.Util.inverseTransform(viewport.transform).map(
        quantize,
      ) as Page["transform"],
      chars: [],
      lines: [],
      textItems: [],
      issues: [],
      coverageState: "text",
    };
    let raw = 0,
      itemIndex = 0;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const itemId = `${this.hash}:p${pageIndex}:i${itemIndex++}`;
      out.textItems!.push({ id: itemId, text: item.str });
      if (!item.str) continue;
      const tx = transform(viewport.transform, item.transform),
        norm = Math.hypot(tx[0], tx[1]) || 1,
        dir: [number, number] = [tx[0] / norm, tx[1] / norm],
        normal = [-dir[1], dir[0]],
        height = Math.hypot(tx[2], tx[3]),
        width = item.width * page.userUnit;
      // Type 3 fonts (e.g. Chromium's printed header/footer) report NaN metrics.
      const style = content.styles[item.fontName],
        ascent = Number.isFinite(style.ascent) ? style.ascent : 0.8,
        descent = Number.isFinite(style.descent) ? style.descent : -0.2;
      const p = (along: number, vertical: number) => [
        tx[4] + dir[0] * along + normal[0] * vertical,
        tx[5] + dir[1] * along + normal[1] * vertical,
      ];
      const quad = [
        ...p(0, -height * ascent),
        ...p(width, -height * ascent),
        ...p(0, -height * descent),
        ...p(width, -height * descent),
      ].map(quantize) as Quad;
      const line: Page["lines"][number] = {
        id: `p${pageIndex}:l${out.lines.length}`,
        charIds: [],
        direction: dir.map(quantize) as [number, number],
        writingMode: style.vertical ? "vertical" : "horizontal",
        baseline: [quantize(tx[4]), quantize(tx[5])],
        baselineProvenance: "measured",
      };
      const offsets = scalarOffsets(item.str);
      Array.from(item.str).forEach((c, i) => {
        const id = `${itemId}:s${i}`;
        line.charIds.push(id);
        out.chars.push({
          id,
          text: c,
          rawRange: [raw, ++raw],
          origin: line.baseline,
          quad,
          size: quantize(height) || 1,
          style: JSON.stringify([
            style.fontFamily,
            style.ascent,
            style.descent,
          ]),
          provenance: item.str.trim() ? "extracted" : "inferred",
          precision: "run",
          sharedGeometry: itemId,
          geometryMethod: "engine_run",
          sourceRef: {
            itemId,
            scalarRange: [i, i + 1],
            utf16Range: [offsets[i], offsets[i + 1]],
          },
        });
      });
      out.lines.push(line);
    }
    // The operator stack yields image regions in PDF user space, transformed by
    // the very same viewport used by rendering. No OCR or image-content claims.
    this.timings.sourceAdaptation += performance.now() - adaptationStart;
    const coverageStart = performance.now();
    const ops = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    const imageOps = new Set([
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,
    ]);
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i],
        args = ops.argsArray[i];
      if (fn === pdfjs.OPS.save) stack.push([...ctm]);
      else if (fn === pdfjs.OPS.restore)
        ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === pdfjs.OPS.transform) ctm = transform(ctm, args);
      else if (fn === pdfjs.OPS.paintFormXObjectBegin) {
        stack.push([...ctm]);
        if(args[0])ctm=transform(ctm,args[0]);
      } else if(fn === pdfjs.OPS.paintFormXObjectEnd) {
        ctm=stack.pop()??[1,0,0,1,0,0];
      }
      else if (imageOps.has(fn)) {
        const m = transform(viewport.transform, ctm),
          points = [
            point(m, 0, 0),
            point(m, 1, 0),
            point(m, 0, 1),
            point(m, 1, 1),
          ];
        out.issues.push({
          pageIndex,
          region: [
            Math.min(...points.map((p) => p[0])),
            Math.min(...points.map((p) => p[1])),
            Math.max(...points.map((p) => p[0])),
            Math.max(...points.map((p) => p[1])),
          ].map(quantize) as [number, number, number, number],
          reason: out.chars.length
            ? "unverified_image_text_region"
            : "raster_only_content",
          evidence: "PDF.js image paint operator with graphics-state transform",
          message: out.chars.length
            ? "图片区域未做文字比较（没有 OCR）"
            : "此页只有图片，正文文字尚未比较",
          defaultVisible: true,
        });
      }
    }
    if ((await page.getAnnotations()).length)
      out.issues.push({
        pageIndex,
        region: [0, 0, out.width, out.height],
        reason: "unsupported_objects",
        evidence: "PDF.js annotation objects",
        message: "批注及交互表单对象未作完整比较",
        defaultVisible: true,
      });
    if (out.chars.some((c) => c.text === "�"))
      out.issues.push({
        pageIndex,
        region: [0, 0, out.width, out.height],
        reason: "encoding_unknown",
        evidence: "replacement character",
        message: "存在无法可靠解码的字符",
        defaultVisible: true,
      });
    this.timings.coverageAnalysis += performance.now() - coverageStart;
    out.coverageState = out.issues.length
      ? "suspect"
      : out.chars.length
        ? "text"
        : "confirmed_blank";
    page.cleanup();
    return out;
  }
  async extract(
    onPage?: (page: Page) => void,
    cancelled?: () => boolean,
    retainPages = true,
  ): Promise<DocInput> {
    const pages: Page[] = [];
    let scalars = 0;
    for (let i = 0; i < this.pageCount; i++) {
      if (this.closed || cancelled?.()) throw new Error("CANCELLED");
      let p: Page;
      try {
        p = await this.extractPage(i);
      } catch (error) {
        if (this.closed || cancelled?.()) throw new Error("CANCELLED");
        const bounds=this.bounds.get(i)??{width:595,height:842};
        p = {
          pageIndex: i,
          width: bounds.width,
          height: bounds.height,
          transform: [1, 0, 0, 1, 0, 0],
          inverseTransform: [1, 0, 0, 1, 0, 0],
          chars: [],
          lines: [],
          coverageState: "failed",
          issues: [
            {
              pageIndex: i,
              region: [0, 0, bounds.width, bounds.height],
              reason: "page_failed",
              evidence: "PDF.js strict page extraction: "+(error instanceof Error?error.message:String(error)),
              message: "页面内容解析失败；已读取片段不能证明正文完整",
              defaultVisible: true,
            },
          ],
        };
      }
      scalars += p.chars.length;
      if (scalars > LIMITS.scalars) throw new Error("文档超过 500,000 标量");
      if (retainPages) pages.push(p);
      onPage?.(p);
      await new Promise((r) => setTimeout(r, 0));
    }
    return { ...this.metadata(), pages };
  }
  async render(pageIndex: number, scale = 1.35): Promise<RenderedPage> {
    if (this.closed) throw new Error("文档已关闭");
    if (node)
      throw new Error(
        "PDF.js 精细显示定位需要浏览器文字层，CLI 输出提取项区间与 run 精度",
      );
    const page = await this.doc.getPage(pageIndex + 1),
      unit = page.getViewport({ scale: 1 });
    const bounded = Math.min(
        Math.max(scale, 0.25),
        2,
        Math.sqrt(4_000_000 / (unit.width * unit.height)),
      ),
      viewport = page.getViewport({ scale: bounded });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const content = await page.getTextContent(TEXT_OPTIONS),
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) =>
          b ? resolve(b) : reject(new Error("PNG encoding failed")),
        ),
      );
    // The default text layer uses generic fallback families. Their relative
    // advances can put a comma on the next word even when the whole run fits.
    // Bind to the font that PDF.js actually loaded for this rendered page.
    await document.fonts.ready;
    for(const [id,style] of Object.entries(content.styles)){
      const font=page.commonObjs.has(id)?page.commonObjs.get(id):null;
      if(font?.loadedName&&!font.disableFontFace&&document.fonts.check(`10px "${font.loadedName}"`))style.fontFamily=`"${font.loadedName}", ${style.fontFamily}`;
    }
    const png = new Uint8Array(await blob.arrayBuffer());
    canvas.width = canvas.height = 0;
    return {
      png,
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
      textLayer: {
        content,
        viewBox: page.view,
        userUnit: page.userUnit,
        rotation: page.rotate,
        width: unit.width,
        height: unit.height,
        hash: this.hash,
        pageIndex,
      },
    };
  }
  async destroy() {
    if (!this.closed) {
      this.closed = true;
      await this.task.destroy();
    }
  }
}
export const openSession = PdfJsSession.open;
export async function extractPdf(bytes: Uint8Array, password = "") {
  const s = await openSession(bytes, password);
  try {
    return await s.extract();
  } finally {
    await s.destroy();
  }
}
