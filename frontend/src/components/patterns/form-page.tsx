import { Trash2 } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { FormPageSlotsProvider } from "@/lib/form-page-context";
import { cn } from "@/lib/utils";

type FormPageWidth = "2xl" | "3xl" | "4xl" | "5xl";

const widthClass: Record<FormPageWidth, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

interface FormPageProps {
  title: ReactNode;
  width?: FormPageWidth;
  /** Destructive card after the form; see `DangerZone`. */
  danger?: ReactNode;
  children: ReactNode;
}

/**
 * Full-page create and edit layout. The sticky header holds the breadcrumb
 * trail and title. The form inside renders `<FormActions>` as usual; on a form
 * page its Cancel and Save move into that header from 768 px, and into a sticky
 * footer above the tab bar below that.
 */
export function FormPage({ title, width = "3xl", danger, children }: FormPageProps) {
  const formId = useId();
  const [header, setHeader] = useState<HTMLDivElement | null>(null);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const slots = useMemo(() => ({ formId, header, footer }), [formId, header, footer]);
  const inner = cn("mx-auto w-full", widthClass[width]);

  return (
    <FormPageSlotsProvider value={slots}>
      <div className="sticky top-0 z-30 border-border border-b bg-background/90 px-4 py-3 backdrop-blur-lg md:px-10">
        <div className={cn(inner, "flex min-h-11 items-center justify-between gap-3")}>
          <div className="flex min-w-0 flex-col gap-1">
            <Breadcrumbs minDepth={2} />
            <h1 className="truncate text-xl font-semibold tracking-tight md:text-[22px]">
              {title}
            </h1>
          </div>
          <div
            ref={setHeader}
            data-slot="form-page-actions"
            className="hidden shrink-0 items-center gap-2 empty:hidden md:flex"
          />
        </div>
      </div>
      <div className="px-4 pt-6 pb-10 md:px-10 md:pb-16">
        <div className={cn(inner, "space-y-5")}>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6">{children}</div>
          {danger}
        </div>
      </div>
      <div
        ref={setFooter}
        data-slot="form-page-footer"
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 flex gap-2 border-border border-t bg-background/95 px-4 py-3 backdrop-blur-lg empty:hidden md:hidden"
      />
    </FormPageSlotsProvider>
  );
}

interface DangerZoneProps {
  title: ReactNode;
  description: ReactNode;
  actionLabel: ReactNode;
  onAction: () => void;
  disabled?: boolean;
}

/** The delete card at the end of an edit page; the action opens a confirmation. */
export function DangerZone({
  title,
  description,
  actionLabel,
  onAction,
  disabled = false,
}: DangerZoneProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-card px-5 py-4"
    >
      <div className="min-w-0 space-y-0.5">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onAction}
        disabled={disabled}
        className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/40 dark:bg-transparent dark:hover:bg-destructive/10"
      >
        <Trash2 />
        {actionLabel}
      </Button>
    </section>
  );
}
