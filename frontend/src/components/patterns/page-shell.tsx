import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
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
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-[13px] font-semibold text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        </div>
        {tabs}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      {description ? (
        <p className="basis-full text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

interface FormCardShellProps {
  title: ReactNode;
  children: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function FormCardShell({
  title,
  children,
  eyebrow,
  description,
  actions,
  className,
  contentClassName,
}: FormCardShellProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {eyebrow ? (
              <p className="text-[13px] font-semibold text-muted-foreground">{eyebrow}</p>
            ) : null}
            <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
