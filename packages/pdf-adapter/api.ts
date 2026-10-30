import type { DocInput, Page, SourceLocation, Quad } from "../contracts/index";
export const LIMITS = { bytes: 30 * 1024 * 1024, pages: 100, scalars: 500_000 };
export type EngineName = "pdfjs" | "mupdf";
export type RenderedPage = {
  png: Uint8Array;
  width: number;
  height: number;
  textLayer?: unknown;
};
export interface PdfSessionApi {
  readonly hash: string;
  readonly pageCount: number;
  readonly timings?: Record<string, number>;
  metadata(): Omit<DocInput, "pages">;
  extractPage(index: number): Page | Promise<Page>;
  extract(
    onPage?: (page: Page) => void,
    cancelled?: () => boolean,
    retainPages?: boolean,
  ): Promise<DocInput>;
  render(index: number, scale?: number): RenderedPage | Promise<RenderedPage>;
  destroy(): void | Promise<void>;
}
export interface PdfClient {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage(message: any, transfer?: Transferable[]): void;
  terminate(): void;
}
export interface TextLayerView {
  resolve(locations: SourceLocation[]): Quad[];
  destroy(): void;
}
