import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function FormSection({ children, title, description, className }: FormSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {title || description ? (
        <div className="space-y-1">
          {title ? <h2 className="text-sm font-medium">{title}</h2> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface FormActionsProps {
  submitLabel: ReactNode;
  onCancel: () => void;
  isSubmitting: boolean;
  cancelLabel?: ReactNode;
  submittingLabel?: ReactNode;
  submitDisabled?: boolean;
  extraActions?: ReactNode;
  className?: string;
}

export function FormActions({
  submitLabel,
  onCancel,
  isSubmitting,
  cancelLabel = "Cancel",
  submittingLabel = "Saving…",
  submitDisabled = false,
  extraActions,
  className,
}: FormActionsProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        <Button type="submit" disabled={isSubmitting || submitDisabled}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
      {extraActions ? <div className="border-t border-border/40 pt-3">{extraActions}</div> : null}
    </div>
  );
}
