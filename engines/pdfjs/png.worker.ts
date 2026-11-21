export type PngReply =
  | { id: number; png: ArrayBuffer }
  | { id: number; error: string };

const reply = postMessage as (message: PngReply, transfer?: Transferable[]) => void;

onmessage = async ({ data: { id, bitmap } }: MessageEvent<{ id: number; bitmap: ImageBitmap }>) => {
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const destination = canvas.getContext("bitmaprenderer");
    if (destination) {
      destination.transferFromImageBitmap(bitmap);
    } else {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG encoder canvas is unavailable");
      context.drawImage(bitmap, 0, 0);
    }
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const png = await blob.arrayBuffer();
    reply({ id, png }, [png]);
  } catch (error) {
    bitmap.close();
    reply({ id, error: error instanceof Error ? error.message : "PNG encoding failed" });
  }
};
