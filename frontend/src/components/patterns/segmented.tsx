import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Small segmented control, e.g. chart periods or appearance. It is a native
 * radio group: one tab stop, arrow keys move the selection, and screen readers
 * announce the group name and "n of m".
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group (not shown). */
  label: string;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset
      className={cn(
        "m-0 flex w-fit min-w-0 gap-0.5 rounded-[9px] border-0 bg-muted p-[3px]",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={String(option.value)}
            className={cn(
              "relative flex h-[30px] flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] px-3 text-[13px] font-medium text-soft-foreground transition-colors hover:text-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              checked && "bg-segment-thumb font-semibold text-foreground shadow-sm",
            )}
          >
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}
