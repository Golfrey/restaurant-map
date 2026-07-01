import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export type Theme = "light" | "dark";

function readThemeCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const themeValue = document.cookie
    .split("; ")
    .find((part) => part.startsWith("resy-map-theme="))
    ?.split("=")[1];
  return themeValue === "light" || themeValue === "dark" ? themeValue : null;
}

function writeThemeCookie(theme: Theme) {
  document.cookie = `resy-map-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const stored = readThemeCookie();
  if (stored) return stored;

  return "dark";
}

export function useTheme(): [Theme, Dispatch<SetStateAction<Theme>>] {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;

    writeThemeCookie(theme);
  }, [theme]);

  return [theme, setTheme];
}
