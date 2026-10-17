import type { ReactNode } from "react";
import { cn } from "../../kit";
import { CopyButton } from "./ui";

export type CodeLang = "bash" | "json" | "js" | "text";

/**
 * A tiny highlighter for the four kinds of snippet the console shows. It only
 * tints keys, strings, numbers, flags and comments, which is all a reader needs.
 */
const RULES: Record<Exclude<CodeLang, "text">, [RegExp, (m: RegExpExecArray) => string | null][]> = {
  json: [
    [/"(?:\\.|[^"\\])*"(?=\s*:)/y, () => "k"],
    [/"(?:\\.|[^"\\])*"/y, () => "s"],
    [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, () => "n"],
    [/\b(?:true|false|null)\b/y, () => "n"],
    [/[{}[\],:]/y, () => "p"],
  ],
  bash: [
    [/#[^\n]*/y, () => "c"],
    [/'(?:[^'])*'/y, () => "s"],
    [/"(?:\\.|[^"\\])*"/y, () => "s"],
    [/(?<=^|\s)-{1,2}[A-Za-z][\w-]*/y, () => "n"],
    [/(?<=^|\n)\s*(?:curl|export)\b/y, () => "k"],
    [/\\(?=\n)/y, () => "p"],
  ],
  js: [
    [/\/\/[^\n]*/y, () => "c"],
    [/`(?:\\.|[^`\\])*`/y, () => "s"],
    [/"(?:\\.|[^"\\])*"/y, () => "s"],
    [/'(?:\\.|[^'\\])*'/y, () => "s"],
    [/\b(?:const|let|await|async|return|new|if|throw)\b/y, () => "k"],
    [/\b\d+(?:\.\d+)?\b/y, () => "n"],
    [/[{}()[\],;:]/y, () => "p"],
  ],
};

export function highlight(code: string, lang: CodeLang): ReactNode[] {
  if (lang === "text") return [code];
  const rules = RULES[lang];
  const out: ReactNode[] = [];
  let plain = "";
  let i = 0;
  let key = 0;
  const flush = () => {
    if (plain) out.push(plain);
    plain = "";
  };
  while (i < code.length) {
    let hit: { cls: string; text: string } | null = null;
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m.index === i && m[0].length) {
        const c = cls(m);
        if (c) {
          hit = { cls: c, text: m[0] };
          break;
        }
      }
    }
    if (hit) {
      flush();
      out.push(
        <span key={key++} className={hit.cls}>
          {hit.text}
        </span>,
      );
      i += hit.text.length;
    } else {
      plain += code[i++];
    }
  }
  flush();
  return out;
}

export function CodeBlock({
  code,
  lang,
  title,
  meta,
  copy = true,
  className,
  maxHeight,
}: {
  code: string;
  lang: CodeLang;
  title?: ReactNode;
  meta?: ReactNode;
  copy?: boolean;
  className?: string;
  maxHeight?: number;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-2xl border border-hair bg-paper", className)}>
      {(title || copy || meta) && (
        <figcaption className="flex items-center justify-between gap-3 border-b border-hair bg-paper-2 px-4 py-2">
          <span className="flex min-w-0 items-center gap-2 font-mono text-[11.5px] text-muted">{title}</span>
          <span className="flex shrink-0 items-center gap-2">
            {meta}
            {copy && <CopyButton text={code} className="!h-7 !px-2.5 !text-[12px]" />}
          </span>
        </figcaption>
      )}
      <pre className="rk-code rk-scroll-x relative overflow-auto p-4 text-ink-2" style={maxHeight ? { maxHeight } : undefined} tabIndex={0}>
        <code>{highlight(code, lang)}</code>
      </pre>
    </figure>
  );
}
