import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Theme, useTheme } from "@/lib/theme/theme-provider";

const ORDER: Theme[] = ["dark", "light", "system"];

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const NEXT_LABEL: Record<Theme, string> = {
  dark: "light",
  light: "system",
  system: "dark",
};

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function cycle() {
    const idx = ORDER.indexOf(theme);
    setTheme(ORDER[(idx + 1) % ORDER.length] ?? "dark");
  }

  const Icon = ICONS[theme];

  return (
    <Button
      type="button"
      onClick={cycle}
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${NEXT_LABEL[theme]}.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
