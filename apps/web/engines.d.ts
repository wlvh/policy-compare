declare module "@policy/pdf-engine" {
  export function openSession(
    bytes: Uint8Array,
    password?: string,
  ): Promise<import("../../packages/pdf-adapter/api").PdfSessionApi>;
}
declare module "@policy/pdf-client" {
  export function createPdfClient(): import("../../packages/pdf-adapter/api").PdfClient;
  export const ENGINE_NAME: "pdfjs" | "mupdf";
}
declare module "@policy/pdf-view" {
  export function createTextLayer(
    container: HTMLElement,
    data: unknown,
    width: number,
  ): Promise<import("../../packages/pdf-adapter/api").TextLayerView>;
}
