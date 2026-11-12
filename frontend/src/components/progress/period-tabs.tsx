import { cn } from "@/lib/utils";

export interface PeriodOption<T extends string | number> {
  value: T;
  label: string;
}

/** Small segmented control for chart ranges (30 d / 60 d / …). */
export function PeriodTabs<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly PeriodOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <fieldset className="m-0 flex rounded-full border-0 bg-muted p-[3px]">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
            option.value === value && "bg-segment-thumb font-semibold text-foreground shadow-sm",
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

/** The browser's IANA time zone, used by server-side day bucketing. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
