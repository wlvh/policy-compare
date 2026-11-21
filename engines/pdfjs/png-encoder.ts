import type { PngReply } from "./png.worker";

const WORKER_TIMEOUT_MS = 2_000;

export function encodeCanvasPng(canvas: HTMLCanvasElement): Uint8Array {
  const prefix = "data:image/png;base64,";
  const url = canvas.toDataURL("image/png");
  if (!url.startsWith(prefix)) throw new Error("PNG encoding failed");
  const binary = atob(url.slice(prefix.length));
  const png = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) png[i] = binary.charCodeAt(i);
  return png;
}

export function createPngEncoder(signal: AbortSignal, onWorkerActive: (active: boolean) => void) {
  let worker: Worker | null | undefined;
  let nextId = 0;
  const pending = new Map<number, {
    timeout: number;
    resolve: (png: Uint8Array) => void;
    reject: (reason: unknown) => void;
  }>();

  function takeRequest(id: number) {
    const request = pending.get(id);
    if (request) {
      window.clearTimeout(request.timeout);
      pending.delete(id);
    }
    return request;
  }

  function stop(reason: unknown) {
    const encoder = worker;
    worker = null;
    encoder?.terminate();
    for (const request of pending.values()) {
      window.clearTimeout(request.timeout);
      request.reject(reason);
    }
    pending.clear();
    if (encoder) onWorkerActive(false);
  }
  signal.addEventListener("abort", () => stop(signal.reason), { once: true });

  function startWorker() {
    if (typeof Worker === "undefined" || typeof createImageBitmap !== "function" ||
        typeof OffscreenCanvas === "undefined" || typeof OffscreenCanvas.prototype.convertToBlob !== "function") {
      return null;
    }
    const encoder = new Worker(new URL("./png.worker.ts", import.meta.url), { type: "module" });
    encoder.onmessage = ({ data }: MessageEvent<PngReply>) => {
      if (encoder !== worker) return;
      if ("workerError" in data) {
        stop(new Error(data.workerError));
        return;
      }
      const request = takeRequest(data.id);
      if (!request) return;
      if ("png" in data) request.resolve(new Uint8Array(data.png));
      else request.reject(new Error(data.error));
    };
    encoder.onerror = event => {
      event.preventDefault();
      if (encoder === worker) stop(new Error("PNG encoder worker failed"));
    };
    encoder.onmessageerror = () => {
      if (encoder === worker) stop(new Error("Invalid PNG encoder reply"));
    };
    return encoder;
  }

  async function sendBitmap(encoder: Worker, canvas: HTMLCanvasElement, id: number) {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(canvas);
      if (!pending.has(id)) {
        bitmap.close();
        return;
      }
      encoder.postMessage({ id, bitmap }, [bitmap]);
    } catch (error) {
      bitmap?.close();
      takeRequest(id)?.reject(error);
    }
  }

  return async (canvas: HTMLCanvasElement): Promise<Uint8Array> => {
    signal.throwIfAborted();
    try {
      if (worker === undefined) {
        worker = startWorker();
        if (worker) onWorkerActive(true);
      }
      const encoder = worker;
      if (encoder) {
        const id = ++nextId;
        return await new Promise<Uint8Array>((resolve, reject) => {
          // Include worker startup and bitmap preparation in the wait limit.
          const timeout = window.setTimeout(() => stop(new Error("PNG encoder did not respond")), WORKER_TIMEOUT_MS);
          pending.set(id, { timeout, resolve, reject });
          void sendBitmap(encoder, canvas, id);
        });
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
