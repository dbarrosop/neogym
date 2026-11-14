import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  /** Labels, muscles, "public": the default. */
  neutral: "bg-muted text-soft-foreground",
  /** Sources and highlights such as "Apple Health". */
  accent: "bg-accent-soft text-accent-soft-foreground",
  /** Records such as "PR". */
  warning: "bg-warning-soft text-warning-soft-foreground",
  positive: "bg-positive-soft text-positive",
} as const;

export type TagTone = keyof typeof TONE_CLASS;

interface TagProps extends Omit<ComponentProps<"span">, "children"> {
  children: ReactNode;
  tone?: TagTone;
  /** Adds a 22 px remove button (the editor's label chip); give it `removeLabel`. */
  onRemove?: () => void;
  /** Accessible name of the remove button, e.g. "Remove label caliper". */
  removeLabel?: string;
}

/**
 * Small pill for labels and metadata (board `.tag`): 22 px tall, 12 px
 * semibold. With `onRemove` it becomes the 28 px editor chip (board `.chipl`).
 */
export function Tag({
  children,
  tone = "neutral",
  onRemove,
  removeLabel,
  className,
  ...props
}: TagProps) {
  if (onRemove) {
    return (
      <span
        className={cn(
          "inline-flex h-7 max-w-full items-center gap-1 rounded-full pr-1 pl-2.5 text-[13px] font-semibold",
          TONE_CLASS[tone],
          className,
        )}
        {...props}
      >
        <span className="truncate">{children}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? "Remove"}
          className="grid size-[22px] shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold [&_svg]:size-3 [&_svg]:shrink-0",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export type ItemKind = "food" | "meal" | "cardio";

const KIND_LABEL: Record<ItemKind, string> = { food: "Food", meal: "Meal", cardio: "Cardio" };

/**
 * FOOD / MEAL marker in plan, log and picker rows (board `.kind`): meals use
 * the accent-soft pill, foods the neutral fill. Uppercase is visual only.
 */
export function KindTag({
  kind,
  children,
  className,
}: {
  kind: ItemKind;
  /** Overrides the default label ("Food", "Meal", "Cardio"). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full px-[7px] py-[3px] text-center text-[11px] leading-tight font-bold uppercase",
        kind === "food" ? TONE_CLASS.neutral : TONE_CLASS.accent,
        className,
      )}
    >
      {children ?? KIND_LABEL[kind]}
    </span>
  );
}
