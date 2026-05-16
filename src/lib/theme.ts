import { useEffect } from "react";

export function useThemeSync() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "font-board", "font-mono-app");
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  }, []);
}
