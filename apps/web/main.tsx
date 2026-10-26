import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  CompareResult,
  SourceLocation,
} from "../../packages/contracts/index";
import "./style.css";
import { createPdfClient, ENGINE_NAME } from "@policy/pdf-client";
import { PageCanvas } from "./PageCanvas";
import type { PdfClient, TextLayerView } from "../../packages/pdf-adapter/api";
declare global {
  interface Window {
    __policyMetrics: Record<string, unknown>;
  }
}
type PageInfo = { width: number; height: number };
type Snapshot = { url: string; pageIndex: number; textLayer?: unknown };
const categories = {
  Material: "重要变化",
  Review: "需要复核",
  RollForward: "期间顺延",
  Cosmetic: "形式变化",
};
const kinds = {
  Added: "新增",
  Removed: "删除",
  Replaced: "修改",
  Moved: "移动",
};
function App() {
  const [files, setFiles] = useState<(File | null)[]>([null, null]),
    [passwords, setPasswords] = useState(["", ""]),
    [activeNames, setActiveNames] = useState(["", ""]),
    [imagesLoaded, setImagesLoaded] = useState([false, false]);
  const [engineReady, setEngineReady] = useState(false);
  const prepared = useRef<{ client: PdfClient; ready: Promise<void> } | null>(
      null,
    ),
    initializing = useRef<PdfClient | null>(null);
  const [state, setState] = useState("idle"),
    [message, setMessage] = useState("选择基准版与待审版，开始本地比较。");
  const [result, setResult] = useState<CompareResult | null>(null),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [searchSide, setSearchSide] = useState("both"),
    [hits, setHits] = useState<SourceLocation[][]>([]);
  const [pages, setPages] = useState([0, 0]),
    [pageInfos, setPageInfos] = useState<PageInfo[][]>([[], []]),
    [snapshots, setSnapshots] = useState<(Snapshot | null)[]>([null, null]);
  const [selection, setSelection] = useState<SourceLocation[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [sync, setSync] = useState(true);
  const workers = useRef<{ pdf: PdfClient; core: Worker } | null>(null),
    generation = useRef(0),
    renderIds = useRef([0, 0]),
    urls = useRef<string[]>([]),
    start = useRef(0),
    ready = useRef(false),
    searchRequest = useRef(0),
    paneRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)],
    scrollGuard = useRef(false);
  const metrics = useRef<Record<string, unknown>>({ activeWorkers: 0 });
  const cancellation=useRef<Int32Array|null>(null);
  function release() {
    if(cancellation.current)Atomics.store(cancellation.current,0,1);
    cancellation.current=null;
    initializing.current?.terminate();
    initializing.current = null;
    prepared.current?.client.terminate();
    prepared.current = null;
    setEngineReady(false);
    workers.current?.pdf.terminate();
    workers.current?.core.terminate();
    workers.current = null;
    urls.current.forEach(URL.revokeObjectURL);
    urls.current = [];
    metrics.current.activeWorkers = 0;
    window.__policyMetrics = { ...metrics.current };
  }
  useEffect(() => {
    const client = createPdfClient();
    const ready = new Promise<void>((resolve, reject) => {
      client.onmessage = (e) => {
        if (e.data.type === "ready") {
          setEngineReady(true);
          resolve();
        }
      };
      client.onerror = reject;
    });
    prepared.current = { client, ready };
    void ready.catch(() => setMessage("引擎初始化失败，请重新开始任务。"));
    return () => release();
  }, []);
  function cancel() {
    generation.current++;
    release();
    setState("cancelled");
    setMessage("本次任务已取消。");
    setResult(null);
    setSnapshots([null, null]);
    setHits([]);
    metrics.current.cancelledAt = performance.now();
    window.__policyMetrics = { ...metrics.current };
  }
  async function run() {
    if (!files[0] || !files[1]) return;
    const warm = prepared.current;
    prepared.current = null;
    release();
    initializing.current = warm?.client ?? null;
    const token = ++generation.current;
    start.current = performance.now();
    ready.current = false;
    metrics.current = { activeWorkers: 2, start: start.current };
    window.__policyMetrics = metrics.current;
    setActiveNames(files.map((f) => f!.name));
    setImagesLoaded([false, false]);
    setResult(null);
    setHits([]);
    setSelection([]);
    setPageInfos([[], []]);
    setPages([0, 0]);
    setSnapshots([null, null]);
    setFilter("all");
    setState("running");
    setMessage("正在读取与提取 PDF…");
    if (files.some((f) => f!.size > 30 * 1024 * 1024)) {
      setState("failed");
      setMessage("文件超过每份 30 MiB 上限");
      release();
      return;
    }
    try {
      const bytes = await Promise.all(files.map((f) => f!.arrayBuffer()));
      if (token !== generation.current) return;
      metrics.current.read = performance.now() - start.current;
      if (warm) await warm.ready;
      if (token !== generation.current) {
        warm?.client.terminate();
        return;
      }
      const pdf = warm?.client ?? createPdfClient(),
        core = new Worker(new URL("./core.worker.ts", import.meta.url), {
          type: "module",
        });
      workers.current = { pdf, core };
      initializing.current = null;
      const channel = new MessageChannel();
      const abortBuffer=globalThis.crossOriginIsolated&&typeof SharedArrayBuffer!=='undefined'?new SharedArrayBuffer(4):null;
      cancellation.current=abortBuffer?new Int32Array(abortBuffer):null;metrics.current.cooperativeCancellation=Boolean(abortBuffer);
      core.postMessage(
        { type: "init", taskId: token, generation: token, port: channel.port1,abortBuffer },
        [channel.port1],
      );
      function failure(text: string) {
        if (token !== generation.current) return;
        generation.current++;
        release();
        setState("failed");
        setMessage(text);
        setResult(null);
      }
      const timeout = window.setTimeout(
        () => failure("计算超过 120 秒上限，任务已终止"),
        120_000,
      );
      const receive = (e: MessageEvent) => {
        const m = e.data;
        if (token !== generation.current) return;
        if (m.type === "ready") {
          metrics.current.workerInitialization =
            performance.now() - start.current - Number(metrics.current.read);
          pdf.postMessage(
            {
              type: "open",
              taskId: token,
              generation: token,
              bytes,
              passwords,
              port: channel.port2,
            },
            [...bytes, channel.port2],
          );
          return;
        }
        if (m.taskId !== token || m.generation !== token) return;
        if (m.type === "error") {
          clearTimeout(timeout);
          failure(m.message);
        }
        if (m.type === "page") {
          setPageInfos((old) => {
            const next = old.map((x) => [...x]);
            next[m.side][m.pageIndex] = { width: m.width, height: m.height };
            return next;
          });
          setMessage(
            `正在提取${m.side ? "待审" : "基准"}版：${m.pageIndex + 1} / ${m.pageCount} 页`,
          );
        }
        if (m.type === "extracted") {
          metrics.current.extraction = m.ms;
          Object.assign(metrics.current, m.breakdown);
          setMessage("文字提取完成，正在建立对应与计算差异…");
        }
        if (m.type === "result") {
          clearTimeout(timeout);
          setResult(m.result);
          Object.assign(metrics.current, m.timings, {
            coreReady: performance.now() - start.current,
          });
          const first = m.result.differences[0];
          const leftPage = first?.left[0]?.pageIndex ?? 0,
            rightPage = first?.right[0]?.pageIndex ?? 0;
          setPages([leftPage, rightPage]);
          setSelection(
            first
              ? first.textOps
                  .filter((o: { kind: string }) => o.kind !== "equal")
                  .flatMap(
                    (o: {
                      left: SourceLocation[];
                      right: SourceLocation[];
                    }) => [...o.left, ...o.right],
                  )
              : [],
          );
          setSelectedId(first?.id ?? "");
          for (const [side, pageIndex] of [
            [0, leftPage],
            [1, rightPage],
          ])
            pdf.postMessage({
              type: "render",
              taskId: token,
              generation: token,
              side,
              pageIndex,
              requestId: ++renderIds.current[side],
              scale: 1.35,
            });
          setState(m.result.status);
          setMessage(
            m.result.status === "partial"
              ? "比较未完全完成，请检查覆盖缺口和待复核范围。"
              : m.result.differences.length
                ? "可提取文本比较完成，所有变化默认可见。"
                : "可提取文本中未发现差异。",
          );
        }
        if (m.type === "render") {
          if (!ready.current)
            metrics.current.renderMs =
              Number(metrics.current.renderMs ?? 0) + m.renderMs;
          if (m.requestId !== renderIds.current[m.side]) return;
          const blob = new Blob([m.png], { type: "image/png" }),
            url = URL.createObjectURL(blob);
          urls.current.push(url);
          setSnapshots((old) => {
            const copy = [...old];
            if (copy[m.side]) {
              URL.revokeObjectURL(copy[m.side]!.url);
              urls.current = urls.current.filter(
                (x) => x !== copy[m.side]!.url,
              );
            }
            copy[m.side] = {
              url,
              pageIndex: m.pageIndex,
              textLayer: m.textLayer,
            };
            return copy;
          });
        }
        if (m.type === "search" && m.requestId === searchRequest.current)
          setHits(m.hits);
      };
      pdf.onmessage = receive;
      core.onmessage = receive;
      pdf.onerror = () => {
        clearTimeout(timeout);
        failure("PDF Worker 异常终止");
      };
      core.onerror = () => {
        clearTimeout(timeout);
        failure("比较 Worker 异常终止");
      };
      if (warm) {
        metrics.current.workerInitialization = 0;
        pdf.postMessage(
          {
            type: "open",
            taskId: token,
            generation: token,
            bytes,
            passwords,
            port: channel.port2,
          },
          [...bytes, channel.port2],
        );
      }
    } catch {
      release();
      setState("failed");
      setMessage("文件读取或任务启动失败");
    }
  }
  useEffect(() => {
    if (
      result &&
      snapshots.every(Boolean) &&
      imagesLoaded.every(Boolean) &&
      !ready.current
    ) {
      ready.current = true;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          metrics.current.total = performance.now() - start.current;
          metrics.current.firstRender =
            Number(metrics.current.total) - Number(metrics.current.coreReady);
          metrics.current.status = result.status;
          window.__policyMetrics = { ...metrics.current };
        }),
      );
    }
  }, [result, snapshots, imagesLoaded]);
  function showPage(side: number, pageIndex: number) {
    if (!pageInfos[side][pageIndex]) return;
    setPages((old) => old.map((x, i) => (i === side ? pageIndex : x)));
    workers.current?.pdf.postMessage({
      type: "render",
      taskId: generation.current,
      generation: generation.current,
      side,
      pageIndex,
      requestId: ++renderIds.current[side],
      scale: 1.35,
    });
  }
  function locate(locs: SourceLocation[]) {
    setSelection(locs);
    for (const [side, name] of [
      [0, "left"],
      [1, "right"],
    ] as const) {
      const l = locs.find((x) => x.side === name);
      if (l) {
        showPage(side, l.pageIndex);
        const pane = paneRefs[side].current;
        if (pane) {
          const width = pane.clientWidth;
          pane.scrollTop = Math.max(
            0,
            (l.quads[0][1] * width) / pageInfos[side][l.pageIndex].width - 90,
          );
        }
      }
    }
  }
  function doSearch() {
    setHits([]);
    workers.current?.core.postMessage({
      type: "search",
      taskId: generation.current,
      generation: generation.current,
      requestId: ++searchRequest.current,
      query,
      side: searchSide,
    });
  }
  function exportJson() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "policy-comparison.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function onScroll(side: number) {
    if (!sync || scrollGuard.current || !result) return;
    const from = paneRefs[side].current,
      to = paneRefs[1 - side].current;
    if (!from || !to) return;
    const relevant = result.alignment.filter(
      (a) => a.leftPage === pages[0] && a.rightPage === pages[1],
    );
    if (!relevant.length) return;
    scrollGuard.current = true;
    const scale = from.clientWidth / pageInfos[side][pages[side]].width;
    const y = from.scrollTop / scale;
    const ordered = relevant
      .map((a) => (side ? [a.rightY, a.leftY] : [a.leftY, a.rightY]))
      .sort((a, b) => a[0] - b[0]);
    let a = ordered[0],
      b = ordered.at(-1)!;
    for (let i = 1; i < ordered.length; i++)
      if (ordered[i][0] >= y) {
        a = ordered[i - 1];
        b = ordered[i];
        break;
      }
    const target =
      a[1] + ((y - a[0]) * (b[1] - a[1])) / Math.max(1, b[0] - a[0]);
    to.scrollTop = Math.max(
      0,
      (target * to.clientWidth) / pageInfos[1 - side][pages[1 - side]].width,
    );
    requestAnimationFrame(() => {
      scrollGuard.current = false;
    });
  }
  const visible =
    result?.differences.filter(
      (d) => filter === "all" || d.category === filter,
    ) ?? [];
  return (
    <main data-engine-ready={engineReady}>
      <header>
        <div>
          <div className="eyebrow">
            POLICY COMPARE / 本地审阅 · {ENGINE_NAME}
          </div>
          <h1>让每处变化，都有原文依据。</h1>
          <p>基准 → 待审 · PDF 在此浏览器内处理</p>
        </div>
        <div className="privacy">
          本地处理<span>不上传文档 · 无 OCR</span>
        </div>
      </header>
      <section className="input-panel" aria-label="文档选择">
        {[0, 1].map((side) => (
          <div className="file-field" key={side}>
            <label htmlFor={"file-" + side}>
              {side ? "02 待审版" : "01 基准版"}
            </label>
            <input
              id={"file-" + side}
              aria-label={side ? "待审 PDF" : "基准 PDF"}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFiles((old) => old.map((x, i) => (i === side ? f : x)));
              }}
            />
            <small>
              {files[side]?.name ?? "选择本地 PDF，每份最多 100 页 / 30 MiB"}
            </small>
            <input
              type="password"
              aria-label={side ? "待审 PDF 密码" : "基准 PDF 密码"}
              placeholder="受保护文件密码（可选）"
              value={passwords[side]}
              onChange={(e) =>
                setPasswords((old) =>
                  old.map((x, i) => (i === side ? e.target.value : x)),
                )
              }
            />
          </div>
        ))}
        <div className="actions">
          <button
            className="primary"
            onClick={run}
            disabled={!files.every(Boolean)}
          >
            开始比较
          </button>
          <button
            onClick={() => {
              setFiles([files[1], files[0]]);
              for(const [side,file] of [files[1],files[0]].entries()){const input=document.getElementById(`file-${side}`) as HTMLInputElement;const transfer=new DataTransfer();if(file)transfer.items.add(file);input.files=transfer.files;}
              setPasswords([passwords[1], passwords[0]]);
            }}
          >
            交换方向
          </button>
          <button onClick={cancel} disabled={state !== "running"}>
            取消
          </button>
        </div>
      </section>
      <section
        className={
          "status " +
          (state === "partial" || state === "failed" ? "attention" : "")
        }
        role="status"
        data-status={state}
      >
        <strong>
          {state === "running"
            ? "处理中"
            : state === "partial"
              ? "未完全覆盖"
              : state === "complete_for_scope"
                ? "比较完成"
                : state === "cancelled"
                  ? "已取消"
                  : state === "failed"
                    ? "处理失败"
                    : "准备就绪"}
        </strong>
        <span>{message}</span>
        {result && <button onClick={exportJson}>导出 JSON</button>}
        <button
          onClick={() => {
            generation.current++;
            release();
            setResult(null);
            setState("idle");
            setMessage("任务已关闭，文档资源已释放。");
            setSnapshots([null, null]);
            setPageInfos([[], []]);
            setHits([]);
            setPasswords(["", ""]);
          }}
        >
          关闭任务
        </button>
      </section>
      {result &&
        (result.coverage.length > 0 || result.unresolved.length > 0) && (
          <section className="gaps">
            <h2>需要核验的范围</h2>
            {result.coverage.map((c, i) => (
              <button
                key={"c" + i}
                onClick={() => showPage(c.side === "left" ? 0 : 1, c.pageIndex)}
              >
                {c.side === "left" ? "基准" : "待审"} · 第 {c.pageIndex + 1}{" "}
                页：{c.message}
              </button>
            ))}
            {result.unresolved.map((u, i) => (
              <button
                key={"u" + i}
                onClick={() => locate([...u.left, ...u.right])}
              >
                {u.message}
              </button>
            ))}
          </section>
        )}
      <div className="workspace">
        <aside>
          <div className="list-head">
            <h2>
              变化清单 <span>{result?.stats.differenceCount ?? 0}</span>
            </h2>
            <select
              aria-label="差异分类"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部变化</option>
              {Object.entries(categories).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <p className="subtle">
            默认展示所有变化 · 当前筛选隐藏{" "}
            {(result?.differences.length ?? 0) - visible.length} 项
          </p>
          <div className="search">
            <input
              aria-label="搜索原文"
              placeholder="搜索词语或短语"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
            />
            <select
              aria-label="搜索范围"
              value={searchSide}
              onChange={(e) => setSearchSide(e.target.value)}
            >
              <option value="both">两侧</option>
              <option value="left">基准</option>
              <option value="right">待审</option>
            </select>
            <button onClick={doSearch} disabled={!result}>
              搜索
            </button>
          </div>
          {hits.length > 0 && (
            <div className="hits">
              {hits.map((h, i) => (
                <button key={i} onClick={() => locate(h)}>
                  {h[0]?.side === "left" ? "基准" : "待审"} P
                  {(h[0]?.pageIndex ?? 0) + 1} · {h.map((x) => x.text).join("")}
                </button>
              ))}
            </div>
          )}
          <div className="cards">
            {!result && (
              <div className="empty">
                两份 PDF，一份有据可查的变化清单。
                <p>
                  金额、日期、标签和标点变化均保留。图片中的文字会明确列为未覆盖。
                </p>
              </div>
            )}
            {visible.map((d) => (
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.target===e.currentTarget&&['Enter',' '].includes(e.key)){e.preventDefault();e.currentTarget.click();}}}
                className={"card " + (selectedId === d.id ? "selected" : "")}
                key={d.id}
                onClick={() => {
                  setSelectedId(d.id);
                  const ops = d.textOps
                    .filter((x) => x.kind !== "equal")
                    .flatMap((x) => [...x.left, ...x.right]);
                  locate(ops.length ? ops : [...d.left, ...d.right]);
                }}
              >
                <div>
                  <span className={"badge " + d.category}>
                    {categories[d.category]}
                  </span>
                  <b>{kinds[d.kind]}</b>
                </div>
                <h3>
                  {[
                    !['risk_details','repeated_header','clauses','aircraft_schedule','after_aircraft_schedule','document'].includes(d.structurePath?.section??'')?d.structurePath?.section:null,
                    d.structurePath?.entity,
                    d.structurePath?.rowKey,
                    d.structurePath?.field,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "条款文字"}
                </h3>
                <div className="old">{d.oldText || "（无）"}</div>
                <div className="new">{d.newText || "（无）"}</div>
                <small>
                  {d.reviewReasons.join("；") ||
                    d.matchEvidence.details
                      .map((x) =>
                        x === "主体与字段身份一致"
                          ? x
                          : d.kind === "Moved"
                            ? "条款相对顺序或章节发生变化"
                            : "保留双方字符来源",
                      )
                      .join("；")}
                </small>
                {d.occurrences.length > 0 && (
                  <div className="occurrences">{d.occurrences.length} 处出现位置：{d.occurrences.map((o,i)=><button key={i} aria-label={`出现位置 ${i+1}`} onClick={e=>{e.stopPropagation();setSelectedId(d.id);locate([...o.left,...o.right]);}}>第 {i+1} 处</button>)}</div>
                )}
              </div>
            ))}
          </div>
        </aside>
        <section className="documents">
          <div className="viewer-toolbar">
            <span>
              原文定位 ·{" "}
              {ENGINE_NAME === "pdfjs" ? "文字层区间测量" : "原生字符四边形"}
            </span>
            <label>
              <input
                type="checkbox"
                checked={sync}
                onChange={(e) => setSync(e.target.checked)}
              />{" "}
              同步滚动
            </label>
          </div>
          <div className="dual">
            {[0, 1].map((side) => (
              <div className="document" key={side}>
                <div className="document-head">
                  <strong>{side ? "待审版" : "基准版"}</strong>
                  <span title={activeNames[side]}>
                    {activeNames[side] || "尚未选择"}
                  </span>
                  <nav>
                    <button
                      aria-label={(side ? "待审" : "基准") + "上一页"}
                      disabled={!pages[side]}
                      onClick={() => showPage(side, pages[side] - 1)}
                    >
                      ‹
                    </button>
                    <span>
                      {pageInfos[side].length ? pages[side] + 1 : 0} /{" "}
                      {pageInfos[side].length}
                    </span>
                    <button
                      aria-label={(side ? "待审" : "基准") + "下一页"}
                      disabled={pages[side] + 1 >= pageInfos[side].length}
                      onClick={() => showPage(side, pages[side] + 1)}
                    >
                      ›
                    </button>
                  </nav>
                </div>
                <div
                  className="page-scroll"
                  ref={paneRefs[side]}
                  onScroll={() => onScroll(side)}
                >
                  {snapshots[side] &&
                  pageInfos[side][snapshots[side]!.pageIndex] ? (
                    <PageCanvas
                      key={side}
                      url={snapshots[side]!.url}
                      pageIndex={snapshots[side]!.pageIndex}
                      side={side}
                      info={pageInfos[side][snapshots[side]!.pageIndex]}
                      textLayer={snapshots[side]!.textLayer}
                      coverage={(result?.coverage??[]).filter(c=>c.side===(side?'right':'left')&&c.pageIndex===snapshots[side]!.pageIndex)}
                      selection={selection.filter(
                        (l) =>
                          l.side === (side ? "right" : "left") &&
                          l.pageIndex === snapshots[side]!.pageIndex,
                      )}
                      evidence={(
                        result?.differences.flatMap((d) => [
                          ...d.left,
                          ...d.right,
                          ...d.textOps.flatMap((o) => [...o.left, ...o.right]),
                          ...d.occurrences.flatMap((o) => [
                            ...o.left,
                            ...o.right,
                          ]),
                        ]) ?? []
                      ).filter(
                        (l) =>
                          l.side === (side ? "right" : "left") &&
                          l.pageIndex === snapshots[side]!.pageIndex,
                      )}
                      onReady={(ms) => {
                        if (!ready.current)
                          metrics.current.locationMs =
                            Number(metrics.current.locationMs ?? 0) + ms;
                        setImagesLoaded((old) =>
                          old.map((v, i) => (i === side ? true : v)),
                        );
                      }}
                      onError={(error) => {
                        setState("failed");
                        setMessage("定位失败：" + error);
                      }}
                    />
                  ) : (
                    <div className="page-empty">
                      {side ? "待审原文" : "基准原文"}
                      <span>比较后显示可定位的 PDF 页面</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer>
        完整仅指可提取文本范围。分类辅助人工审阅，不输出法律解释。
        <span>开发验证版 · 正式许可与业务留出验收尚未完成</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
