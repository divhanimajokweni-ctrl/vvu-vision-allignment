'use client';

// src/components/sphere/SphereFrame.tsx — Task 47 · the TRUST SPHERE
// projection (#/sphere): a same-origin iframe of the four-file
// trust-sphere artifact (public/vvu-trust/surfaces/trust-sphere/) with a
// provenance strip whose md5/bytes/sha256 are COMPUTED FROM DISK by
// /api/vvu/sphere-meta — never hardcoded, so this strip cannot lie.
//
// The artifact is self-contained (zero dependencies); the frame only
// embeds it. data-vvu-pip marks the stage as pop-out-able (Ctrl+Shift+P /
// the right-click "Pop out" gesture in pinnable-panels.js).

import { useEffect, useState } from 'react';
import { externalLinkAria } from '@/lib/watchboard-ledger';

interface ArtifactMeta {
  md5: string;
  sha256: string;
  bytes: number;
  file: string;
}

const ARTIFACT_URL = '/vvu-trust/surfaces/trust-sphere/trust-sphere.html';

export function SphereFrame() {
  const [meta, setMeta] = useState<ArtifactMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/vvu/sphere-meta', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((m: ArtifactMeta) => {
        if (!cancelled) setMeta(m);
      })
      .catch((e: unknown) => {
        if (!cancelled) setMetaError(e instanceof Error ? e.message : 'UNREACHABLE');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sphere-frame" data-vvu-pip="sphere">
      <iframe
        src={ARTIFACT_URL}
        className="sphere-frame-canvas"
        title="Trust Sphere — 420-node seven-state machine with the metrics surface"
      />
      <div className="sphere-frame-rail">
        <span className="sphere-frame-provenance">
          {meta
            ? `TRUST-SPHERE.HTML · ${meta.bytes.toLocaleString('en-ZA')} BYTES · md5 ${meta.md5.slice(0, 8)}… · sha256 ${meta.sha256.slice(0, 8)}…`
            : metaError
              ? `ARTIFACT META UNREACHABLE (${metaError}) — INTEGRITY NOT ASSERTED`
              : 'READING ARTIFACT INTEGRITY…'}
        </span>
        <span className="sphere-frame-honesty">SEED DATA · NOT LIVE · METRICS: SOURCE LINE ON EVERY CARD</span>
        <div className="sphere-frame-actions">
          <a
            className="sphere-frame-open"
            href={ARTIFACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={externalLinkAria('OPEN STANDALONE', 'the trust sphere artifact')}
            title="Open the artifact standalone (it is self-contained)"
          >
            OPEN STANDALONE <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
      <style>{`
        .sphere-frame {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          background: #060806;
        }
        .sphere-frame-canvas {
          flex: 1;
          width: 100%;
          border: 0;
          background: #060806;
        }
        .sphere-frame-rail {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 7px 12px;
          background: rgba(6, 8, 6, 0.96);
          border-top: 1px solid rgba(107, 138, 64, 0.22);
          /* reserve the fixed lime toggle's corner (bottom-right) */
          padding-right: 320px;
        }
        .sphere-frame-provenance {
          font-family: "Geist Mono", "SF Mono", Menlo, Consolas, monospace;
          font-size: 9px;
          letter-spacing: 1px;
          color: #7a8a6e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sphere-frame-honesty {
          font-family: "Geist Mono", "SF Mono", Menlo, Consolas, monospace;
          font-size: 8px;
          letter-spacing: 1.4px;
          color: #e0a030;
          border: 1px solid rgba(224, 160, 48, 0.4);
          border-radius: 4px;
          padding: 2px 6px;
          white-space: nowrap;
        }
        .sphere-frame-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sphere-frame-open {
          height: 26px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border-radius: 6px;
          border: 1px solid rgba(107, 138, 64, 0.3);
          background: rgba(6, 8, 6, 0.85);
          color: #7a8a6e;
          font-family: "Geist Mono", "SF Mono", Menlo, Consolas, monospace;
          font-size: 9px;
          letter-spacing: 1.2px;
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .sphere-frame-open:hover {
          color: #c9d4bd;
          border-color: rgba(107, 138, 64, 0.6);
          box-shadow: 0 0 6px rgba(107, 138, 64, 0.25);
        }
        .sphere-frame-open:focus-visible {
          outline: none;
          box-shadow: 0 0 0 1px rgba(107, 138, 64, 0.7), 0 0 6px rgba(107, 138, 64, 0.35);
        }
        @media (max-width: 719px) {
          .sphere-frame-rail { padding-right: 230px; }
        }
      `}</style>
    </div>
  );
}

export default SphereFrame;
