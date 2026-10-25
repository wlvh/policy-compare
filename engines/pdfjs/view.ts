import { TextLayer } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextLayerView } from "../../packages/pdf-adapter/api";
import type { Quad } from "../../packages/contracts/index";
export async function createTextLayer(
  container: HTMLElement,
  data: any,
  width: number,
): Promise<TextLayerView> {
  const scale = width / data.width,
    rawDims = {
      pageWidth: data.viewBox[2] - data.viewBox[0],
      pageHeight: data.viewBox[3] - data.viewBox[1],
      pageX: data.viewBox[0],
      pageY: data.viewBox[1],
    };
  container.replaceChildren();
  container.className = "textLayer";
  container.style.setProperty(
    "--total-scale-factor",
    String(scale * data.userUnit),
  );
  container.style.width = rawDims.pageWidth * scale * data.userUnit + "px";
  container.style.height = rawDims.pageHeight * scale * data.userUnit + "px";
  const viewport = {
    scale: scale * data.userUnit,
    rotation: data.rotation,
    rawDims,
  };
  const layer = new TextLayer({
    textContentSource: data.content,
    container,
    viewport: viewport as never,
  });
  await layer.render();
  await document.fonts.ready;
  const divs = new Map<string, HTMLElement>();
  const measuringCanvas=document.createElement('canvas'),ctx=measuringCanvas.getContext('2d')!;
  let index = 0;
  for (const item of data.content.items) {
    if (!("str" in item)) continue;
    const id = `${data.hash}:p${data.pageIndex}:i${index}`;
    const div = layer.textDivs[index++];
    if (div && div.textContent === item.str) {
      // PDF.js quantizes its cached measurement font size. At small display
      // scales this can shift punctuation by a glyph. Re-measure at the actual
      // DOM font size; glyph advances come from the real font, never equal cells.
      const style=getComputedStyle(div);ctx.font=`${style.fontSize} ${style.fontFamily}`;
      const measured=ctx.measureText(item.str).width;
      const minFontSize=Number(getComputedStyle(container).getPropertyValue('--min-font-size'))||1;
      if(measured>0&&item.width>0)div.style.setProperty('--scale-x',String(item.width*scale*data.userUnit*minFontSize/measured));
      divs.set(id, div);
    }
    else throw new Error("文字层与提取项不一致，不能复用偏移");
  }
  return {
    resolve(locations) {
      const quads: Quad[] = [];
      const pageRect = container.parentElement!.getBoundingClientRect();
      for (const location of locations) {
        const local: Quad[] = [];
        for (const source of location.sourceRanges ?? []) {
          const div = divs.get(source.itemId);
          if (!div || !div.firstChild || div.textContent !== source.itemText)
            throw new Error("无法解析提取项来源");
          const range = document.createRange();
          range.setStart(div.firstChild, source.utf16Range[0]);
          range.setEnd(div.firstChild, source.utf16Range[1]);
          for (const rect of range.getClientRects()) {
            const x = (rect.left - pageRect.left) / scale,
              y = (rect.top - pageRect.top) / scale,
              r = (rect.right - pageRect.left) / scale,
              b = (rect.bottom - pageRect.top) / scale;
            if (rect.width > 0 && rect.height > 0)
              local.push([x, y, r, y, x, b, r, b]);
          }
        }
        location.resolvedGeometry = {
          method: "text_layer_range",
          quads: local,
          text: location.text,
        };
        quads.push(...local);
      }
      return quads;
    },
    destroy() {
      layer.cancel();
      container.replaceChildren();
    },
  };
}
