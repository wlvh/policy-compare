import type { EngineName, PdfSessionApi } from "./api";
import type { DocInput } from "../contracts/index";
export type { EngineName } from "./api";
export { LIMITS } from "./api";
export async function loadEngine(name: EngineName) {
  if (!["mupdf", "pdfjs"].includes(name))
    throw new Error("明确选择 pdfjs 或 mupdf；不自动回退");
  const module = await import(
    new URL(`../../engines/${name}/adapter.ts`, import.meta.url).href
  );
  return module as {
    openSession(bytes: Uint8Array, password?: string): Promise<PdfSessionApi>;
    extractPdf(bytes: Uint8Array, password?: string): Promise<DocInput>;
    EXTRACTOR_VERSION: string;
  };
}
