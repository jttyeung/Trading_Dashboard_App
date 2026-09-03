"use client";

// Light/dark/auto toggle for the wide-surface pages only (desktop table,
// bot review tables, /overview — see app/layout.tsx's own isWideSurface
// split). The phone-frame mobile app keeps its existing dark-only theme
// untouched; this never runs there. Persisted in localStorage, same
// client-only pattern as margin-mode.tsx's own toggle — no backend
// setting, this is a personal display preference.
//
// "auto" tracks the OS's prefers-color-scheme live (a matchMedia change
// listener, not just a one-time read at mount) — the account holder's
// own explicit ask that changing the OS setting while the tab is open
// should actually update the page, not just at next reload.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "auto";
type Resolved = "light" | "dark";

type Ctx = { mode: ThemeMode; resolved: Resolved; setMode: (m: ThemeMode) => void };

const ThemeModeContext = createContext<Ctx>({ mode: "auto", resolved: "light", setMode: () => {} });
const KEY = "wideSurfaceThemeMode";

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  // Defaults match today's behavior with no flash for anyone who hasn't
  // chosen yet and whose OS preference can't be read until mount: light,
  // the same as the old hardcoded theme-light. "auto" is the default MODE
  // once mounted (see the effect below) — the account holder's own ask
  // for system-following to be the out-of-the-box behavior, with light/
  // dark as explicit overrides on top of it.
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [resolved, setResolved] = useState<Resolved>("light");

  useEffect(() => {
    let initial: ThemeMode = "auto";
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark" || saved === "auto") initial = saved;
    } catch {
      /* ignore */
    }
    setModeState(initial);
  }, []);

  useEffect(() => {
    function apply() {
      setResolved(mode === "auto" ? (systemPrefersDark() ? "dark" : "light") : mode);
    }
    apply();
    if (mode !== "auto") return;
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [mode]);

  useEffect(() => {
    document.body.classList.toggle("theme-light", resolved === "light");
    document.body.classList.toggle("theme-dark", resolved === "dark");
  }, [resolved]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
  };

  return <ThemeModeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
