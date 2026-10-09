"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_KEY = "airbnb-clone.theme";

/**
 * Runs in <head> before first paint (see app/layout.tsx), so a saved dark theme never flashes white.
 * First-time visitors always get the light theme, whatever their OS prefers; only an explicit,
 * previously saved choice ("dark") changes that.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")==="dark"?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;

const listeners = new Set<() => void>();

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: the choice just lasts for this page view */
  }
  listeners.forEach((notify) => notify());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    read,
    () => "light",
  );
}
