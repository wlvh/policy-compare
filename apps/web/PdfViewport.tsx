import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CoverageIssue, SourceLocation } from "../../packages/contracts/index";
import { PageCanvas } from "./PageCanvas";

type PageInfo = { width: number; height: number };
type Snapshot = { url: string; textLayer?: unknown };
export type RenderedPage = { pageIndex: number; requestId: number; png: ArrayBuffer; textLayer?: unknown };
type RenderFailure = { pageIndex: number; requestId: number; message: string };
export type PdfViewportHandle = {
  receive: (page: RenderedPage) => void;
  receiveError: (error: RenderFailure) => void;
  goTo: (pageIndex: number, y?: number, inset?: number, reveal?: boolean) => void;
  pointOffset: (pageIndex: number, y: number) => number | null;
  scrollToOffset: (offset: number) => void;
};

// Page-sized placeholders provide a real continuous scroll range. Render every
// visible page, plus one neighbour at either end; short pages can share a pane.
export const PdfViewport = forwardRef<PdfViewportHandle, {
  side: number;
  infos: PageInfo[];
  initialPage: number;
  selection: SourceLocation[];
  neutralSelection: boolean;
  evidence: SourceLocation[];
  coverage: CoverageIssue[];
  coverageFocus?: CoverageIssue | null;
  request: (pageIndex: number) => number;
  onPageChange: (pageIndex: number) => void;
  onScroll: (pageIndex: number, y: number) => void;
  onReady: (ms: number) => void;
  onRenderError: (pageIndex: number, message: string) => void;
  onError: (message: string) => void;
}>(function PdfViewport(props, ref) {
  const pane = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const active = useRef(props.initialPage);
  const [pageIndex, setPageIndex] = useState(props.initialPage);
  const cache = useRef(new Map<number, Snapshot>());
  const [snapshots, setSnapshots] = useState(new Map<number, Snapshot>());
  const inFlight = useRef<{ pageIndex: number; requestId: number } | null>(null);
  const renderWindow = useRef<number[]>([]);
  const failures = useRef(new Map<number, string>());
  const [pageErrors, setPageErrors] = useState(new Map<number, string>());
  const mounted = useRef(false);
  const programmaticTop = useRef<number | null>(null);
  const anchorY = useRef(0);

  function slot(p: number) {
    return pane.current?.querySelector<HTMLElement>(`[data-page-index="${p}"]`) ?? null;
  }
  function pointOffset(p: number, y: number) {
    const el = slot(p), info = props.infos[p];
    return el && info ? el.offsetTop + y * el.clientWidth / info.width : null;
  }
  function pump() {
    if (!mounted.current || inFlight.current) return;
    const p = renderWindow.current.find(p => !cache.current.has(p) && !failures.current.has(p));
    if (p === undefined) return;
    inFlight.current = { pageIndex: p, requestId: callbacks.current.request(p) };
  }
  function refreshWindow() {
    const el = pane.current;
    if (!el) return;
    const visible = props.infos.flatMap((_, p) => {
      const page = slot(p);
      return page && page.offsetTop < el.scrollTop + el.clientHeight &&
        page.offsetTop + page.offsetHeight > el.scrollTop ? [p] : [];
    });
    const first = visible[0] ?? active.current, last = visible.at(-1) ?? first;
    // Prioritize the selected visible page, then other visible pages, then
    // prefetch neighbours. Eviction uses this same range, not the page counter.
    renderWindow.current = [...new Set([
      ...(visible.includes(active.current) ? [active.current] : []),
      ...visible, last + 1, first - 1,
    ])].filter(p => props.infos[p]);
    let evicted = false;
    for (const [p, snapshot] of cache.current) {
      if (renderWindow.current.includes(p)) continue;
      URL.revokeObjectURL(snapshot.url);
      cache.current.delete(p);
      evicted = true;
    }
    if (evicted) setSnapshots(new Map(cache.current));
    pump();
  }
  function selectPage(p: number) {
    if (p !== active.current) {
      active.current = p;
      setPageIndex(p);
      callbacks.current.onPageChange(p);
    }
    refreshWindow();
  }
  function visiblePage() {
    const el = pane.current!;
    // The final page may fit entirely below the tail of its predecessor.
    // At the end of the scroll range, the counter should still reach it.
    if (el.scrollHeight > el.clientHeight && el.scrollTop >= el.scrollHeight - el.clientHeight - 1)
      return props.infos.length - 1;
    const top = el.scrollTop + 1;
    return props.infos.findIndex((_, p) => {
      const el = slot(p);
      return el && el.offsetTop + el.offsetHeight > top;
    });
  }
  function rememberPosition(p: number) {
    const el = slot(p);
    if (el) anchorY.current = (pane.current!.scrollTop - el.offsetTop) * props.infos[p].width / el.clientWidth;
  }
  function goTo(p: number, y = 0, inset = 0, reveal = false) {
    const offset = pointOffset(p, y);
    if (offset === null || !pane.current) return;
    pane.current.scrollTop = Math.max(0, offset - inset);
    programmaticTop.current = pane.current.scrollTop;
    selectPage(p);
    rememberPosition(p);
    if (reveal) requestAnimationFrame(() => {
      const el = pane.current;
      if (!el) return;
      const bounds = el.getBoundingClientRect();
      // On narrow screens the viewer is below the cards. Scrolling inside a
      // hidden PDF pane alone cannot show the user the selected source.
      if (bounds.top < 0 || bounds.top + Math.min(bounds.height, 240) > window.innerHeight)
        el.closest('.documents')?.scrollIntoView({block: 'start', inline: 'nearest'});
    });
  }
  useImperativeHandle(ref, () => ({
    goTo, pointOffset,
    scrollToOffset(offset) {
      if (!pane.current) return;
      pane.current.scrollTop = Math.max(0, offset);
      programmaticTop.current = pane.current.scrollTop;
      const p = visiblePage();
      if (p >= 0) { selectPage(p); rememberPosition(p); }
    },
    receive(page) {
      if (!mounted.current || page.requestId !== inFlight.current?.requestId || page.pageIndex !== inFlight.current.pageIndex) return;
      inFlight.current = null;
      if (renderWindow.current.includes(page.pageIndex)) {
        const url = URL.createObjectURL(new Blob([page.png], {type: "image/png"}));
        cache.current.set(page.pageIndex, {url, textLayer: page.textLayer});
        setSnapshots(new Map(cache.current));
      }
      pump();
    },
    receiveError(error) {
      if (!mounted.current || error.requestId !== inFlight.current?.requestId || error.pageIndex !== inFlight.current.pageIndex) return;
      inFlight.current = null;
      failures.current.set(error.pageIndex, error.message);
      setPageErrors(new Map(failures.current));
      callbacks.current.onRenderError(error.pageIndex, error.message);
      pump();
    },
  }));
  useEffect(() => {
    mounted.current = true;
    goTo(props.initialPage);
    let width = pane.current!.clientWidth;
    const observer = new ResizeObserver(() => {
      const next = pane.current!.clientWidth;
      if (next !== width) {
        width = next;
        goTo(active.current, anchorY.current);
      } else refreshWindow(); // Height changes can expose additional pages.
    });
    observer.observe(pane.current!);
    return () => {
      mounted.current = false;
      observer.disconnect();
      for (const snapshot of cache.current.values()) URL.revokeObjectURL(snapshot.url);
      cache.current.clear();
    };
  }, []);

  return <div className="page-scroll" ref={pane} role="region"
    aria-label={`${props.side ? "Revised" : "Baseline"} source document`} tabIndex={0}
    onScroll={() => {
      if (programmaticTop.current !== null && Math.abs(pane.current!.scrollTop - programmaticTop.current) < 0.5) {
        programmaticTop.current = null;
        return;
      }
      programmaticTop.current = null;
      const p = visiblePage();
      if (p < 0) return;
      selectPage(p);
      rememberPosition(p);
      callbacks.current.onScroll(p, anchorY.current);
    }}>
    {props.infos.map((info, p) => {
      const snapshot = snapshots.get(p);
      return <div className="page-slot" key={p} data-page-index={p}
        style={{aspectRatio: `${info.width} / ${info.height}`}}>
        {snapshot ? <PageCanvas
          url={snapshot.url} pageIndex={p} side={props.side} info={info}
          active={p === pageIndex} textLayer={snapshot.textLayer}
          neutralSelection={props.neutralSelection}
          selection={props.selection.filter(l => l.pageIndex === p)}
          evidence={props.evidence.filter(l => l.pageIndex === p)}
          coverage={props.coverage.filter(c => c.pageIndex === p)}
          coverageFocus={props.coverageFocus?.pageIndex === p ? props.coverageFocus : null}
          onReady={ms => { if (p === active.current) callbacks.current.onReady(ms); }}
          onError={message => callbacks.current.onError(message)}
        /> : <div className="page-placeholder" data-page-error={pageErrors.has(p) ? p : undefined}>
          {pageErrors.has(p)
            ? <div role="note">Source page {p + 1} could not be displayed<br />{pageErrors.get(p)}<br />Check this page in a PDF reader. You can still browse the other pages.</div>
            : `Page ${p + 1}`}
        </div>}
      </div>;
    })}
  </div>;
});
