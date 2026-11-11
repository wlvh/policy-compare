import React, { useEffect, useRef, useState } from "react";
import { createTextLayer } from "@policy/pdf-view";
import type { TextLayerView } from "../../packages/pdf-adapter/api";
import type { SourceLocation, Quad,CoverageIssue } from "../../packages/contracts/index";
export function PageCanvas({
  url,
  pageIndex,
  side,
  active = true,
  info,
  textLayer,
  coverage=[],
  selection,
  neutralSelection = false,
  evidence,
  onReady,
  onError,
}: {
  url: string;
  pageIndex: number;
  side: number;
  active?: boolean;
  info: { width: number; height: number };
  textLayer?: unknown;
  coverage?:CoverageIssue[];
  selection: SourceLocation[];
  neutralSelection?: boolean;
  evidence: SourceLocation[];
  onReady: (ms: number) => void;
  onError: (s: string) => void;
}) {
  const sheet = useRef<HTMLDivElement>(null),
    layer = useRef<HTMLDivElement>(null),
    view = useRef<TextLayerView | null>(null),
    latestSelection = useRef(selection);
  latestSelection.current = selection;
  const [width, setWidth] = useState(0),
    [loaded, setLoaded] = useState(false),
    [resolvedPage, setResolvedPage] = useState<number | null>(null),
    [quads, setQuads] = useState<Quad[]>([]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (sheet.current) observer.observe(sheet.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setLoaded(false); setResolvedPage(null); }, [url]);
  useEffect(() => {
    if (!width || !loaded) return;
    let cancelled = false;
    view.current?.destroy();
    view.current = null;
    const locationStart = performance.now();
    createTextLayer(layer.current!, textLayer, width)
      .then((v) => {
        if (cancelled) {
          v.destroy();
          return;
        }
        view.current = v;
        v.resolve(evidence);
        // A card may be selected while this asynchronous layer is loading.
        // Resolve the current selection, not the one captured at load start.
        setQuads(v.resolve(latestSelection.current));
        setResolvedPage(pageIndex);
        onReady(performance.now() - locationStart);
      })
      .catch((e) => {
        if (!cancelled) onError(String(e));
      });
    return () => {
      cancelled = true;
      view.current?.destroy();
      view.current = null;
    };
  }, [url, width, loaded]);
  useEffect(() => {
    if (view.current) {
      try {
        setQuads(view.current.resolve(selection));
      } catch (e) {
        onError(String(e));
      }
    }
  }, [selection]);
  const focus = neutralSelection && quads.length ? quads.reduce((b, q) => ({
    x0: Math.min(b.x0, q[0], q[2], q[4], q[6]),
    y0: Math.min(b.y0, q[1], q[3], q[5], q[7]),
    x1: Math.max(b.x1, q[0], q[2], q[4], q[6]),
    y1: Math.max(b.y1, q[1], q[3], q[5], q[7]),
  }), {x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity}) : null;
  return (
    <div className="sheet" ref={sheet} data-ready-page={active && resolvedPage === pageIndex ? pageIndex : undefined}>
      <img
        onLoad={() => setLoaded(true)}
        alt={(side ? "Revised" : "Baseline") + " source page " + (pageIndex + 1)}
        src={url}
      />
      <div ref={layer} />
      <svg
        viewBox={`0 0 ${info.width} ${info.height}`}
        aria-label={(side ? "Revised" : "Baseline") + " character highlights"}
      >
        {coverage.map((c,i)=><rect key={'coverage'+i} data-coverage="true" x={c.region[0]} y={c.region[1]} width={c.region[2]-c.region[0]} height={c.region[3]-c.region[1]} fill="#d99a1720" stroke="#b57a09" strokeWidth="1.2" strokeDasharray="5 3"><title>{c.message}</title></rect>)}
        {quads.map((q, i) => (
          <polygon
            key={i}
            points={`${q[0]},${q[1]} ${q[2]},${q[3]} ${q[6]},${q[7]} ${q[4]},${q[5]}`}
            className={neutralSelection ? "highlight-location" : side ? "highlight-new" : "highlight-old"}
          />
        ))}
      </svg>
      {focus && <div className="location-marker" data-location-focus="true" aria-hidden="true"
        style={{left: `${focus.x0 / info.width * 100}%`, top: `${focus.y0 / info.height * 100}%`,
          width: `${(focus.x1 - focus.x0) / info.width * 100}%`, height: `${(focus.y1 - focus.y0) / info.height * 100}%`}}>
        <span className={"location-marker-label" + (focus.y0 * width / info.width < 28 ? " below" : "") + (focus.x0 > info.width * 0.7 ? " right" : "")}>Text example</span>
      </div>}
    </div>
  );
}
