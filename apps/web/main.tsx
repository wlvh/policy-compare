import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  CompareResultV2 as CompareResult,
  DifferenceV2 as Difference,
  Fact,
  SourceLocation,
} from "../../packages/contracts/index";
import "./style.css";
import { createPdfClient, ENGINE_NAME } from "@policy/pdf-client";
import { PdfViewport, type PdfViewportHandle } from "./PdfViewport";
import type { PdfClient } from "../../packages/pdf-adapter/api";
import { buildInfo } from './build-info';
declare global {
  interface Window {
    __policyMetrics: Record<string, unknown>;
  }
}
type PageInfo = { width: number; height: number };
// A card states what was found, never how much it matters: the change, what
// paired its two sides, and facts the texts themselves prove.
const kinds = {
  Replaced: "两侧对应、位置未变",
  Moved: "位置移动",
  Added: "基准侧未找到对应",
  Removed: "待审侧未找到对应",
};
// A count change preserves the same text and all its sources; it is not a
// deletion/replacement of that text, nor proof that pagination explains it.
const countOnly = (d: Difference) =>
  d.kind === "Replaced" && !d.hasTextChange && d.oldText === d.newText &&
  !!d.repeat && d.repeat.left !== d.repeat.right;
// Preserve unresolved ownership as a review item, even when its text is equal.
const canSummarizeCount = (d: Difference) =>
  countOnly(d) && d.structurePath?.confidence !== "unresolved";
const countDelta = (d: Difference) => {
  const delta = d.repeat!.right - d.repeat!.left;
  return `${delta > 0 ? "多" : "少"}出现 ${Math.abs(delta)} 次`;
};
const change = (d: Difference) =>
  d.kind === "Added" || d.kind === "Removed"
    ? kinds[d.kind]
    : d.kind === "Moved"
      ? d.hasTextChange
        ? "位置移动，文字也有变化"
        : "位置移动，文字未变"
      : d.hasTextChange
        ? "文字变化"
        : countOnly(d) ? "文字未变，次数变化" : "文字未变";
const bases: Record<string, string> = {
  "declared-table-key": "按表格键对应",
  "reliable-field-identity": "按字段身份对应",
  "row-identity": "按表格行身份对应",
  "unique-exact": "按相同原文对应",
  "exact-context": "按相同原文对应",
  "repeat-role": "按相同原文对应",
  "adjacent-split": "按相邻段落拼合后的相同原文对应",
  "adjacent-merge": "按相邻段落拼合后的相同原文对应",
  "repeated-header": "重复文字",
  "repeated-table-header": "重复表头",
  "page-furniture": "重复页眉/页脚",
  "joint-local-alignment": "按相似文字对应",
  "contextual-token-lcs": "按相似文字对应",
};
const basis = (d: Difference) =>
  d.structurePath?.confidence === "unresolved"
    ? "对应未确定"
    : d.left.length && d.right.length
      ? (bases[d.matchEvidence.method] ?? d.matchEvidence.method)
      : "";
