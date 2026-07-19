// path: src/hooks/use-workbench-theme.ts
import { useEffect, useState } from "react";

export type WorkbenchTheme = "dark" | "light";

const STORAGE_KEY = "wb-theme";

function getInitialTheme(): WorkbenchTheme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

export function useWorkbenchTheme() {
  const [theme, setTheme] = useState<WorkbenchTheme>(getInitialTheme);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
    // Radix dialogs (Settings, delete confirm, etc.) portal to document.body,
    // outside any themed wrapper div — set the attribute on <html> too so
    // CSS variables still cascade into them.
    document.documentElement.setAttribute("data-wb-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
