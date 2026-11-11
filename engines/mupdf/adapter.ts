import * as mupdf from "mupdf";
import {
  VERSION,
  hashBytes,
  quantize,
  type DocInput,
  type Page,
  type Quad,
} from "../../packages/contracts/index";

export const EXTRACTOR_VERSION = "mupdf/1.28.1+scalar-fix.1";
export const TEXT_OPTIONS =
  "preserve-ligatures,preserve-whitespace,preserve-images,inhibit-spaces,clip";
export const LIMITS = { bytes: 30 * 1024 * 1024, pages: 100, scalars: 500_000 };

// Native MuPDF calls are synchronous. Scope callbacks to the current operation
// rather than associating global console output with whichever document is open.
let nativeMessages:string[]|null=null;
mupdf.setLog({
  error(message){nativeMessages?.push(message);console.error(message);},
  warning(message){
    if(/read error|premature end|truncated (?:data|stream)|cannot decode/i.test(message))nativeMessages?.push(message);
    console.warn(message);
  },
});
function collectNative<T>(operation:()=>T):{value:T;messages:string[]}{
  const previous=nativeMessages,messages:string[]=[];nativeMessages=messages;
  try{return {value:operation(),messages};}finally{nativeMessages=previous;}
}

export class PdfSession {
  private document: mupdf.Document;
  readonly hash: string;
  readonly pageCount: number;
  private disposed = false;
  timings = {
    nativeTextExtraction: 0,
    sourceAdaptation: 0,
    coverageAnalysis: 0,
  };
  constructor(bytes: Uint8Array, password = "") {
    if (bytes.byteLength > LIMITS.bytes)
      throw new Error("File exceeds the 30 MiB limit");
    this.hash = hashBytes(bytes);
    const opened=collectNative(()=>mupdf.Document.openDocument(bytes, "application/pdf"));
    this.document = opened.value;
    try {
      if(opened.messages.length)throw new Error('MuPDF document parsing error: '+[...new Set(opened.messages)].join('; '));
      if (
        this.document.needsPassword() &&
        !this.document.authenticatePassword(password)
      )
        throw new Error("PASSWORD_REQUIRED: Enter the PDF password for local processing");
      const counted=collectNative(()=>this.document.countPages());
      if(counted.messages.length)throw new Error('MuPDF page tree parsing error: '+[...new Set(counted.messages)].join('; '));
      this.pageCount = counted.value;
      if (!this.pageCount || this.pageCount > LIMITS.pages)
        throw new Error("PDF must contain between 1 and 100 pages");
    } catch (e) {
      this.document.destroy();
      throw e;
    }
  }
  extractPage(pageIndex: number): Page {
    const {value:page,messages}=collectNative(()=>this.readPage(pageIndex));
    if(messages.length){
      page.issues.push({pageIndex,region:[0,0,page.width,page.height],reason:'page_failed',evidence:'MuPDF native page diagnostics: '+[...new Set(messages)].join('; '),message:'Page content has parsing errors; the extracted fragments do not establish that the body text is complete',defaultVisible:true});
      page.coverageState='suspect';
    }
    return page;
  }
  private readPage(pageIndex:number):Page {
    if (this.disposed) throw new Error("Document is closed");
    const page = this.document.loadPage(pageIndex);
    let text: mupdf.StructuredText | undefined;
    try {
      const bounds = page.getBounds();
      const ox = bounds[0],
        oy = bounds[1];
      const out: Page = {
        pageIndex,
        width: quantize(bounds[2] - ox),
        height: quantize(bounds[3] - oy),
        transform: [1, 0, 0, 1, -ox, -oy],
        inverseTransform: [1, 0, 0, 1, ox, oy],
        chars: [],
        lines: [],
        issues: [],
        coverageState: "text",
      };
      const nativeStart = performance.now();
      text = page.toStructuredText(TEXT_OPTIONS);
      this.timings.nativeTextExtraction += performance.now() - nativeStart;
      const adaptationStart = performance.now();
      let offset = 0;
      text.walk({
        beginLine(_box, mode, direction) {
          out.lines.push({
            id: `p${pageIndex}:l${out.lines.length}`,
            charIds: [],
            direction: direction.map(quantize) as [number, number],
            writingMode: mode ? "vertical" : "horizontal",
            baseline: [0, 0],
            baselineProvenance: "measured",
          });
        },
        onChar: (c, origin, font, size, quad) => {
          try {
            const id = `${this.hash}:p${pageIndex}:c${out.chars.length}`;
            const line = out.lines.at(-1)!;
            const xy = [quantize(origin[0] - ox), quantize(origin[1] - oy)] as [
              number,
              number,
            ];
            if (!line.charIds.length) line.baseline = xy;
            line.charIds.push(id);
            const n = Array.from(c).length;
            out.chars.push({
              id,
              text: c,
              rawRange: [offset, offset + n],
              origin: xy,
              quad: quad.map((v, i) => quantize(v - (i % 2 ? oy : ox))) as Quad,
              size: quantize(size),
              style: font.getName(),
              provenance: "extracted",
              precision: "glyph",
              sharedGeometry: null,
              geometryMethod: "native_glyph",
            });
            offset += n;
          } finally {
            font.destroy();
          }
        },
        onImageBlock(box, _matrix, image) {
          try {
            out.issues.push({
              pageIndex,
              region: [box[0] - ox, box[1] - oy, box[2] - ox, box[3] - oy].map(
                quantize,
              ) as [number, number, number, number],
              reason: "unverified_image_text_region",
              evidence: "MuPDF StructuredText image block",
              message: "Text in image regions has not been compared (OCR is not available)",
              defaultVisible: true,
            });
          } finally {
            image.destroy();
          }
        },
      });
      if (!out.chars.length && out.issues.length)
        for (const issue of out.issues) {
          issue.reason = "raster_only_content";
          issue.message = "This page contains only images; its body text has not been compared";
        }
      if (
        out.chars.some(
          (c) => c.text.includes("\uFFFD") || /[\uD800-\uDFFF]/u.test(c.text),
        )
      )
        out.issues.push({
          pageIndex,
          region: [0, 0, out.width, out.height],
          reason: "encoding_unknown",
          evidence: "replacement or isolated surrogate character",
          message: "Some characters could not be reliably decoded",
          defaultVisible: true,
        });
      if (page instanceof mupdf.PDFPage) {
        const annotations = page.getAnnotations(),
          widgets = page.getWidgets();
        if (annotations.length || widgets.length)
          out.issues.push({
            pageIndex,
            region: [0, 0, out.width, out.height],
            reason: "unsupported_objects",
            evidence: `${annotations.length} annotation objects; ${widgets.length} widgets`,
            message: "Annotations and interactive form objects have not been fully compared",
            defaultVisible: true,
          });
        annotations.forEach((a) => a.destroy());
        widgets.forEach((w) => w.destroy());
      }
      out.coverageState = out.issues.length
        ? "suspect"
        : out.chars.length
          ? "text"
          : "confirmed_blank";
      // Multiple code points sharing a glyph retain the original, unsplit quad.
      const geometry = new Map<string, typeof out.chars>();
      for (const c of out.chars) {
        const key = JSON.stringify(c.quad);
        const list = geometry.get(key) ?? [];
        list.push(c);
        geometry.set(key, list);
      }
      for (const list of geometry.values())
        if (list.length > 1)
          for (const c of list) {
            c.sharedGeometry = list[0].id;
            c.precision = "shared_glyph";
          }
      this.timings.sourceAdaptation += performance.now() - adaptationStart;
      return out;
    } finally {
      text?.destroy();
      page.destroy();
    }
  }
  metadata(): Omit<DocInput, "pages"> {
    return {
      schemaVersion: VERSION,
      contentHash: this.hash,
      extractor: {
        name: "MuPDF.js",
        version: EXTRACTOR_VERSION,
        adapterVersion: "mupdf-adapter/3",
        options: {
          structuredText: TEXT_OPTIONS,
          actualText: "engine-default",
          clip: true,
          diagnostics: "scoped-native-errors-and-read-failures/1",
        },
      },
      pageCount: this.pageCount,
      coordinateSystem: "display-top-left-pt/ul-ur-ll-lr",
      indexUnit: "unicode-scalar",
      diagnostics: [],
    };
  }
  async extract(
    onPage?: (page: Page) => void,
    cancelled?: () => boolean,
    retainPages = true,
  ): Promise<DocInput> {
    const pages: Page[] = [];
    let total = 0;
    for (let i = 0; i < this.pageCount; i++) {
      if (cancelled?.()) throw new Error("CANCELLED");
      let page: Page;
      try {
        page = this.extractPage(i);
      } catch {
        page = {
          pageIndex: i,
          width: 595,
          height: 842,
          transform: [1, 0, 0, 1, 0, 0],
          inverseTransform: [1, 0, 0, 1, 0, 0],
          chars: [],
          lines: [],
          coverageState: "failed",
          issues: [
            {
              pageIndex: i,
              region: [0, 0, 595, 842],
              reason: "page_failed",
              evidence: "MuPDF page extraction exception; bounds unavailable",
              message: "Page parsing failed; text comparison is incomplete",
              defaultVisible: true,
            },
          ],
        };
      }
      total += page.chars.reduce(
        (n, c) => n + c.rawRange[1] - c.rawRange[0],
        0,
      );
      if (total > LIMITS.scalars)
        throw new Error("Document exceeds the limit of 500,000 Unicode scalar values");
      if (retainPages) pages.push(page);
      onPage?.(page);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { ...this.metadata(), pages };
  }
  render(
    pageIndex: number,
    scale = 1.25,
  ): { png: Uint8Array; width: number; height: number } {
    if (this.disposed) throw new Error("Document is closed");
    const page = this.document.loadPage(pageIndex);
    let pix: mupdf.Pixmap | undefined;
    try {
      const b = page.getBounds();
      const bounded = Math.min(
        Math.max(scale, 0.25),
        2,
        Math.sqrt(4_000_000 / ((b[2] - b[0]) * (b[3] - b[1]))),
      );
      pix = page.toPixmap(
        mupdf.Matrix.scale(bounded, bounded),
        mupdf.ColorSpace.DeviceRGB,
        false,
        true,
      );
      return {
        png: pix.asPNG().slice(),
        width: pix.getWidth(),
        height: pix.getHeight(),
      };
    } finally {
      pix?.destroy();
      page.destroy();
    }
  }
  destroy() {
    if (!this.disposed) {
      this.disposed = true;
      this.document.destroy();
    }
  }
}
export async function extractPdf(
  bytes: Uint8Array,
  password = "",
): Promise<DocInput> {
  const session = new PdfSession(bytes, password);
  try {
    return await session.extract();
  } finally {
    session.destroy();
  }
}
export async function openSession(bytes: Uint8Array, password = "") {
  return new PdfSession(bytes, password);
}
