import { Segmented } from "@/components/patterns/segmented";
import { type Theme, useTheme } from "@/lib/theme/theme-provider";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

/** Appearance picker: dark (default), light, or follow the system setting. */
export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  return <Segmented label="Appearance" options={OPTIONS} value={theme} onChange={setTheme} />;
}
