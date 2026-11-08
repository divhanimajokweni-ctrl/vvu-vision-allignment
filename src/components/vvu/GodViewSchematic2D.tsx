"use client";
import React, { useState } from 'react';
export interface TelemetryNode {
  id: string; name: string; type: 'BENCH'|'PIPE'|'TANK'|'CONTAINER'|'WORM_HEAD';
  x: number; y: number; position?: [number,number,number];
  status: 'ACTIVE'|'DEGRADED'|'SENSOR_ABSENT'|'FAIL_CLOSED';
  metrics: { flowLpm?: number; acousticKhz?: number; pressureBar?: number; headHash?: string; studentsActive?: number; lastPingMs: number; };
}
const DEFAULT_NODES: TelemetryNode[] = [
  { id: 'node-hbk-mk2', name: 'HBK Mk-II Hydro-Bayesian Bench', type: 'BENCH', x: 180, y: 220, position: [-2,0,0], status: 'ACTIVE', metrics: { flowLpm: 12.4, acousticKhz: 2.1, pressureBar: 3.2, lastPingMs: 120 } },
  { id: 'node-pipe-316l', name: '316L/304 Stainless Pipe Gap (15.0mm)', type: 'PIPE', x: 420, y: 220, position: [0,0,0], status: 'ACTIVE', metrics: { flowLpm: 12.3, acousticKhz: 0.4, pressureBar: 3.1, lastPingMs: 85 } },
  { id: 'node-jojo-tank', name: '5,000L Storage Reservoir (Jojo)', type: 'TANK', x: 660, y: 220, position: [2.5,0,0], status: 'ACTIVE', metrics: { flowLpm: 12.1, pressureBar: 4.8, lastPingMs: 210 } },
  { id: 'node-container-hub', name: 'Container Youth Coding Lab (SDG 4)', type: 'CONTAINER', x: 420, y: 450, position: [0,-2,0], status: 'SENSOR_ABSENT', metrics: { studentsActive: 8, lastPingMs: 15400 } },
  { id: 'node-worm-anchor', name: 'ProofBridge WORM Head (E965B01D)', type: 'WORM_HEAD', x: 750, y: 450, position: [3.5,-2,0], status: 'ACTIVE', metrics: { headHash: 'E965B01D8A3F4C', lastPingMs: 15 } },
];
export const GodViewSchematic2D: React.FC<{ nodes?: TelemetryNode[]; onNodeSelect?: (n: TelemetryNode) => void; onConsentRequest?: () => void }> = ({ nodes = DEFAULT_NODES, onNodeSelect, onConsentRequest }) => {
  const [selected, setSelected] = useState<TelemetryNode | null>(nodes[0]); const [showInspector, setShowInspector] = useState(false);
  const [sim, setSim] = useState<TelemetryNode[]>(nodes);
  const toggle = (id: string) => setSim(p => p.map(n => n.id === id ? { ...n, status: n.status === 'ACTIVE' ? 'SENSOR_ABSENT' : n.status === 'SENSOR_ABSENT' ? 'FAIL_CLOSED' : 'ACTIVE' } : n));
  const sc = (s: string) => s === 'ACTIVE' ? '#10B981' : s === 'DEGRADED' ? '#F59E0B' : s === 'SENSOR_ABSENT' ? '#EF4444' : '#DC2626';
  return (
    <div style={{ backgroundColor: '#0F172A', color: '#FFF', fontFamily: `'JetBrains Mono', monospace`, padding: '24px', borderRadius: '8px', border: '1px solid #1E293B' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 10px #10B981' }} />
          <h2 style={{ margin: 0, fontSize: '18px', fontFamily: 'serif', letterSpacing: '0.05em' }}>2D GOD-VIEW SCHEMATIC // VVU EDGE MESH</h2>
        </div><p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '12px' }}>LOCATION: GQEBERHA | PHASE 15 | WORM HEAD: <span style={{ color: '#F59E0B' }}>E965B01D</span></p></div>
        <button onClick={onConsentRequest} style={{ backgroundColor: '#F59E0B', color: '#0F172A', border: 'none', padding: '8px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🔒 POPIA Consent</button>
      </div>
      <div style={{ position: 'relative', backgroundColor: '#090D16', borderRadius: '6px', border: '1px solid #334155', overflow: 'hidden' }}>
        <svg width="100%" height="520" style={{ display: 'block' }}>
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.8" /></pattern>
          <filter id="rg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b" /><feComposite in="SourceGraphic" in2="b" operator="over" /></filter></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <line x1="180" y1="220" x2="420" y2="220" stroke="#334155" strokeWidth="4" strokeDasharray="6 4" />
          <line x1="420" y1="220" x2="660" y2="220" stroke="#334155" strokeWidth="4" strokeDasharray="6 4" />
          <line x1="420" y1="220" x2="420" y2="450" stroke="#334155" strokeWidth="3" />
          <line x1="420" y1="450" x2="750" y2="450" stroke="#334155" strokeWidth="3" strokeDasharray="4 4" />
          <circle cx="280" cy="220" r="4" fill="#10B981"><animate attributeName="cx" from="180" to="420" dur="2s" repeatCount="indefinite" /></circle>
          <circle cx="540" cy="220" r="4" fill="#10B981"><animate attributeName="cx" from="420" to="660" dur="2.2s" repeatCount="indefinite" /></circle>
          {sim.map(n => { const sel = selected?.id === n.id; const abs = n.status === 'SENSOR_ABSENT' || n.status === 'FAIL_CLOSED'; const c = sc(n.status); return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`} onClick={() => { setSelected(n); setShowInspector(true); onNodeSelect?.(n); }} style={{ cursor: 'pointer' }}>
              {abs ? <circle r="36" fill="none" stroke="#EF4444" strokeWidth="2" opacity="0.8" filter="url(#rg)"><animate attributeName="r" values="30;46;30" dur="1.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.2s" repeatCount="indefinite" /></circle> : <circle r="32" fill="none" stroke={c} strokeWidth="1.5" opacity="0.4"><animate attributeName="r" values="28;36;28" dur="3s" repeatCount="indefinite" /></circle>}
              <rect x="-24" y="-24" width="48" height="48" rx="6" fill={abs ? '#2E1015' : '#0F172A'} stroke={sel ? '#F59E0B' : c} strokeWidth={sel ? '3' : '2'} />
              <text x="0" y="6" textAnchor="middle" fill={c} fontSize="16" fontWeight="bold">{n.type === 'BENCH' ? '⚡' : n.type === 'PIPE' ? '🚿' : n.type === 'TANK' ? '🛢️' : n.type === 'CONTAINER' ? '💻' : '🔗'}</text>
              <text x="0" y="42" textAnchor="middle" fill={abs ? '#EF4444' : '#94A3B8'} fontSize="10" fontWeight="600">{n.id.toUpperCase()}</text>
              {abs && <g transform="translate(18,-18)"><circle r="10" fill="#EF4444" /><text x="0" y="4" textAnchor="middle" fill="#FFF" fontSize="11" fontWeight="bold">!</text></g>}
            </g>); })}
        </svg>
        {selected && showInspector && <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '320px', backgroundColor: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${sc(selected.status)}`, borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'bold' }}>INSPECTING NODE</span><span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', backgroundColor: sc(selected.status), color: '#0F172A', fontWeight: 'bold' }}>{selected.status}</span></div>
          <h3 style={{ margin: '8px 0 12px 0', fontSize: '14px' }}>{selected.name}</h3>
          <div style={{ fontSize: '11px', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selected.metrics.flowLpm !== undefined && <div>Flow Rate: <span style={{ color: '#10B981', fontWeight: 'bold' }}>{selected.metrics.flowLpm} L/min</span></div>}
            {selected.metrics.acousticKhz !== undefined && <div>Acoustic: <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>{selected.metrics.acousticKhz} kHz</span></div>}
            {selected.metrics.pressureBar !== undefined && <div>Pressure: <span style={{ color: '#38BDF8', fontWeight: 'bold' }}>{selected.metrics.pressureBar} bar</span></div>}
            {selected.metrics.headHash && <div>WORM: <span style={{ color: '#F59E0B', fontFamily: 'monospace' }}>{selected.metrics.headHash}</span></div>}
            <div>Latency: <span style={{ color: '#94A3B8' }}>{selected.metrics.lastPingMs} ms</span></div>
          </div>
          <button onClick={() => { toggle(selected.id); setShowInspector(false); }} style={{ marginTop: '12px', width: '100%', backgroundColor: selected.status === 'ACTIVE' ? '#2E1015' : '#064E3B', color: selected.status === 'ACTIVE' ? '#EF4444' : '#10B981', border: `1px solid ${selected.status === 'ACTIVE' ? '#EF4444' : '#10B981'}`, padding: '6px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>{selected.status === 'ACTIVE' ? '⚠️ Simulate SENSOR_ABSENT' : '✓ Restore ACTIVE'}</button>
        </div>}
      </div>
    </div>
  );
};
export default GodViewSchematic2D;
