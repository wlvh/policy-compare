import {foldOccurrences} from './fold-occurrences';
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
  Replaced: "Matched, same position",
  Moved: "Moved",
  Added: "No counterpart in baseline",
  Removed: "No counterpart in revised",
};
// A count change preserves the same text and all its sources; it is not a
// deletion/replacement of that text, nor proof that pagination explains it.
const countOnly = (d: Difference) =>
  d.kind === "Replaced" && !d.hasTextChange && d.oldText === d.newText &&
  !!d.repeat && d.repeat.left !== d.repeat.right;
// Preserve unresolved ownership as a review item, even when its text is equal.
const canSummarizeCount = (d: Difference) =>
  countOnly(d) && d.structurePath?.confidence !== "unresolved";
const occurrenceCount = (count: number) => `${count} occurrence${count === 1 ? "" : "s"}`;
const countDelta = (d: Difference) => {
  const delta = d.repeat!.right - d.repeat!.left;
  return `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} occurrence${Math.abs(delta) === 1 ? "" : "s"}`;
};
const change = (d: Difference) =>
  d.kind === "Added" || d.kind === "Removed"
    ? kinds[d.kind]
    : d.kind === "Moved"
      ? d.hasTextChange
        ? "Moved with text changes"
        : "Moved, text unchanged"
      : d.hasTextChange
        ? "Text changed"
        : countOnly(d) ? "Text unchanged, occurrence count changed" : "Text unchanged";
const bases: Record<string, string> = {
  "declared-table-key": "Matched by table key",
  "reliable-field-identity": "Matched by field identity",
  "row-identity": "Matched by row identity",
  "unique-exact": "Matched by identical source text",
  "exact-context": "Matched by identical source text",
  "repeat-role": "Matched by identical source text",
  "adjacent-split": "Matched by identical text across adjacent paragraphs",
  "adjacent-merge": "Matched by identical text across adjacent paragraphs",
  "repeated-header": "Repeated text",
  "repeated-table-header": "Repeated table header",
  "page-furniture": "Repeated header/footer",
  "joint-local-alignment": "Matched by similar text",
  "contextual-token-lcs": "Matched by similar text",
};
const basis = (d: Difference) =>
  d.structurePath?.confidence === "unresolved"
    ? "Match unresolved"
    : d.left.length && d.right.length
      ? (bases[d.matchEvidence.method] ?? d.matchEvidence.method)
      : "";