// What a stated fact says, nothing more: page_number_only is a text form (the
// numbers of "Page n" expressions), not a claim that the printed number is the
// PDF page.
const facts: Record<Fact, string> = {
  whitespace_only: "仅空白字符变化",
  page_number_only: "仅分页表达（Page n）中的数字变化",
  dates_rolled_forward_one_year: "期间两端日期各顺延一年",
  continued_heading: "两版都有的标题加续页字样",
};
function Occurrences({ difference: d, onLocate }: {
  difference: Difference;
  onLocate: (locs: SourceLocation[]) => void;
}) {
  if (countOnly(d)) return <details className="occurrence-details" onClick={e=>e.stopPropagation()}>
    <summary>查看全部来源</summary>
    <small>{d.reviewReasons.join("；")}</small>
    <small>以下是两版的全部来源，不表示哪一处新增或减少，也不表示两版页面一一对应。</small>
    <div className="occurrences">
      {(["left", "right"] as const).map(side => {
        const label = side === "left" ? "基准" : "待审";
        const sources = d.occurrences.filter(o => o[side].length);
        return <div key={side}>
          <p>{label}版来源：</p>
          {sources.map((o, i) => <button key={i}
            aria-label={`${label}来源 ${i + 1}`}
            title={o[side].map(l=>l.text).join("")}
            onClick={e=>{e.stopPropagation();onLocate(o[side]);}}
          >{label} P{o[side][0].pageIndex + 1}{o.context ? " · 上下文" : ""}</button>)}
        </div>;
      })}
    </div>
  </details>;
  const content = <div className="occurrences">
    {d.occurrences.length} 处出现位置（逐处核对{d.occurrences.some(o=>o.context)?`；其中 ${d.occurrences.filter(o=>o.context).length} 处是同一行的其他写法，只作上下文，不计入次数`:''}）：
    {d.occurrences.map((o,i)=>{
      const where=[o.left[0]&&`基准 P${o.left[0].pageIndex+1}`,o.right[0]&&`待审 P${o.right[0].pageIndex+1}`,o.context&&'上下文'].filter(Boolean).join(' · ');
      const text=(locs:SourceLocation[])=>locs.map(l=>l.text).join('')||'（无）';
      return <button key={i} aria-label={`出现位置 ${i+1}`} title={`${text(o.left)} → ${text(o.right)}`} onClick={e=>{e.stopPropagation();onLocate([...o.left,...o.right]);}}>{i+1} · {where}</button>;
    })}
  </div>;
  return content;
}
function RepeatCountSummary({ differences, onLocate }: {
  differences: Difference[];
  onLocate: (locs: SourceLocation[]) => void;
}) {
  if (!differences.length) return null;
  return <section className="repeat-summary" aria-label="重复文字次数摘要">
    <details>
      <summary>重复文字次数变化 · {differences.length} 项</summary>
      <div className="repeat-summary-body">
        <p>以下文字相同，仅出现次数变化，不计入主变化清单。具体新增或减少位置未确定。</p>
        <ul>{differences.map(d => <li key={d.id} className="repeat-count-item">
          <div className="repeat-count-head">
            <span>{d.oldText}</span>
            <strong>{d.repeat!.left} 次 → {d.repeat!.right} 次</strong>
          </div>
          <small>{countDelta(d)}</small>
          <Occurrences difference={d} onLocate={onLocate} />
        </li>)}</ul>
      </div>
    </details>
  </section>;
}
function App() {
  const [files, setFiles] = useState<(File | null)[]>([null, null]),
    [passwords, setPasswords] = useState(["", ""]),
    [activeNames, setActiveNames] = useState(["", ""]),
    [imagesLoaded, setImagesLoaded] = useState([false, false]);
  const [engineReady, setEngineReady] = useState(false);
  const [startupError, setStartupError] = useState('');
  const [sampleLoading, setSampleLoading] = useState(false);
  const sampleRequest = useRef<AbortController | null>(null);
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
    [pageInfos, setPageInfos] = useState<PageInfo[][]>([[], []]);
  const [selection, setSelection] = useState<SourceLocation[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [neutralSelection, setNeutralSelection] = useState(false),
    [locationHint, setLocationHint] = useState(""),
    [referenceSide, setReferenceSide] = useState<number | null>(null),
    [sync, setSync] = useState(true);
  const workers = useRef<{ pdf: PdfClient; core: Worker } | null>(null),
    generation = useRef(0),
    renderIds = useRef([0, 0]),
    start = useRef(0),
    ready = useRef(false),
    searchRequest = useRef(0),
    viewportRefs = [useRef<PdfViewportHandle>(null), useRef<PdfViewportHandle>(null)];
  const metrics = useRef<Record<string, unknown>>({ activeWorkers: 0 });
  const cancellation=useRef<Int32Array|null>(null);
  function release() {
    sampleRequest.current?.abort();
    sampleRequest.current = null;
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
    metrics.current.activeWorkers = 0;
    window.__policyMetrics = { ...metrics.current };
  }
  function prepareEngine() {
    setStartupError('');
    try {
      if (!window.isSecureContext || !window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined')
        throw new Error('网站安全配置不完整。请从本机地址或受信任的 HTTPS 入口打开；仍失败请联系维护者检查隔离响应头。');
      if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined')
        throw new Error('此浏览器缺少后台计算能力，请使用组织支持的新版 Chrome 或 Edge。');
      const client = createPdfClient();
      const ready = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('引擎资源加载超过 15 秒，请检查网络并重试。')), 15_000);
      client.onmessage = (e) => {
        if (e.data.type === "ready") {
          clearTimeout(timeout);
          setEngineReady(true);
          resolve();
        }
      };
      client.onerror = () => { clearTimeout(timeout); reject(new Error('引擎资源加载失败，请重试；仍失败请联系维护者。')); };
    });
    prepared.current = { client, ready };
    void ready.catch(error => {
      if (prepared.current?.client !== client) return;
      client.terminate();
      prepared.current = null;
      setStartupError(error.message);
    });
    } catch (error) { setStartupError((error as Error).message); }
  }
  useEffect(() => {
    prepareEngine();
    return () => release();
  }, []);
  function cancel() {
    generation.current++;
    release();
    setState("cancelled");
    setMessage("本次任务已取消。");
    setResult(null);
    setHits([]);
    metrics.current.cancelledAt = performance.now();
    window.__policyMetrics = { ...metrics.current };
  }
  async function run(selected = files, selectedPasswords = passwords) {
    const files = selected;
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
    setNeutralSelection(false);
    setLocationHint("");
    setReferenceSide(null);
    setPageInfos([[], []]);
    setPages([0, 0]);
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
        setMessage(text.includes('PASSWORD') ? `PDF 需要正确密码，请在对应文件下输入后重试（${text.includes('PASSWORD_REQUIRED') ? 'PASSWORD_REQUIRED' : 'PASSWORD_ERROR'}）。`
          : /invalid|corrupt|format|损坏|解析/i.test(text) ? 'PDF 无法完整读取，可能已损坏或格式不受支持。请用原阅读器检查或重新取得文件。' : text);
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
              passwords: selectedPasswords,
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
        if (m.type === "render-error") viewportRefs[m.side].current?.receiveError(m);
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
          const first = m.result.differences.find((d: Difference) => !canSummarizeCount(d));
          setNeutralSelection(first ? !first.hasTextChange : false);
          const firstLocated = first;
          const leftPage = firstLocated?.left[0]?.pageIndex ?? 0,
            rightPage = firstLocated?.right[0]?.pageIndex ?? 0;
          setPages([leftPage, rightPage]);
          setSelection(
            firstLocated
              ? firstLocated.textOps
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
          setState(m.result.status);
          setMessage(
            m.result.status === "partial"
              ? `已记录覆盖缺口 ${m.result.coverage.length} 处、对应未决 ${m.result.unresolved.length} 组，见下方列表；内容与位置变化默认展示，重复次数变化另列数量摘要。`
              : m.result.differences.length
                ? "没有记录到覆盖缺口或未决；内容与位置变化默认展示，重复次数变化另列数量摘要。这不表示不存在未知遗漏。"
                : "可提取文本中未发现差异；没有记录到覆盖缺口或未决。",
          );
        }
        if (m.type === "render") {
          if (!ready.current)
            metrics.current.renderMs =
              Number(metrics.current.renderMs ?? 0) + m.renderMs;
          viewportRefs[m.side].current?.receive(m);
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
            passwords: selectedPasswords,
            port: channel.port2,
          },
          [...bytes, channel.port2],
        );
      }
    } catch {
      if (token !== generation.current) return;
      release();
      setState("failed");
      setMessage("文件读取或任务启动失败");
    }
  }
  async function trySample(id: string) {
    generation.current++;
    release();
    const token = generation.current;
    const controller = new AbortController();
    sampleRequest.current = controller;
    setSampleLoading(true);
    setResult(null);
    setState('idle');
    setMessage('正在从本站加载虚构样例…');
    try {
      const sampleFiles = await Promise.all(['before.pdf','after.pdf'].map(async name => {
        const response = await fetch(`${import.meta.env.BASE_URL}samples/${id}/${name}`, {signal:controller.signal});
        if (!response.ok) throw new Error('sample unavailable');
        return new File([await response.blob()], `${id}-${name}`, {type:'application/pdf'});
      }));
      if (token !== generation.current) return;
      sampleRequest.current = null;
      setFiles(sampleFiles); setPasswords(['','']);
      sampleFiles.forEach((file, side) => { const transfer = new DataTransfer(); transfer.items.add(file); (document.getElementById(`file-${side}`) as HTMLInputElement).files = transfer.files; });
      await run(sampleFiles, ['', '']);
    } catch {
      if (token === generation.current) { setState('failed'); setMessage('样例加载失败，请检查连接后重试。'); }
    } finally { setSampleLoading(false); }
  }
  function exportDiagnostic() {
    const data = {releaseId:buildInfo.releaseId, engine:buildInfo.engine, engineVersion:buildInfo.engineVersion,
      browser:navigator.userAgent, phase:state, errorCode:startupError ? 'STARTUP_FAILED' : state === 'failed' ? 'TASK_FAILED' : 'NONE'};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download='policy-diagnostic.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  useEffect(() => {
    if (
      result &&
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
  }, [result, imagesLoaded]);
  function showPage(side: number, pageIndex: number, y = 0, inset = 0, reveal = false) {
    if (!pageInfos[side][pageIndex]) return;
    viewportRefs[side].current?.goTo(pageIndex, y, inset, reveal);
  }
  function requestPage(side: number, pageIndex: number) {
    const requestId = ++renderIds.current[side];
    workers.current?.pdf.postMessage({
      type: "render",
      taskId: generation.current,
      generation: generation.current,
      side,
      pageIndex,
      requestId,
      scale: 1.35,
    });
    return requestId;
  }
  function locate(locs: SourceLocation[], neutral = false, hint = "", references?: SourceLocation[]) {
    setSelection(locs);
    setNeutralSelection(neutral);
    setLocationHint(hint);
    setReferenceSide(null);
    for (const [side, name] of [
      [0, "left"],
      [1, "right"],
    ] as const) {
      // A pure insertion/deletion inside a paired paragraph may have edited
      // characters on only one side, but both paragraph sources still exist.
      const l = locs.find(x => x.side === name) ?? references?.find(x => x.side === name);
      if (l) {
        showPage(side, l.pageIndex, l.quads[0][1], 90, true);
      }
    }
    if (!references?.length) return;
    const hasLeft = references.some(l => l.side === "left");
    const hasRight = references.some(l => l.side === "right");
    if (hasLeft === hasRight) return;
    const sourceSide = hasLeft ? 0 : 1, peerSide = 1 - sourceSide;
    const source = locs.find(l => l.side === (hasLeft ? "left" : "right")) ?? references[0];
    const peerName = peerSide ? "待审" : "基准";
    setReferenceSide(peerSide);
    let note: string;
    if (!sync) note = `${peerName}侧无直接来源；同步滚动已关闭，保留其当前页。`;
    else {
      const offset = alignedOffset(sourceSide, source.pageIndex, source.quads[0][1]);
      if (offset !== null) {
        viewportRefs[peerSide].current?.scrollToOffset(offset - 90);
        note = `${peerName}侧无直接来源；已按已有文字对应显示参考位置，不表示找到该项原文。`;
      } else {
        const p = Math.min(source.pageIndex, pageInfos[peerSide].length - 1);
        if (p >= 0) showPage(peerSide, p);
        note = p >= 0
          ? `${peerName}侧无直接来源，且本页没有文字对应；仅显示${peerName} PDF 第 ${p + 1} 页作页码参考，不表示内容对应。`
          : `${peerName}侧无直接来源，也没有可显示的参考页。`;
      }
    }
    setLocationHint(hint ? hint + " " + note : note);
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
  function alignedOffset(side: number, pageIndex: number, y: number): number | null {
    if (!result) return null;
    const to = viewportRefs[1 - side].current;
    if (!to) return null;
    // Use the existing text alignment, including across page boundaries.
    // Equal physical page numbers alone do not establish a correspondence.
    const ordered = result.alignment.flatMap(a => {
      if ((side ? a.rightPage : a.leftPage) !== pageIndex) return [];
      const offset = to.pointOffset(side ? a.leftPage : a.rightPage, side ? a.leftY : a.rightY);
      return offset === null ? [] : [[side ? a.rightY : a.leftY, offset]];
    })
      .sort((a, b) => a[0] - b[0]);
    if (!ordered.length) return null;
    let a = ordered[0],
      b = ordered.at(-1)!;
    for (let i = 1; i < ordered.length; i++)
      if (ordered[i][0] >= y) {
        a = ordered[i - 1];
        b = ordered[i];
        break;
      }
    return a[1] + ((y - a[0]) * (b[1] - a[1])) / Math.max(1, b[0] - a[0]);
  }
  function onScroll(side: number, pageIndex: number, y: number) {
    if (!sync) return;
    const target = alignedOffset(side, pageIndex, y);
    if (target !== null) viewportRefs[1 - side].current?.scrollToOffset(target);
  }
  const reviewDifferences = result?.differences.filter(d => !canSummarizeCount(d)) ?? [];
  const repeatCounts = result?.differences.filter(canSummarizeCount) ?? [];
  const visible =
    reviewDifferences.filter(
      (d) => filter === "all" || d.kind === filter,
    );
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
      <section className="welcome" aria-label="首次使用">
        <details><summary>使用说明与版本信息</summary>
          <p>选择基准与待审 PDF（每份最多 100 页、30 MiB），需要时输入密码，再开始比较。点击变化查看两侧原文；黄色提示表示有未比较内容或对应未确定。筛选会隐藏部分变化，核对结束前回到全部变化。JSON 导出含原文，分享前请确认资料授权；关闭任务后释放当前文档资源。</p>
          <p>仅比较可提取文字，不识别扫描图片文字，不判断业务风险。复杂表格归属和部分高亮仍有已知问题，当前供受控开发试用，不能作为完整审单结论。</p>
          <p>发布版本：{buildInfo.releaseId} · 引擎：{buildInfo.engine} {buildInfo.engineVersion} · 源码：{buildInfo.revision.slice(0,12)}</p>
          <p>维护联系：{buildInfo.contact}。反馈时可主动下载诊断；其中只有版本、浏览器、阶段和错误代码。</p>
          <button onClick={exportDiagnostic}>下载诊断</button>
        </details>
        <p>一键试用虚构样例（自动开始比较）：</p>
        <div className="actions">
          {([['P02','金额变化','1315 的 USD 100 → USD 2000；1760 的 USD 1000 未改'],['P01','相同文件','没有内容变化卡'],['E03','扫描图片','必须提示图片文字尚未比较，不能理解为无变化']] as const).map(([id,label,note]) =>
            <button key={id} disabled={state === 'running' || sampleLoading || !!startupError} onClick={()=>void trySample(id)} title={note}>{id} {label}</button>)}
        </div>
        <p className="subtle">P02：金额修改且能定位；P01：相同文件无内容变化；E03：扫描图片应提示文字未比较。</p>
        {startupError ? <div role="alert"><p>{startupError}</p><p>重试会重新加载程序，之后请重新选择文件。</p><button onClick={()=>location.reload()}>重试启动</button></div>
          : !engineReady && state === 'idle' && prepared.current && <p>正在准备比较引擎…</p>}
      </section>
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
            onClick={()=>void run()}
            disabled={!files.every(Boolean) || !!startupError || sampleLoading}
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
              ? "本次处理结束 · 有已记录的缺口或未决"
              : state === "complete_for_scope"
                ? "本次处理结束"
                : state === "cancelled"
                  ? "已取消"
                  : state === "failed"
                    ? "处理失败"
                    : "准备就绪"}
        </strong>
        <span>{message}</span>
        {state === 'failed' && <button onClick={()=>location.reload()}>重新加载程序（需重新选文件）</button>}
        {result && <button onClick={exportJson}>导出 JSON</button>}
        <button
          onClick={() => {
            generation.current++;
            release();
            setResult(null);
            setState("idle");
            setMessage("任务已关闭，文档资源已释放。");
            setPageInfos([[], []]);
            setHits([]);
            setPasswords(["", ""]);
            setFiles([null,null]);
            setActiveNames(['','']);
            setQuery('');
            for (const side of [0,1]) (document.getElementById(`file-${side}`) as HTMLInputElement).value = '';
            setLocationHint("");
            setReferenceSide(null);
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
              变化清单 <span>{reviewDifferences.length}</span>
            </h2>
            <select
              aria-label="按变化方式筛选"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部变化</option>
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <p className="subtle">
            文字与位置变化 · 当前筛选隐藏{" "}
            {reviewDifferences.length - visible.length} 项
          </p>
          <RepeatCountSummary differences={repeatCounts} onLocate={locs => {
            setSelectedId("");
            const source = locs[0];
            locate(locs, true, source
              ? `数量摘要来源 · ${source.side === "right" ? "待审" : "基准"} PDF 第 ${source.pageIndex + 1} 页；不代表该处新增或减少。`
              : "该数量项没有可定位来源。");
          }} />
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
            {result && !visible.length && <div className="empty">
              {reviewDifferences.length
                ? "当前筛选下没有变化卡。"
                : result.coverage.length || result.unresolved.length
                  ? "当前没有可展示的变化卡，请核对上方的缺口或未决说明。"
                  : repeatCounts.length
                    ? "未发现文字或位置变化；另有重复次数变化，见数量摘要。"
                    : "可提取文本中未发现差异。"}
            </div>}
            {visible.map((d) => (
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.target===e.currentTarget&&['Enter',' '].includes(e.key)){e.preventDefault();e.currentTarget.click();}}}
                className={"card " + (selectedId === d.id ? "selected" : "")}
                key={d.id}
                onClick={() => {
                  setSelectedId(d.id);
                  const ops = d.textOps
                    .filter((x) => x.kind !== "equal")
                    .flatMap((x) => [...x.left, ...x.right]);
                  locate(ops.length ? ops : [...d.left, ...d.right], !d.hasTextChange, "", [...d.left, ...d.right]);
                }}
              >
                <div>
                  <span className="badge">{change(d)}</span>
                  <b>{basis(d)}</b>
                </div>
                {d.facts.length > 0 && (
                  <div className="facts">
                    {d.facts.map((f) => (
                      <span key={f}>
                        {f === "page_number_only" && !(d.oldText && d.newText) ? "仅分页表达（Page n）" : facts[f]}
                      </span>
                    ))}
                  </div>
                )}
                <h3>
                  {[
                    d.structurePath?.section==='page_furniture'?'页眉/页脚':!['risk_details','repeated_header','clauses','aircraft_schedule','after_aircraft_schedule','document'].includes(d.structurePath?.section??'')?d.structurePath?.section:null,
                    d.structurePath?.entity,
                    d.structurePath?.rowKey,
                    d.structurePath?.field,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "条款文字"}
                </h3>
                {!d.hasTextChange && d.oldText === d.newText ? <div className="same-text">{d.oldText}</div> : <>
                  <div className="old">{d.oldText || "（无）"}</div>
                  <div className="new">{d.newText || "（无）"}</div>
                </>}
                {countOnly(d) && <small>出现次数：{d.repeat!.left} 次 → {d.repeat!.right} 次；对应未确定，请核对归属。</small>}
                {d.reviewReasons.length > 0 && (
                  <small>{d.reviewReasons.join("；")}</small>
                )}
                {d.occurrences.length > 0 && (
                  <Occurrences difference={d} onLocate={locs=>{
                    setSelectedId(d.id);
                    locate(locs, !d.hasTextChange);
                  }} />
                )}
              </div>
            ))}
          </div>
        </aside>
        <section className="documents">
          <div className="viewer-toolbar">
            <span>
              原文定位 · 滚轮连续浏览
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
          {locationHint && <div className="location-hint" aria-live="polite">{locationHint}</div>}
          <div className="dual">
            {[0, 1].map((side) => (
              <div className="document" key={side}>
                <div className="document-head">
                  <strong>{side ? "待审版" : "基准版"}</strong>
                  {referenceSide === side && <small className="reference-badge" title="本项在该侧没有直接来源，画面内容仅供参考。">参考位置</small>}
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
                {result ? <PdfViewport
                      key={`${generation.current}-${side}`}
                      ref={viewportRefs[side]}
                      infos={pageInfos[side]}
                      initialPage={pages[side]}
                      side={side}
                      neutralSelection={neutralSelection}
                      request={pageIndex => requestPage(side, pageIndex)}
                      onPageChange={pageIndex => setPages(old => old.map((p, i) => i === side ? pageIndex : p))}
                      onScroll={(pageIndex, y) => onScroll(side, pageIndex, y)}
                      coverage={result.coverage.filter(c=>c.side===(side?'right':'left'))}
                      selection={selection.filter(
                        l => l.side === (side ? "right" : "left"),
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
                        l => l.side === (side ? "right" : "left"),
                      )}
                      onReady={(ms) => {
                        if (!ready.current)
                          metrics.current.locationMs =
                            Number(metrics.current.locationMs ?? 0) + ms;
                        setImagesLoaded((old) =>
                          old.map((v, i) => (i === side ? true : v)),
                        );
                      }}
                      onRenderError={(pageIndex) => {
                        setState("partial");
                        setMessage(`比较结果已保留；${side ? "待审" : "基准"} PDF 第 ${pageIndex + 1} 页原文无法显示，详情见该页提示。请同时核对已有的缺口或未决。`);
                      }}
                      onError={(error) => {
                        setState("failed");
                        setMessage("定位失败：" + error);
                      }}
                    /> : (
                    <div className="page-scroll"><div className="page-empty">
                      {side ? "待审原文" : "基准原文"}
                      <span>比较后显示可定位的 PDF 页面</span>
                    </div></div>
                  )}
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer>
        处理范围仅限可提取文本。文字与位置变化默认展示，重复次数变化另列数量摘要；程序不判断变化是否重要，不输出法律解释。
        <span>开发验证版 · 正式许可与业务留出验收尚未完成</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
