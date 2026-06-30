import { Moon, Sun } from "lucide-react";
import type { Theme } from "../../hooks/useTheme";
import { Button } from "../ui/button";

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon className="size-4" />
    </Button>
  );
}
