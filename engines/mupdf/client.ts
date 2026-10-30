export const ENGINE_NAME = "mupdf";
export function createPdfClient() {
  return new Worker(new URL("../../apps/web/pdf.worker.ts", import.meta.url), {
    type: "module",
  });
}
