import { configureWorker, openSession } from "./adapter";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFWorker } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfClient, PdfSessionApi } from "../../packages/pdf-adapter/api";
export const ENGINE_NAME = "pdfjs";
configureWorker(workerUrl);
export function createPdfClient(): PdfClient {
  let closed = false,
    taskId = 0,
    generation = 0;
  const sessions: PdfSessionApi[] = [];
  const controller = new AbortController();
  const runtime = new PDFWorker();
  const client: PdfClient = {
    onmessage: null,
    onerror: null,
    postMessage(m) {
      void handle(m).catch((error) => {
        if (!closed)
          client.onmessage?.({
            data: {
              type: "error",
              taskId,
              generation,
              message:
                error instanceof Error ? error.message : "PDF.js 处理失败",
            },
          } as MessageEvent);
      });
    },
    terminate() {
      closed = true;
      controller.abort();
      for (const s of sessions) void s.destroy();
      sessions.length = 0;
      runtime.destroy();
    },
  };
  const send = (data: unknown) => {
    if (!closed) client.onmessage?.({ data } as MessageEvent);
  };
  async function handle(m: any) {
    if (m.type === "open") {
      taskId = m.taskId;
      generation = m.generation;
      const start = performance.now();
      let pdfOpen = 0;
      for (let side = 0; side < 2; side++) {
        const opening = performance.now();
        const session = await openSession(
          new Uint8Array(m.bytes[side]),
          m.passwords[side],
          controller.signal,
          runtime,
        );
        if (closed) {
          await session.destroy();
          return;
        }
        pdfOpen += performance.now() - opening;
        sessions.push(session);
        m.port.postMessage({
          type: "meta",
          taskId,
          generation,
          side,
          meta: session.metadata(),
        });
        await session.extract(
          (page) => {
            if (closed) return;
            m.port.postMessage({
              type: "page",
              taskId,
              generation,
              side,
              page,
              sentAt: performance.timeOrigin + performance.now(),
            });
            send({
              type: "page",
              taskId,
              generation,
              side,
              pageIndex: page.pageIndex,
              width: page.width,
              height: page.height,
              pageCount: session.pageCount,
            });
          },
          () => closed,
          false,
        );
        if (closed) return;
        m.port.postMessage({
          type: "done",
          taskId,
          generation,
          side,
          sentAt: performance.timeOrigin + performance.now(),
        });
      }
      send({
        type: "extracted",
        taskId,
        generation,
        ms: performance.now() - start,
        breakdown: {
          pdfOpen,
          nativeTextExtraction: sessions.reduce(
            (n, s) => n + (s.timings?.nativeTextExtraction ?? 0),
            0,
          ),
          sourceAdaptation: sessions.reduce(
            (n, s) => n + (s.timings?.sourceAdaptation ?? 0),
            0,
          ),
          coverageAnalysis: sessions.reduce(
            (n, s) => n + (s.timings?.coverageAnalysis ?? 0),
            0,
          ),
        },
      });
    }
    if (m.type === "render" && !closed) {
      const renderStart = performance.now();
      const bitmap = await sessions[m.side].render(m.pageIndex, m.scale);
      send({
        type: "render",
        taskId,
        generation,
        side: m.side,
        pageIndex: m.pageIndex,
        requestId: m.requestId,
        renderMs: performance.now() - renderStart,
        ...bitmap,
      });
    }
  }
  runtime.promise
    .then(() => send({ type: "ready" }))
    .catch((e) => {
      if (!closed) client.onerror?.(e);
    });
  return client;
}
