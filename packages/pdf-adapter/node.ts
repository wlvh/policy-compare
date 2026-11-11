import type { EngineName, PdfSessionApi } from "./api";
import type { DocInput } from "../contracts/index";
export type { EngineName } from "./api";
export { LIMITS } from "./api";
export async function loadEngine(name: EngineName) {
  if (!["mupdf", "pdfjs"].includes(name))
    throw new Error("Select pdfjs or mupdf explicitly; there is no automatic fallback");
  const module = await import(
    new URL(`../../engines/${name}/adapter.ts`, import.meta.url).href
  );
  return module as {
    openSession(bytes: Uint8Array, password?: string): Promise<PdfSessionApi>;
    extractPdf(bytes: Uint8Array, password?: string): Promise<DocInput>;
    EXTRACTOR_VERSION: string;
  };
}
