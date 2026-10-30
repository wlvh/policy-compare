import React, { useEffect, useRef, useState } from "react";
import { createTextLayer } from "@policy/pdf-view";
import type { TextLayerView } from "../../packages/pdf-adapter/api";
import type { SourceLocation, Quad,CoverageIssue } from "../../packages/contracts/index";
export function PageCanvas({
  url,
  pageIndex,
  side,
  info,
  textLayer,
  coverage=[],
  selection,
  evidence,
  onReady,
  onError,
}: {
  url: string;
  pageIndex: number;
  side: number;
  info: { width: number; height: number };
  textLayer?: unknown;
  coverage?:CoverageIssue[];
  selection: SourceLocation[];
  evidence: SourceLocation[];
  onReady: (ms: number) => void;
  onError: (s: string) => void;
}) {
  const sheet = useRef<HTMLDivElement>(null),
    layer = useRef<HTMLDivElement>(null),
    view = useRef<TextLayerView | null>(null);
  const [width, setWidth] = useState(0),
    [loaded, setLoaded] = useState(false),
    [quads, setQuads] = useState<Quad[]>([]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (sheet.current) observer.observe(sheet.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setLoaded(false), [url]);
  useEffect(() => {
    if (!width || !loaded) return;
    let cancelled = false;
    view.current?.destroy();
    view.current = null;
    delete sheet.current!.dataset.readyPage;
    const locationStart = performance.now();
    createTextLayer(layer.current!, textLayer, width)
      .then((v) => {
        if (cancelled) {
          v.destroy();
          return;
        }
        view.current = v;
        v.resolve(evidence);
        setQuads(v.resolve(selection));
        sheet.current!.dataset.readyPage = String(pageIndex);
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
  return (
    <div className="sheet" ref={sheet}>
      <img
        onLoad={() => setLoaded(true)}
        alt={(side ? "待审" : "基准") + "原文第 " + (pageIndex + 1) + " 页"}
        src={url}
      />
      <div ref={layer} />
      <svg
        viewBox={`0 0 ${info.width} ${info.height}`}
        aria-label={(side ? "待审" : "基准") + "字符高亮"}
      >
        {coverage.map((c,i)=><rect key={'coverage'+i} data-coverage="true" x={c.region[0]} y={c.region[1]} width={c.region[2]-c.region[0]} height={c.region[3]-c.region[1]} fill="#d99a1720" stroke="#b57a09" strokeWidth="1.2" strokeDasharray="5 3"><title>{c.message}</title></rect>)}
        {quads.map((q, i) => (
          <polygon
            key={i}
            points={`${q[0]},${q[1]} ${q[2]},${q[3]} ${q[6]},${q[7]} ${q[4]},${q[5]}`}
            className={side ? "highlight-new" : "highlight-old"}
          />
        ))}
      </svg>
    </div>
  );
}
