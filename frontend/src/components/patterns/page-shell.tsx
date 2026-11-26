import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageMaxWidth = "2xl" | "3xl" | "4xl" | "5xl" | "6xl";

const maxWidthClass: Record<PageMaxWidth, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-[1180px]",
};

/** Page padding shared by every signed-in page inside the app shell. */
export const PAGE_PADDING_CLASS = "px-4 pt-6 pb-10 md:px-10 md:pt-7 md:pb-16";

interface PageShellProps {
  children: ReactNode;
  maxWidth?: PageMaxWidth;
  className?: string;
  contentClassName?: string;
}

export function PageShell({
  children,
  maxWidth = "3xl",
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <section className={cn(PAGE_PADDING_CLASS, className)}>
      <div className={cn("mx-auto space-y-6", maxWidthClass[maxWidth], contentClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Label of a header's primary create/log button. Below 768 px it is read by
 * screen readers only and the button shrinks to a 44 px icon button (see the
 * `ActionLabel` rule in `ui/button.tsx`), so pair it with a leading icon:
 * `<Button asChild><Link to="/nutrition/foods/new"><Plus /><ActionLabel>New food</ActionLabel></Link></Button>`.
 */
export function ActionLabel({ children }: { children: ReactNode }) {
  return (
    <span data-slot="action-label" className="max-md:sr-only">
      {children}
    </span>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Header-right buttons; wrap a primary action's text in `ActionLabel` for the mobile icon button. */
  actions?: ReactNode;
  /** Section switcher rendered beside the title (e.g. `<AreaTabs area="train" />`). */
  tabs?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  tabs,
  className,
}: PageHeaderProps) {
  // Below 768 px the title group dissolves so the actions stay beside the
  // title and the section tabs take their own full-width row underneath.
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3 max-md:contents">
        <div className="min-w-0 space-y-1 max-md:flex-1">
          {eyebrow ? (
            <p className="text-[13px] font-semibold text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-[-0.02em] md:text-[28px]">{title}</h1>
        </div>
        {tabs ? <div className="min-w-0 max-md:order-last max-md:basis-full">{tabs}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      {description ? (
        <p className="basis-full text-sm text-muted-foreground max-md:order-last">{description}</p>
      ) : null}
    </header>
  );
}
