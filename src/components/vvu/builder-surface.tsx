"use client";

import { useState, useEffect } from "react";
import {
  KeyRound, GitBranch, Upload, Settings, Activity, Server,
  CheckCircle2, AlertTriangle, Loader2, Lock, Unlock, RefreshCw,
  ExternalLink, RotateCw
} from "lucide-react";

interface RepoInfo {
  name: string;
  branch: string;
  url: string;
  fileCount: number;
  status: "cloned" | "remote-only" | "error";
}

interface SecretEntry {
  key: string;
  value: string;
  masked: boolean;
  provider?: string;
  rotateUrl?: string;
}

const TOKEN_ROTATE_LINKS: Record<string, { provider: string; url: string; label: string }> = {
  GITHUB_TOKEN: { provider: "GitHub", url: "https://github.com/settings/tokens/new?scopes=repo,read:org,write:packages&description=VVU-SEARM-PAT", label: "Create GitHub PAT" },
  GITHUB_ORG_TOKEN: { provider: "GitHub Org", url: "https://github.com/settings/personal-access-tokens/new", label: "Create Fine-Grained PAT" },
  VERCEL_TOKEN: { provider: "Vercel", url: "https://vercel.com/account/tokens", label: "Create Vercel Token" },
  CLOUDFLARE_TOKEN: { provider: "Cloudflare", url: "https://dash.cloudflare.com/profile/api-tokens", label: "Create CF API Token" },
  CLOUDFLARE_API_TOKEN: { provider: "Cloudflare", url: "https://dash.cloudflare.com/profile/api-tokens", label: "Create CF API Token" },
  CLERK_SECRET_KEY: { provider: "Clerk", url: "https://dashboard.clerk.com/last-active?path=api-keys", label: "Clerk API Keys" },
  HOSTAFRICA_TOKEN: { provider: "HostAfrica", url: "https://cmd.hostafrica.co.za/clientarea.php?action=manageapi", label: "HostAfrica API" },
  HOSTAFRICA_API: { provider: "HostAfrica", url: "https://cmd.hostafrica.co.za/clientarea.php?action=manageAPI", label: "HostAfrica API" },
  STITCH_API: { provider: "Stitch", url: "https://dashboard.stitch.money/developers", label: "Stitch API Keys" },
  SESSION_SECRET: { provider: "Session", url: "", label: "Generate Random Secret" },
};

const REPOS: RepoInfo[] = [
  { name: "vvu-control", branch: "replit-agent", url: "https://github.com/divhanimajokweni-ctrl/vvu-control", fileCount: 600, status: "cloned" },
  { name: "migration-momentum-maker", branch: "main", url: "https://github.com/divhanimajokweni-ctrl/migration-momentum-maker", fileCount: 418, status: "cloned" },
];

