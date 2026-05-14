import { useEffect } from "react";
import { useStore, updateSettings } from "@/lib/store";
import type { FontMode } from "@/lib/types";

export type Theme = "dark" | "light";

export function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function applyFontClass(font: FontMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("font-board", font === "board");
  root.classList.toggle("font-mono-app", font === "mono");
}

export function useThemeSync() {
  const theme = useStore((s) => s.settings.theme || "dark");
  const font = useStore((s) => s.settings.font || "mono");
  useEffect(() => { applyThemeClass(theme); }, [theme]);
  useEffect(() => { applyFontClass(font); }, [font]);
}

export function toggleTheme() {
  const isLight = typeof document !== "undefined" && document.documentElement.classList.contains("light");
  const next: Theme = isLight ? "dark" : "light";
  applyThemeClass(next);
  updateSettings({ theme: next });
}

export function toggleFont() {
  const isBoard = typeof document !== "undefined" && document.documentElement.classList.contains("font-board");
  const next: FontMode = isBoard ? "mono" : "board";
  applyFontClass(next);
  updateSettings({ font: next });
}