// What a stated fact says, nothing more: page_number_only is a text form (the
// numbers of "Page n" expressions), not a claim that the printed number is the
// PDF page.
const facts: Record<Fact, string> = {
  whitespace_only: "Only whitespace changed",
  page_number_only: "Only numbers in “Page n” expressions changed",
  dates_rolled_forward_one_year: "Both period dates moved forward by one year",
  continued_heading: "Continuation label on a heading present in both versions",
};
function Occurrences({ difference: d, onLocate }: {
  difference: Difference;
  onLocate: (locs: SourceLocation[]) => void;
}) {
  if (countOnly(d)) return <details className="occurrence-details" onClick={e=>e.stopPropagation()}>
    <summary>View all sources</summary>
    <small>{d.reviewReasons.join("; ")}</small>
    <small>These are all source locations in both versions. They do not identify which occurrence was added or removed, or imply a one-to-one correspondence between pages.</small>
    <div className="occurrences">
      {(["left", "right"] as const).map(side => {
        const label = side === "left" ? "Baseline" : "Revised";
        const sources = d.occurrences.filter(o => o[side].length);
        return <div key={side}>
          <p>{label} sources:</p>
          {sources.map((o, i) => <button key={i}
            aria-label={`${label} source ${i + 1}`}
            title={o[side].map(l=>l.text).join("")}
            onClick={e=>{e.stopPropagation();onLocate(o[side]);}}
          >{label} P{o[side][0].pageIndex + 1}{o.context ? " · Context" : ""}</button>)}
        </div>;
      })}
    </div>
  </details>;
  const content = <div className="occurrences">
    {d.occurrences.length} source locations to check individually{d.occurrences.some(o=>o.context)?`; ${d.occurrences.filter(o=>o.context).length} are alternative text from the same row, shown as context only and excluded from the count`:''}:
    {d.occurrences.map((o,i)=>{
      const where=[o.left[0]&&`Baseline P${o.left[0].pageIndex+1}`,o.right[0]&&`Revised P${o.right[0].pageIndex+1}`,o.context&&'Context'].filter(Boolean).join(' · ');
      const text=(locs:SourceLocation[])=>locs.map(l=>l.text).join('')||'(none)';
      return <button key={i} aria-label={`Source location ${i+1}`} title={`${text(o.left)} → ${text(o.right)}`} onClick={e=>{e.stopPropagation();onLocate([...o.left,...o.right]);}}>{i+1} · {where}</button>;
    })}
  </div>;
  return content;
}
function RepeatCountSummary({ differences, onLocate }: {
  differences: Difference[];
  onLocate: (locs: SourceLocation[]) => void;
}) {
  if (!differences.length) return null;
  return <section className="repeat-summary" aria-label="Repeated text counts">
    <details open>
      <summary>Repeated text count changes · {differences.length} {differences.length === 1 ? "item" : "items"}</summary>
      <div className="repeat-summary-body">
        <p>The text is identical; only its occurrence count changed. These items appear separately from the main changes list. The specific locations added or removed are unresolved.</p>
        <ul>{differences.map(d => <li key={d.id} className="repeat-count-item">
          <div className="repeat-count-head">
            <span>{d.oldText}</span>
            <strong>{occurrenceCount(d.repeat!.left)} → {occurrenceCount(d.repeat!.right)}</strong>
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
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [startupError, setStartupError] = useState('');
  const [sampleLoading, setSampleLoading] = useState(false);
  const sampleRequest = useRef<AbortController | null>(null);
  const prepared = useRef<{ client: PdfClient; ready: Promise<void>; cancel: () => void } | null>(
      null,
    ),
    initializing = useRef<typeof prepared.current>(null);
  const [state, setState] = useState("idle"),
    [message, setMessage] = useState("Choose the baseline and revised PDFs to compare them locally.");
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
  const taskTimers=useRef<Set<number>>(new Set());
  function release() {
    setPreparingPdf(false);
    for(const timer of taskTimers.current)clearTimeout(timer);taskTimers.current.clear();
    sampleRequest.current?.abort();
    sampleRequest.current = null;
    if(cancellation.current)Atomics.store(cancellation.current,0,1);
    cancellation.current=null;
    initializing.current?.cancel();
    initializing.current = null;
    prepared.current?.cancel();
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
    setPreparingPdf(true);
    try {
      if (!window.isSecureContext || !window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined')
        throw new Error('The site security configuration is incomplete. Open the tool on localhost or through a trusted HTTPS address. If the problem persists, ask the maintainer to check the isolation response headers.');
      if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined')
        throw new Error('This browser does not support the required background processing. Use a recent version of Chrome or Edge supported by your organization.');
      const client = createPdfClient();
      let cancel = () => {};
      const ready = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('PDF engine download and initialization exceeded 60 seconds. Check your connection and try again.')), 60_000);
        cancel = () => {
          clearTimeout(timeout);
          client.onmessage = null;
          client.onerror = null;
          client.terminate();
          reject(new Error('PDF engine preparation cancelled'));
        };
        client.onmessage = (e) => {
          if (e.data.type === "ready") {
            clearTimeout(timeout);
            setEngineReady(true);
            setPreparingPdf(false);
            resolve();
          }
        };
        client.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('The PDF engine could not be loaded. Try again; if the problem persists, contact the maintainer.'));
        };
      });
      prepared.current = { client, ready, cancel };
    void ready.catch(error => {
      if (prepared.current?.client !== client) return;
      prepared.current.cancel();
      prepared.current = null;
      setPreparingPdf(false);
      setStartupError(error.message);
    });
    } catch (error) { setPreparingPdf(false); setStartupError((error as Error).message); }
  }
  useEffect(() => {
    prepareEngine();
    return () => release();
  }, []);
  function cancel() {
    generation.current++;
    release();
    setState("cancelled");
    setMessage("This task was cancelled.");
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
    initializing.current = warm;
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
    setMessage("Reading PDFs and extracting text…");
    if (files.some((f) => f!.size > 30 * 1024 * 1024)) {
      setState("failed");
      setMessage("A file exceeds the 30 MiB limit per PDF.");
      release();
      return;
    }
    try {
      const bytes = await Promise.all(files.map((f) => f!.arrayBuffer()));
      if (token !== generation.current) return;
      metrics.current.read = performance.now() - start.current;
      if (warm) {
        setMessage("Downloading and initializing the PDF engine (up to 60 seconds)…");
        await warm.ready;
      }
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
        setMessage(text.includes('PASSWORD') ? `This PDF requires the correct password. Enter it below the corresponding file and try again (${text.includes('PASSWORD_REQUIRED') ? 'PASSWORD_REQUIRED' : 'PASSWORD_ERROR'}).`
          : /invalid|corrupt|format|pars(?:e|ing)|损坏|解析/i.test(text) ? 'The PDF could not be read completely. It may be damaged or use an unsupported format. Check it in your usual PDF reader or obtain a new copy.' : text);
        setResult(null);
      }
      setMessage("Downloading and initializing the comparison engine (up to 60 seconds)…");
      let timeout: number | undefined;
      let pdfReady=Boolean(warm),coreReady=false,opened=false;
      const openOnce=()=>{
        if(opened||!pdfReady||!coreReady||token!==generation.current)return;
        opened=true;
        clearTimeout(initializationTimeout);
        taskTimers.current.delete(initializationTimeout);
        timeout = window.setTimeout(() => failure("Computation exceeded the 120-second limit. The task was stopped."), 120_000);
        taskTimers.current.add(timeout);
        setMessage("Reading PDFs and extracting text…");
        metrics.current.workerInitialization=performance.now()-start.current-Number(metrics.current.read);
        pdf.postMessage({type:'open',taskId:token,generation:token,bytes,passwords:selectedPasswords,port:channel.port2},[...bytes,channel.port2]);
      };
      const initializationTimeout = window.setTimeout(
        () => failure('PDF or comparison engine download and initialization exceeded 60 seconds. The task was stopped. Please try again.'),
        60_000,
      );
      taskTimers.current.add(initializationTimeout);
      const receive = (e: MessageEvent, source:'pdf'|'core') => {
        const m = e.data;
        if (token !== generation.current) return;
        if(source==='pdf'&&m.type==='ready'){pdfReady=true;openOnce();return;}
        if(source==='core'&&m.type==='core-ready'&&m.taskId===token&&m.generation===token){
          coreReady=true;metrics.current.coreInitialization=m.initialization;metrics.current.coreArtifact=m.coreArtifact;openOnce();return;
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
            `Extracting ${m.side ? "revised" : "baseline"} PDF: page ${m.pageIndex + 1} / ${m.pageCount}`,
          );
        }
        if (m.type === "extracted") {
          metrics.current.extraction = m.ms;
          Object.assign(metrics.current, m.breakdown);
          setMessage("Text extraction complete. Matching content and computing differences…");
        }
        if (m.type === "phase") {
          const names:Record<string,string>={snapshot:"Checking the input snapshot…",structure:"Recovering text structure…",matching:"Matching content…",diff:"Computing source text changes…",done:"Comparison complete. Displaying results…"};
          setMessage(names[m.name]||"Comparing…");
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
              ? `Recorded ${m.result.coverage.length} coverage gaps and ${m.result.unresolved.length} unresolved matches; see the list below. Text and position changes are shown by default. Repeated text count changes are summarized separately.`
              : m.result.differences.length
                ? "No coverage gaps or unresolved matches were recorded. Text and position changes are shown by default; repeated text count changes are summarized separately. Unknown omissions may still exist."
                : "No differences found in extractable text. No coverage gaps or unresolved matches were recorded.",
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
      pdf.onmessage = e=>receive(e,'pdf');
      core.onmessage = e=>receive(e,'core');
      pdf.onerror = () => {
        clearTimeout(timeout);
        failure("The PDF worker stopped unexpectedly.");
      };
      core.onerror = () => {
        clearTimeout(timeout);
        failure("The comparison worker stopped unexpectedly.");
      };
      openOnce();
    } catch {
      if (token !== generation.current) return;
      release();
      setState("failed");
      setMessage("The files could not be read or the task could not be started.");
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
    setMessage('Loading a fictional example from this site…');
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
      if (token === generation.current) { setState('failed'); setMessage('The example could not be loaded. Check your connection and try again.'); }
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
    const peerName = peerSide ? "Revised" : "Baseline";
    setReferenceSide(peerSide);
    let note: string;
    if (!sync) note = `There is no direct source on the ${peerName} side. Synchronized scrolling is off, so its current page is unchanged.`;
    else {
      const offset = alignedOffset(sourceSide, source.pageIndex, source.quads[0][1]);
      if (offset !== null) {
        viewportRefs[peerSide].current?.scrollToOffset(offset - 90);
        note = `There is no direct source on the ${peerName} side. A reference position is shown using existing text matches; this does not locate the source for this item.`;
      } else {
        const p = Math.min(source.pageIndex, pageInfos[peerSide].length - 1);
        if (p >= 0) showPage(peerSide, p);
        note = p >= 0
          ? `There is no direct source on the ${peerName} side, and no text match for this page. ${peerName} PDF page ${p + 1} is shown as a page-number reference only, not a content match.`
          : `There is no direct source on the ${peerName} side and no reference page to display.`;
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
  const displayedDifferences = result ? foldOccurrences(result.differences, [pageInfos[0].length, pageInfos[1].length]) : [];
  const reviewDifferences = displayedDifferences.filter(d => !canSummarizeCount(d));
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
            POLICY COMPARE / LOCAL REVIEW · {ENGINE_NAME}
          </div>
          <h1>Review every change with its source.</h1>
          <p>Baseline → Revised · PDFs processed in this browser</p>
        </div>
        <div className="privacy">
          Local processing<span>No document uploads · No OCR</span>
        </div>
      </header>
      <section className="welcome" aria-label="Getting started">
        <details><summary>Instructions and version information</summary>
          <p>Choose the baseline and revised PDFs (up to 100 pages and 30 MiB each), enter passwords if needed, and start the comparison. Select a change to view its source in both documents. Yellow notices flag content that was not compared or matches that remain unresolved. Filters hide some changes; return to All changes before finishing your review. JSON exports contain source text, so check that you have permission before sharing them. Closing the task releases the current document resources.</p>
          <p>Only extractable text is compared. Text in scanned images is not recognized, and business risk is not assessed. Known limitations remain in complex table attribution and some highlights. This development version is for controlled trials and does not provide a complete policy review conclusion.</p>
          <p>Release: {buildInfo.releaseId} · Engine: {buildInfo.engine} {buildInfo.engineVersion} · Source: {buildInfo.revision.slice(0,12)}</p>
          <p>Comparison core: {buildInfo.coreArtifact.coreVersion} · Artifact SHA-256: <code>{buildInfo.coreArtifact.sha256}</code></p>
          <p>Maintainer: {buildInfo.contact}. You can download diagnostics when reporting a problem. They contain only the version, browser, processing stage, and error code.</p>
          <button onClick={exportDiagnostic}>Download diagnostics</button>
        </details>
        <p>Try a fictional example (starts the comparison automatically):</p>
        <div className="actions">
          {([['P02','Amount change','1315: USD 100 → USD 2000; 1760: USD 1000 is unchanged'],['P01','Identical files','No content change cards'],['E03','Scanned images','Text in images must be marked as not compared; this does not mean there are no changes']] as const).map(([id,label,note]) =>
            <button key={id} disabled={state === 'running' || sampleLoading || !!startupError} onClick={()=>void trySample(id)} title={note}>{id} {label}</button>)}
        </div>
        <p className="subtle">P02: locate an amount change. P01: identical files with no content changes. E03: scanned text must be marked as not compared.</p>
        {startupError ? <div role="alert"><p>{startupError}</p><p>Retrying reloads the application. You will need to select your files again.</p><button onClick={()=>location.reload()}>Retry startup</button></div>
          : preparingPdf && state === 'idle' && <p>Downloading and initializing the PDF engine. The first visit may take up to 60 seconds…</p>}
      </section>
      <section className="input-panel" aria-label="Document selection">
        {[0, 1].map((side) => (
          <div className="file-field" key={side}>
            <label htmlFor={"file-" + side}>
              {side ? "02 Revised" : "01 Baseline"}
            </label>
            <input
              id={"file-" + side}
              aria-label={side ? "Revised PDF" : "Baseline PDF"}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFiles((old) => old.map((x, i) => (i === side ? f : x)));
              }}
            />
            <small>
              {files[side]?.name ?? "Choose a local PDF, up to 100 pages / 30 MiB each"}
            </small>
            <input
              type="password"
              aria-label={side ? "Revised PDF password" : "Baseline PDF password"}
              placeholder="PDF password (if required)"
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
            Compare
          </button>
          <button
            onClick={() => {
              setFiles([files[1], files[0]]);
              for(const [side,file] of [files[1],files[0]].entries()){const input=document.getElementById(`file-${side}`) as HTMLInputElement;const transfer=new DataTransfer();if(file)transfer.items.add(file);input.files=transfer.files;}
              setPasswords([passwords[1], passwords[0]]);
            }}
          >
            Swap files
          </button>
          <button onClick={cancel} disabled={state !== "running"}>
            Cancel
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
            ? "Processing"
            : state === "partial"
              ? "Processing complete · Gaps or unresolved matches recorded"
              : state === "complete_for_scope"
                ? "Processing complete"
                : state === "cancelled"
                  ? "Cancelled"
                  : state === "failed"
                    ? "Processing failed"
                    : "Ready"}
        </strong>
        <span>{message}</span>
        {state === 'failed' && <button onClick={()=>location.reload()}>Reload application (select files again)</button>}
        {result && <button onClick={exportJson}>Export JSON</button>}
        <button
          onClick={() => {
            generation.current++;
            release();
            setResult(null);
            setState("idle");
            setMessage("Task closed. Document resources released.");
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
          Close task
        </button>
      </section>
      {result &&
        (result.coverage.length > 0 || result.unresolved.length > 0) && (
          <section className="gaps">
            <h2>Areas to review</h2>
            {result.coverage.map((c, i) => (
              <button
                key={"c" + i}
                onClick={() => showPage(c.side === "left" ? 0 : 1, c.pageIndex)}
              >
                {c.side === "left" ? "Baseline" : "Revised"} · Page {c.pageIndex + 1}: {c.message}
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
              Changes <span>{reviewDifferences.length}</span>
            </h2>
            <select
              aria-label="Filter by change type"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All changes</option>
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <p className="subtle">
            Text and position changes · Hidden by this filter:{" "}
            {reviewDifferences.length - visible.length} {reviewDifferences.length - visible.length === 1 ? "item" : "items"}
          </p>
          <RepeatCountSummary differences={repeatCounts} onLocate={locs => {
            setSelectedId("");
            const source = locs[0];
            locate(locs, true, source
              ? `Count summary source · ${source.side === "right" ? "Revised" : "Baseline"} PDF page ${source.pageIndex + 1}. This does not identify this location as added or removed.`
              : "This count item has no source location to display.");
          }} />
          <div className="search">
            <input
              aria-label="Search source text"
              placeholder="Word or phrase"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
            />
            <select
              aria-label="Search scope"
              value={searchSide}
              onChange={(e) => setSearchSide(e.target.value)}
            >
              <option value="both">Both sides</option>
              <option value="left">Baseline</option>
              <option value="right">Revised</option>
            </select>
            <button onClick={doSearch} disabled={!result}>
              Search
            </button>
          </div>
          {hits.length > 0 && (
            <div className="hits">
              {hits.map((h, i) => (
                <button key={i} onClick={() => locate(h)}>
                  {h[0]?.side === "left" ? "Baseline" : "Revised"} P
                  {(h[0]?.pageIndex ?? 0) + 1} · {h.map((x) => x.text).join("")}
                </button>
              ))}
            </div>
          )}
          <div className="cards">
            {!result && (
              <div className="empty">
                Two PDFs. A list of changes you can verify.
                <p>
                  Changes to amounts, dates, labels, and punctuation are retained. Text in images is explicitly marked as not covered.
                </p>
              </div>
            )}
            {result && !visible.length && <div className="empty">
              {reviewDifferences.length
                ? "No changes match the current filter."
                : result.coverage.length || result.unresolved.length
                  ? "No change cards to display. Review the coverage gaps or unresolved matches above."
                  : repeatCounts.length
                    ? "No text or position changes found. Repeated text count changes are listed in the count summary."
                    : "No differences found in extractable text."}
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
                        {f === "page_number_only" && !(d.oldText && d.newText) ? "Only “Page n” expressions" : facts[f]}
                      </span>
                    ))}
                  </div>
                )}
                <h3>
                  {[
                    d.structurePath?.section==='page_furniture'?'Header/footer':!['risk_details','repeated_header','clauses','aircraft_schedule','after_aircraft_schedule','document'].includes(d.structurePath?.section??'')?d.structurePath?.section:null,
                    d.structurePath?.entity,
                    d.structurePath?.rowKey,
                    d.structurePath?.field,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "Source text"}
                </h3>
                {!d.hasTextChange && d.oldText === d.newText ? <div className="same-text">{d.oldText}</div> : <>
                  <div className="old">{d.oldText || "(none)"}</div>
                  <div className="new">{d.newText || "(none)"}</div>
                </>}
                {countOnly(d) && <small>Occurrences: {d.repeat!.left} → {d.repeat!.right}; match unresolved. Please check attribution.</small>}
                {d.reviewReasons.length > 0 && (
                  <small>{d.reviewReasons.join("; ")}</small>
                )}
                {d.occurrences.length > 0 && (
                  <Occurrences difference={d} onLocate={locs=>{
                    setSelectedId(d.id);
                    const original=result?.differences.find(record=>[...record.left,...record.right].some(source=>locs.some(loc=>loc.side===source.side&&loc.pageIndex===source.pageIndex&&loc.charIds[0]===source.charIds[0])));
                    const edits=original?.textOps.filter(o=>o.kind!=='equal').flatMap(o=>[...o.left,...o.right])??[];
                    locate(edits.length?edits:locs, !d.hasTextChange, "", original?[...original.left,...original.right]:locs);
                  }} />
                )}
              </div>
            ))}
          </div>
        </aside>
        <section className="documents">
          <div className="viewer-toolbar">
            <span>
              Source locations · Scroll through pages
            </span>
            <label>
              <input
                type="checkbox"
                checked={sync}
                onChange={(e) => setSync(e.target.checked)}
              />{" "}
              Synchronized scrolling
            </label>
          </div>
          {locationHint && <div className="location-hint" aria-live="polite">{locationHint}</div>}
          <div className="dual">
            {[0, 1].map((side) => (
              <div className="document" key={side}>
                <div className="document-head">
                  <strong>{side ? "Revised" : "Baseline"}</strong>
                  {referenceSide === side && <small className="reference-badge" title="This item has no direct source on this side. The displayed content is for reference only.">Reference position</small>}
                  <span title={activeNames[side]}>
                    {activeNames[side] || "No file selected"}
                  </span>
                  <nav>
                    <button
                      aria-label={(side ? "Revised" : "Baseline") + " previous page"}
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
                      aria-label={(side ? "Revised" : "Baseline") + " next page"}
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
                        setMessage(`Comparison results are retained. ${side ? "Revised" : "Baseline"} PDF page ${pageIndex + 1} could not be displayed; see the notice on that page. Also review the recorded coverage gaps or unresolved matches.`);
                      }}
                      onError={(error) => {
                        setState("failed");
                        setMessage("Source navigation failed: " + error);
                      }}
                    /> : (
                    <div className="page-scroll"><div className="page-empty">
                      {side ? "Revised source" : "Baseline source"}
                      <span>PDF pages with source navigation appear after comparison</span>
                    </div></div>
                  )}
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer>
        The comparison covers extractable text only. Text and position changes are shown by default; repeated text count changes are summarized separately. The tool does not assess the importance of changes or provide legal interpretations.
        <span>Local evaluation build · Review license terms before redistribution; business acceptance is not complete</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
