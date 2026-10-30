import type { TextLayerView } from "../../packages/pdf-adapter/api";
export async function createTextLayer(): Promise<TextLayerView> {
  return {
    resolve: (locations) => locations.flatMap((l) => l.quads),
    destroy() {},
  };
}
