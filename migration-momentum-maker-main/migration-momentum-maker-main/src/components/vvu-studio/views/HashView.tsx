/**
 * VVU · STUDIO — ive/hash_builder.py (canonical JSON → SHA-256 playground).
 */
"use client";
import { useState } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { Card, Button, Term } from "../ui";
import { HashIcon } from "../Icons";

export function HashView() {
  const hashOut = useStudio((s) => s.hashOut);
  const doHash = useStudio((s) => s.doHash);
  const loadSample = useStudio((s) => s.loadHashSample);
  const [input, setInput] = useState(() => loadSample());

  const lines = hashOut
    ? [
        { t: "dim", v: "# canonical" },
        { t: "", v: hashOut.canonical },
        { t: "", v: "" },
        { t: "dim", v: "# SHA-256" },
        { t: "ok", v: hashOut.hash || "—" },
        { t: "", v: "" },
        { t: "dim", v: `# bytes: ${hashOut.bytes}` },
      ]
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">ive/hash_builder.py</div>
        <h1>Canonical Hashing</h1>
        <p className="lede">
          Sorted-key JSON → SHA-256. Two records differing only in key order must
          produce byte-identical input — otherwise verification is a coin flip.
        </p>
      </div>

      <Card title="INPUT JSON">
        <textarea
          className="vvu-input mono h-56 w-full resize-y text-[11px] leading-[1.6]"
          spellCheck={false}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="mt-3 flex gap-1.5">
          <Button variant="primary" onClick={() => doHash(input)}><HashIcon size={13} /> Canonicalise</Button>
          <Button variant="ghost" onClick={() => setInput(loadSample())}>Load sample</Button>
        </div>
      </Card>

      <Card title="OUTPUT">
        {hashOut ? <Term lines={lines} /> : <div className="mono text-[12px] text-[var(--vs-dimmer)]"># press Canonicalise</div>}
      </Card>

      <div className="vvu-doc">
        <div className="callout">
          <strong>Why sorted keys?</strong> Canonical JSON sorts keys recursively so that
          <code className="mx-1">{"{b:1,a:2}"}</code> and
          <code className="mx-1">{"{a:2,b:1}"}</code> hash to the same digest.
        </div>
      </div>
    </div>
  );
}
