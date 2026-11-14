import { type LucideIcon, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  /** List filters (workouts, journal labels, muscles): 32 px, 13 px. */
  default: "h-8 gap-1.5 px-3 text-[13px]",
  /** Compact toggles inside a table header (foods Mine/Public): 26 px, 12 px. */
  sm: "h-[26px] gap-1 px-2.5 text-xs [&_svg]:size-3.5",
} as const;

interface FilterChipProps extends Omit<ComponentProps<"button">, "children" | "type"> {
  selected: boolean;
  children: ReactNode;
  /** Leading icon. */
  icon?: LucideIcon;
  /** Trailing count, e.g. matching rows. */
  count?: number;
  size?: keyof typeof SIZE_CLASS;
}

/**
 * Toggle chip for list filters. Selected chips use the accent fill; the rest
 * sit on the surface with a separator border. Exposes `aria-pressed`.
 */
export function FilterChip({
  selected,
  children,
  icon: Icon,
  count,
  size = "default",
  className,
  ...props
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        SIZE_CLASS[size],
        selected
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : "border-border bg-card text-soft-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
      {count === undefined ? null : (
        <span
          className={cn(
            "font-medium tabular-nums",
            selected ? "text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

/**
 * An applied filter shown above results (Exercises board): accent fill with a
 * 22 px clear button, e.g. `removeLabel="Clear Quadriceps filter"`.
 */
export function ActiveFilterChip({
  children,
  onRemove,
  removeLabel,
  className,
}: {
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[30px] max-w-full items-center gap-1 rounded-full bg-primary pr-1.5 pl-3 text-[13px] font-semibold text-primary-foreground",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid size-[22px] shrink-0 place-items-center rounded-full transition-colors hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  );
}
