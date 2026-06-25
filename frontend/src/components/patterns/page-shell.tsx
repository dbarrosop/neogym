import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageMaxWidth = "2xl" | "3xl" | "4xl";

const maxWidthClass: Record<PageMaxWidth, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

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
    <section
      className={cn("grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12", className)}
    >
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
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-3", className)}>
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
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
    <Card
      className={cn(
        "border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80",
        className,
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {eyebrow ? (
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {eyebrow}
              </p>
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
