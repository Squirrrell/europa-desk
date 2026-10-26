import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const set = document.documentElement.dataset.theme;
    return set === "light" || set === "dark" ? set : systemTheme();
  });

  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!chosen) return;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }, [theme, chosen]);

  const toggle = useCallback(() => {
    setChosen(true);
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
