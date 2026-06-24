import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, children, className }: EmptyStateProps) {
  return (
    <Card className={cn("border-border/60 border-dashed", className)}>
      <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
        <div className="space-y-1">
          <p>{title}</p>
          {description ? <p>{description}</p> : null}
        </div>
        {children ? <div className="flex justify-center">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  title?: ReactNode;
  message: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  className,
}: ErrorStateProps) {
  return (
    <Card className={cn("border-destructive/30 bg-destructive/5", className)}>
      <CardContent className="space-y-1 py-4 text-sm">
        <p className="font-medium text-destructive">{title}</p>
        <p className="text-destructive/90">{message}</p>
      </CardContent>
    </Card>
  );
}

interface SkeletonStateProps {
  children: ReactNode;
  className?: string;
}

export function SkeletonState({ children, className }: SkeletonStateProps) {
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      {children}
    </div>
  );
}
