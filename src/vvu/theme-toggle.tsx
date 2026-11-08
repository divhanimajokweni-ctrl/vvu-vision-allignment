"use client";
// VVU theme toggle — switches between dark terminal mode (default) and a
// light "research mode" palette. Persists to localStorage. Sets data-theme on <html>.
import React from "react";
import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

const KEY = "vvu-theme";

function loadTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" ? "light" : "dark";
  } catch { return "dark"; }
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  // also set the meta theme-color so mobile browsers match
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#f4f6f9" : "#0a0e13");
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "dark",
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    if (typeof window !== "undefined") try { localStorage.setItem(KEY, next); } catch {}
    set({ theme: next });
  },
  set: (t) => { applyTheme(t); if (typeof window !== "undefined") try { localStorage.setItem(KEY, t); } catch {}; set({ theme: t }); },
}));

// hydrate on first client render
if (typeof window !== "undefined") {
  const t = loadTheme();
  applyTheme(t);
  useTheme.setState({ theme: t });
}

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  return (
    <button
      className="vvu-iconbtn vvu-theme-toggle"
      onClick={toggle}
      title={theme === "dark" ? "switch to light research mode" : "switch to dark terminal mode"}
      aria-label="toggle theme"
      aria-pressed={theme === "light"}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
