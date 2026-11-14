import { type ReactNode, useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useFormPageSlots } from "@/lib/form-page-context";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /**
   * Render as its own section card (15 px heading, 13 px caption, 20 px padding)
   * for `<FormPage layout="sections">`; the titled card is labelled by its heading.
   */
  card?: boolean;
  className?: string;
}

export function FormSection({
  children,
  title,
  description,
  card = false,
  className,
}: FormSectionProps) {
  const titleId = useId();
  if (card) {
    return (
      <section
        aria-labelledby={title ? titleId : undefined}
        className={cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5", className)}
      >
        {title || description ? (
          <div className="flex flex-col gap-1">
            {title ? (
              <h2 id={titleId} className="text-[15px] font-semibold">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-[13px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </section>
    );
  }
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
  const page = useFormPageSlots();
  if (page) {
    const buttons = (stretch: boolean) => (
      <PageFormButtons
        formId={page.formId}
        cancelLabel={cancelLabel}
        submitText={isSubmitting ? submittingLabel : submitLabel}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitDisabled={isSubmitting || submitDisabled}
        stretch={stretch}
      />
    );
    return (
      <>
        {page.header ? createPortal(buttons(false), page.header) : null}
        {page.footer ? createPortal(buttons(true), page.footer) : null}
        {extraActions ? (
          <div className={cn("border-t border-border pt-3", className)}>{extraActions}</div>
        ) : null}
      </>
    );
  }
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
      {extraActions ? <div className="border-t border-border pt-3">{extraActions}</div> : null}
    </div>
  );
}

interface PageFormButtonsProps {
  formId: string;
  cancelLabel: ReactNode;
  submitText: ReactNode;
  onCancel: () => void;
  isSubmitting: boolean;
  submitDisabled: boolean;
  stretch: boolean;
}

/** Cancel and Save for a form page's header (inline) or mobile footer (stretched). */
function PageFormButtons({
  formId,
  cancelLabel,
  submitText,
  onCancel,
  isSubmitting,
  submitDisabled,
  stretch,
}: PageFormButtonsProps) {
  const size = stretch ? "h-[46px] flex-1" : undefined;
  return (
    <>
      <Button
        type="button"
        variant={stretch ? "outline" : "ghost"}
        onClick={onCancel}
        disabled={isSubmitting}
        className={size}
      >
        {cancelLabel}
      </Button>
      <Button type="submit" form={formId} disabled={submitDisabled} className={size}>
        {submitText}
      </Button>
    </>
  );
}
