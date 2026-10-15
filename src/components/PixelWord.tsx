import { useEffect, useRef } from "react";
import { cn } from "../kit";

/**
 * A word set in Instrument Serif, then rasterised to a coarse pixel grid: the
 * "pixel serif" of Bolna's Symphony identity, made from an OFL font instead of a
 * licensed display face. On load the grid sharpens from big blocks to its final
 * size, like a voice cutting through static. The real text stays in the DOM.
 */
export function PixelWord({
  text,
  className,
  final = 0.045,
  color = "#eeefea",
  accentLast = false,
}: {
  text: string;
  className?: string;
  /** Final pixel size as a fraction of the font size. */
  final?: number;
  color?: string;
  /** Paint the last character (e.g. a full stop) in the accent colour. */
  accentLast?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let start = 0;
    let disposed = false;

    const draw = (pixelFrac: number) => {
      const { width, height } = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(width * dpr));
      cv.height = Math.max(1, Math.round(height * dpr));
      const fontPx = height * 0.86 * dpr;
      const px = Math.max(1, fontPx * pixelFrac);
      off.width = Math.max(1, Math.ceil(cv.width / px));
      off.height = Math.max(1, Math.ceil(cv.height / px));
      octx.clearRect(0, 0, off.width, off.height);
      octx.font = `italic 400 ${fontPx / px}px "Instrument Serif", Georgia, serif`;
      octx.textBaseline = "alphabetic";
      const base = off.height * 0.8;
      const chars = [...text];
      const head = accentLast ? chars.slice(0, -1).join("") : text;
      octx.fillStyle = color;
      octx.fillText(head, 0, base);
      if (accentLast) {
        const w = octx.measureText(head).width;
        octx.fillStyle = getComputedStyle(el).getPropertyValue("--accent").trim() || "#f46622";
        octx.fillText(chars[chars.length - 1], w, base);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(off, 0, 0, off.width * px, off.height * px);
    };

    const run = (t: number) => {
      if (disposed) return;
      if (!start) start = t;
      const p = Math.min(1, (t - start) / 1400);
      const eased = 1 - Math.pow(1 - p, 3);
      draw(0.32 - (0.32 - final) * eased);
      if (p < 1) raf = requestAnimationFrame(run);
    };

    const go = () => {
      if (reduce) draw(final);
      else raf = requestAnimationFrame(run);
    };
    document.fonts?.load(`italic 400 64px "Instrument Serif"`).then(go, go);
    const ro = new ResizeObserver(() => {
      if (!raf || reduce) draw(final);
    });
    ro.observe(el);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [text, final, color, accentLast]);

  return (
    <div ref={wrap} className={cn("relative select-none", className)} role="img" aria-label={text}>
      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
    </div>
  );
}
