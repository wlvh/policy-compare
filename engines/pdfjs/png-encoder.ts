import type { PngReply } from "./png.worker";

export function encodeCanvasPng(canvas: HTMLCanvasElement): Uint8Array {
  const prefix = "data:image/png;base64,";
  const url = canvas.toDataURL("image/png");
  if (!url.startsWith(prefix)) throw new Error("PNG encoding failed");
  return Uint8Array.from(atob(url.slice(prefix.length)), char => char.charCodeAt(0));
}

export function createPngEncoder(signal: AbortSignal) {
  let worker: Worker | null | undefined;
  let nextId = 0;
  const pending = new Map<number, {
    resolve: (png: Uint8Array) => void;
    reject: (reason: unknown) => void;
  }>();

  function stop(reason: unknown) {
    worker?.terminate();
    worker = null;
    for (const request of pending.values()) request.reject(reason);
    pending.clear();
  }
  signal.addEventListener("abort", () => stop(signal.reason), { once: true });

  function startWorker() {
    if (typeof Worker === "undefined" || typeof createImageBitmap !== "function" ||
        typeof OffscreenCanvas === "undefined" || typeof OffscreenCanvas.prototype.convertToBlob !== "function") {
      return null;
    }
    const encoder = new Worker(new URL("./png.worker.ts", import.meta.url), { type: "module" });
    encoder.onmessage = ({ data }: MessageEvent<PngReply>) => {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      if ("png" in data) request.resolve(new Uint8Array(data.png));
      else request.reject(new Error(data.error));
    };
    encoder.onerror = event => {
      event.preventDefault();
      stop(new Error("PNG encoder worker failed"));
    };
    encoder.onmessageerror = () => stop(new Error("Invalid PNG encoder reply"));
    return encoder;
  }

  return async (canvas: HTMLCanvasElement): Promise<Uint8Array> => {
    signal.throwIfAborted();
    try {
      if (worker === undefined) worker = startWorker();
      const encoder = worker;
      if (encoder) {
        const bitmap = await createImageBitmap(canvas);
        if (encoder !== worker) {
          bitmap.close();
        } else {
          const id = ++nextId;
          return await new Promise<Uint8Array>((resolve, reject) => {
            pending.set(id, { resolve, reject });
            try {
              encoder.postMessage({ id, bitmap }, [bitmap]);
            } catch (error) {
              pending.delete(id);
              bitmap.close();
              reject(error);
            }
          });
        }
      }
    } catch {
      if (worker === undefined) worker = null;
    }
    signal.throwIfAborted();
    // The synchronous fallback also avoids Chromium's main-thread toBlob
    // idle queue when a browser or worker cannot use OffscreenCanvas.
    return encodeCanvasPng(canvas);
  };
}
