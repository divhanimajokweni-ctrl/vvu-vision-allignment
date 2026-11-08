/**
 * VVU · STUDIO — generic prose/doc view (README, doctrine, lessons).
 * Renders the block-based DocContent from lib/vvu-studio/content.ts.
 */
import type { DocBlock, DocContent } from "@/lib/vvu-studio/content";
import { DOCS } from "@/lib/vvu-studio/content";
import type { ViewKey } from "@/lib/vvu-studio/types";

const DOCS_BY_VIEW: Record<string, DocContent> = DOCS;

/** Render inline **bold** and `code` markup in a paragraph. */
function inline(text: string) {
  const parts: (string | { b: string } | { c: string })[] = [];
  let i = 0;
  while (i < text.length) {
    const bold = text.indexOf("**", i);
    const code = text.indexOf("`", i);
    const next = bold === -1 ? code : code === -1 ? bold : Math.min(bold, code);
    if (next === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (next > i) parts.push(text.slice(i, next));
    if (next === bold) {
      const end = text.indexOf("**", next + 2);
      if (end === -1) {
        parts.push(text.slice(next));
        break;
      }
      parts.push({ b: text.slice(next + 2, end) });
      i = end + 2;
    } else {
      const end = text.indexOf("`", next + 1);
      if (end === -1) {
        parts.push(text.slice(next));
        break;
      }
      parts.push({ c: text.slice(next + 1, end) });
      i = end + 1;
    }
  }
  return parts.map((p, idx) => {
    if (typeof p === "string") return <span key={idx}>{p}</span>;
    if ("b" in p) return <strong key={idx}>{p.b}</strong>;
    return <code key={idx}>{p.c}</code>;
  });
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "kicker":
      return <div className="vk">{block.text}</div>;
    case "h1":
      return <h1>{block.text}</h1>;
    case "h2":
      return <h2>{block.text}</h2>;
    case "h3":
      return <h3>{block.text}</h3>;
    case "lede":
      return <p className="lede">{inline(block.text)}</p>;
    case "p":
      return <p>{inline(block.text)}</p>;
    case "pre":
      return <pre>{block.text}</pre>;
    case "callout":
      return <div className={block.tone === "warn" ? "callout warn" : "callout"}>{inline(block.text)}</div>;
    case "table":
      return (
        <table>
          <thead>
            <tr>{block.head.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    case "hr":
      return <hr className="my-4 border-[var(--vs-border)]" />;
  }
}

export function DocView({ view }: { view: ViewKey }) {
  const doc: DocContent | undefined = DOCS_BY_VIEW[view];
  if (!doc) return null;
  return (
    <div className="vvu-doc mx-auto max-w-2xl px-6 py-7">
      {doc.blocks.map((b, i) => <Block key={i} block={b} />)}
    </div>
  );
}
