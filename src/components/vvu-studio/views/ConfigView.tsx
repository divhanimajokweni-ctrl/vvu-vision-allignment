/**
 * VVU · STUDIO — .vvu/config.json view (syntax-highlighted JSON).
 */
import { CONFIG_JSON } from "@/lib/vvu-studio/content";

function highlightJson(json: string) {
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/&quot;([^&]+)&quot;:/g, '<span style="color:var(--vs-accent)">&quot;$1&quot;</span>:')
    .replace(/: &quot;([^&]*)&quot;/g, ': <span style="color:var(--vs-orange)">&quot;$1&quot;</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:var(--vs-purple)">$1</span>')
    .replace(/: (-?\d+(?:\.\d+)?)/g, ': <span style="color:var(--vs-cyan)">$1</span>');
}

export function ConfigView() {
  const json = JSON.stringify(CONFIG_JSON, null, 2);
  const lines = json.split("\n");
  return (
    <div className="mono p-4 text-[12px] leading-[1.7] text-[#c4c4cc]">
      <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--vs-dim)]">.vvu/config.json</div>
      <pre className="whitespace-pre">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-3 inline-block w-7 shrink-0 select-none text-right text-[var(--vs-dimmer)]">{i + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: highlightJson(line) || "&nbsp;" }} />
          </div>
        ))}
      </pre>
    </div>
  );
}
