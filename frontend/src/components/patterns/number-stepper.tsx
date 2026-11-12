import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Text input with − / + buttons, for numbers people adjust in the gym.
 * Values stay strings so partially typed input ("72.") isn't rewritten.
 */
export function NumberStepper({
  value,
  onChange,
  step,
  label,
  min = 0,
  decimals = 2,
  inputMode = "decimal",
  suffix,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  step: number;
  /** Accessible name of the input; the buttons say "Decrease …" / "Increase …". */
  label: string;
  min?: number;
  decimals?: number;
  inputMode?: "decimal" | "numeric";
  suffix?: string;
  className?: string;
}) {
  const factor = 10 ** decimals;

  function bump(direction: 1 | -1) {
    const current = Number(value.replace(",", "."));
    const base = value.trim() !== "" && Number.isFinite(current) ? current : 0;
    const next = Math.max(min, Math.round((base + direction * step) * factor) / factor);
    onChange(String(next));
  }

  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-lg border bg-card focus-within:ring-[3px] focus-within:ring-ring/50",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => bump(-1)}
        aria-label={`Decrease ${label}`}
        className="grid h-full w-9 shrink-0 place-items-center rounded-l-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        <Minus className="size-4" />
      </button>
      <input
        type="text"
        inputMode={inputMode}
        pattern={inputMode === "numeric" ? "[0-9]*" : "[0-9]*[.,]?[0-9]*"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={label}
        placeholder="0"
        className="h-full w-14 min-w-0 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none"
      />
      {suffix ? (
        <span aria-hidden="true" className="pr-1 text-[13px] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => bump(1)}
        aria-label={`Increase ${label}`}
        className="grid h-full w-9 shrink-0 place-items-center rounded-r-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