export function BuilderSurface() {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [activeRepo, setActiveRepo] = useState("vvu-control");
  const [deployStatus, setDeployStatus] = useState<"idle" | "building" | "deployed" | "failed">("idle");
  const [apiStatus, setApiStatus] = useState<Record<string, "up" | "down" | "checking">>({});

  // Load secrets from /api/builder/secrets on mount
  useEffect(() => {
    fetch("/api/builder/secrets")
      .then(r => r.json())
      .then(data => {
        if (data.secrets) {
          setSecrets(data.secrets.map((s: string) => {
            const [k, v] = s.split("=");
            return { key: k, value: v || "", masked: true };
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Check API health
  useEffect(() => {
    const endpoints = [
      "/api/vvu/twin-scenario",
      "/api/builder/repos",
      "/api/builder/secrets",
    ];
    endpoints.forEach(ep => {
      setApiStatus(prev => ({ ...prev, [ep]: "checking" }));
      fetch(ep).then(r => {
        setApiStatus(prev => ({ ...prev, [ep]: r.ok ? "up" : "down" }));
      }).catch(() => {
        setApiStatus(prev => ({ ...prev, [ep]: "down" }));
      });
    });
  }, []);

  const addSecret = async () => {
    if (!newKey || !newValue) return;
    const res = await fetch("/api/builder/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey, value: newValue }),
    });
    if (res.ok) {
      setSecrets(prev => [...prev, { key: newKey, value: newValue, masked: true }]);
      setNewKey("");
      setNewValue("");
    }
  };

  const removeSecret = async (key: string) => {
    await fetch("/api/builder/secrets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    setSecrets(prev => prev.filter(s => s.key !== key));
  };

  const deploy = async () => {
    setDeployStatus("building");
    try {
      const res = await fetch("/api/builder/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: activeRepo }),
      });
      setDeployStatus(res.ok ? "deployed" : "failed");
    } catch {
      setDeployStatus("failed");
    }
    setTimeout(() => setDeployStatus("idle"), 5000);
  };

  return (
    <div className="tw-scroll-dark h-full overflow-y-auto bg-[#060806] p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#c8ff00]" />
            <h2 className="text-sm font-bold text-[#c8ff00]">BUILDER · ADMIN SURFACE</h2>
          </div>
          <button
            onClick={() => setUnlocked(!unlocked)}
            className={`flex items-center gap-1.5 rounded border px-3 py-1 text-[10px] font-bold transition ${
              unlocked ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {unlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {unlocked ? "UNLOCKED" : "LOCKED"}
          </button>
        </div>

        {/* API Health */}
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(apiStatus).map(([ep, status]) => (
            <div key={ep} className={`rounded border p-2 ${
              status === "up" ? "border-emerald-500/30 bg-emerald-500/5" :
              status === "down" ? "border-red-500/30 bg-red-500/5" :
              "border-slate-700 bg-slate-800/30"
            }`}>
              <div className="flex items-center gap-1.5">
                {status === "up" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> :
                 status === "down" ? <AlertTriangle className="h-3 w-3 text-red-400" /> :
                 <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                <span className="font-mono text-[9px] text-slate-400">{ep.split("/").pop()}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] font-bold">
                <span className={status === "up" ? "text-emerald-400" : status === "down" ? "text-red-400" : "text-slate-400"}>
                  {status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Secrets Management */}
        <div className="rounded-lg border border-slate-800 bg-[#0a0e0a] p-4">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#c8ff00]" />
            <h3 className="text-xs font-bold text-[#c8ff00]">SECRETS & TOKENS</h3>
            <span className="font-mono text-[9px] text-slate-500">({secrets.length} keys · stored in .env, never committed)</span>
          </div>

          {unlocked && (
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                placeholder="KEY_NAME"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="flex-1 border border-slate-700 bg-black p-2 font-mono text-[10px] text-slate-300 outline-none focus:border-[#c8ff00]/50"
              />
              <input
                type="password"
                placeholder="value"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="flex-1 border border-slate-700 bg-black p-2 font-mono text-[10px] text-slate-300 outline-none focus:border-[#c8ff00]/50"
              />
              <button
                onClick={addSecret}
                className="rounded border border-[#c8ff00]/40 bg-[#c8ff00]/10 px-4 py-2 font-mono text-[10px] font-bold text-[#c8ff00] hover:bg-[#c8ff00]/20"
              >
                <Upload className="h-3 w-3" /> ADD
              </button>
            </div>
          )}

          <div className="space-y-1">
            {secrets.map(s => (
              <div key={s.key} className="flex items-center gap-2 rounded border border-slate-800 px-2 py-1.5">
                <span className="font-mono text-[10px] font-bold text-slate-300">{s.key}</span>
                <span className="flex-1 font-mono text-[10px] text-slate-500">
                  {s.masked ? "••••••••••••••••" : s.value.slice(0, 40) + (s.value.length > 40 ? "..." : "")}
                </span>
                {unlocked && (
                  <>
                    {TOKEN_ROTATE_LINKS[s.key] && TOKEN_ROTATE_LINKS[s.key].url && (
                      <a
                        href={TOKEN_ROTATE_LINKS[s.key].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 rounded border border-cyan-500/30 bg-cyan-500/5 px-1.5 py-0.5 font-mono text-[8px] font-bold text-cyan-400 hover:bg-cyan-500/15 transition-colors"
                        title={`Rotate ${TOKEN_ROTATE_LINKS[s.key].provider} token — opens provider's token creation page`}
                      >
                        <RotateCw className="h-2.5 w-2.5" />
                        ROTATE
                      </a>
                    )}
                    <button
                      onClick={() => setSecrets(prev => prev.map(x => x.key === s.key ? { ...x, masked: !x.masked } : x))}
                      className="text-[9px] text-slate-400 hover:text-white"
                    >
                      {s.masked ? "SHOW" : "HIDE"}
                    </button>
                    <button
                      onClick={() => removeSecret(s.key)}
                      className="text-[9px] text-red-400 hover:text-red-300"
                    >
                      DEL
                    </button>
                  </>
                )}
              </div>
            ))}
            {secrets.length === 0 && (
              <div className="text-center font-mono text-[10px] text-slate-600 py-4">
                No secrets loaded. Unlock to add credentials.
              </div>
            )}
          </div>
        </div>

        {/* Platform Links — quick access to all admin consoles */}
        <div className="rounded-lg border border-slate-800 bg-[#0a0e0a] p-4">
          <div className="mb-3 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-[#c8ff00]" />
            <h3 className="text-xs font-bold text-[#c8ff00]">PLATFORM LINKS</h3>
            <span className="font-mono text-[9px] text-slate-500">quick access to token creation + admin consoles</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <a href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=VVU-SEARM-PAT" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <GitBranch className="h-3 w-3" /> GitHub PAT
            </a>
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <GitBranch className="h-3 w-3" /> GitHub Fine-Grained
            </a>
            <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <ExternalLink className="h-3 w-3" /> Vercel Tokens
            </a>
            <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <ExternalLink className="h-3 w-3" /> Cloudflare API
            </a>
            <a href="https://dashboard.clerk.com/last-active?path=api-keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <KeyRound className="h-3 w-3" /> Clerk Keys
            </a>
            <a href="https://cmd.hostafrica.co.za/clientarea.php" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <ExternalLink className="h-3 w-3" /> HostAfrica
            </a>
            <a href="https://dashboard.stitch.money/developers" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <ExternalLink className="h-3 w-3" /> Stitch API
            </a>
            <a href="https://github.com/divhanimajokweni-ctrl" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <GitBranch className="h-3 w-3" /> GitHub Org
            </a>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-2 font-mono text-[10px] text-slate-300 transition hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <ExternalLink className="h-3 w-3" /> Vercel Dashboard
            </a>
          </div>
        </div>

        {/* Repo Management */}
        <div className="rounded-lg border border-slate-800 bg-[#0a0e0a] p-4">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#c8ff00]" />
            <h3 className="text-xs font-bold text-[#c8ff00]">REPOSITORIES</h3>
          </div>

          <div className="space-y-2">
            {REPOS.map(repo => (
              <div
                key={repo.name}
                className={`rounded border p-3 cursor-pointer transition ${
                  activeRepo === repo.name ? "border-[#c8ff00]/40 bg-[#c8ff00]/5" : "border-slate-800 hover:border-slate-600"
                }`}
                onClick={() => setActiveRepo(repo.name)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold ${activeRepo === repo.name ? "text-[#c8ff00]" : "text-slate-300"}`}>
                        {repo.name}
                      </span>
                      <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                        {repo.branch}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                      {repo.fileCount} files · {repo.url.replace("https://github.com/", "")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${repo.status === "cloned" ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="font-mono text-[9px] text-slate-400">{repo.status.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Deploy */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={deploy}
              disabled={deployStatus === "building"}
              className={`flex items-center gap-1.5 rounded border px-4 py-2 font-mono text-[10px] font-bold transition ${
                deployStatus === "deployed" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" :
                deployStatus === "failed" ? "border-red-500/40 bg-red-500/10 text-red-400" :
                deployStatus === "building" ? "border-slate-600 bg-slate-800/50 text-slate-400" :
                "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              {deployStatus === "building" ? <Loader2 className="h-3 w-3 animate-spin" /> :
               deployStatus === "deployed" ? <CheckCircle2 className="h-3 w-3" /> :
               deployStatus === "failed" ? <AlertTriangle className="h-3 w-3" /> :
               <RefreshCw className="h-3 w-3" />}
              {deployStatus === "building" ? "BUILDING..." :
               deployStatus === "deployed" ? "DEPLOYED" :
               deployStatus === "failed" ? "FAILED" :
               `DEPLOY ${activeRepo}`}
            </button>
            <span className="font-mono text-[9px] text-slate-500">
              → Vercel + Cloudflare edge
            </span>
          </div>
        </div>

        {/* Mini-services / Telemetry */}
        <div className="rounded-lg border border-slate-800 bg-[#0a0e0a] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-[#c8ff00]" />
            <h3 className="text-xs font-bold text-[#c8ff00]">FLEET · MINI-SERVICE HEALTH (from vvu-control registry.ts)</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "ESTATE SURFACE", port: 3000, status: "up", healthPath: "/", expected: 200, note: "the dashboard itself — not restartable" },
              { name: "TELEMETRY SERVICE", port: 3003, status: "down", healthPath: "/healthz", expected: 404, note: "socket.io · Gqeberha node · api-only" },
              { name: "VAULT-BRIDGE", port: 3004, status: "down", healthPath: "/status", expected: 200, note: "receipt pairing + vault relay" },
              { name: "FIELD-ONBOARD", port: 3005, status: "down", healthPath: "/status", expected: 200, note: "field onboarding + device pairing" },
              { name: "WILDFIRE-MESH", port: 3006, status: "down", healthPath: "/", expected: 200, note: "simulated field mesh + SHA256 chain" },
              { name: "MESH-DEMO", port: 3007, status: "down", healthPath: "/", expected: 200, note: "mesh demo dashboard" },
              { name: "SAFEGRID API", port: 3008, status: "down", healthPath: "/", expected: 404, note: "safety policy grid API · api-only" },
            ].map(svc => (
              <div key={svc.name} className="rounded border border-slate-800 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-300">{svc.name}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${svc.status === "up" ? "bg-emerald-400" : "bg-slate-600"}`} />
                </div>
                <div className="mt-0.5 font-mono text-[9px] text-slate-500">:{svc.port}{svc.healthPath} · {svc.status.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Code Samples Environment */}
        <div className="rounded-lg border border-slate-800 bg-[#0a0e0a] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#c8ff00]" />
            <h3 className="text-xs font-bold text-[#c8ff00]">SAMPLES · SANDBOX</h3>
          </div>
          <p className="font-mono text-[10px] text-slate-500 mb-2">
            Build + test code changes before pushing to production. Upload files, run tests, preview changes.
          </p>
          <div className="flex gap-2">
            <button className="rounded border border-slate-700 px-3 py-1.5 font-mono text-[10px] text-slate-300 hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <Upload className="mr-1 inline h-3 w-3" /> UPLOAD CODE
            </button>
            <button className="rounded border border-slate-700 px-3 py-1.5 font-mono text-[10px] text-slate-300 hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <GitBranch className="mr-1 inline h-3 w-3" /> CREATE BRANCH
            </button>
            <button className="rounded border border-slate-700 px-3 py-1.5 font-mono text-[10px] text-slate-300 hover:border-[#c8ff00]/40 hover:text-[#c8ff00]">
              <RefreshCw className="mr-1 inline h-3 w-3" /> RUN TESTS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
