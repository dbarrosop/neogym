import { type ReactNode, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { FormPageSlotsProvider, useFormPageSlots } from "@/lib/form-page-context";
import { cn } from "@/lib/utils";

/**
 * Content width. The board widths: `form` 760 px (food, measurement, energy),
 * `wide` 1000 px (workout, journal, plan), `split` 1180 px (meal editor with its
 * totals aside). The Tailwind sizes remain for existing pages.
 */
export type FormPageWidth = "2xl" | "3xl" | "4xl" | "5xl" | "form" | "wide" | "split";

const widthClass: Record<FormPageWidth, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  form: "max-w-[760px]",
  wide: "max-w-[1000px]",
  split: "max-w-[1180px]",
};

/**
 * `card` wraps the whole form in one card (the original layout); `sections`
 * renders children directly so the form can lay out its own section cards
 * (`<FormSection card>` or `Card`), as the editor boards do.
 */
export type FormPageLayout = "card" | "sections";

interface FormPageProps {
  title: ReactNode;
  width?: FormPageWidth;
  layout?: FormPageLayout;
  /** Static content for the side column; forms can also portal into it with `FormPageAside`. */
  aside?: ReactNode;
  /** Destructive card after the form; see `DangerZone`. */
  danger?: ReactNode;
  children: ReactNode;
}

// From 1024 px a non-empty aside slot becomes a sticky column beside the form;
// below that it stacks after the form, before the delete card.
const ASIDE_COLUMNS =
  "lg:has-[>[data-slot=form-page-aside]:not(:empty)]:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]";

/**
 * Full-page create and edit layout. The sticky header holds the breadcrumb
 * trail and title. The form inside renders `<FormActions>` as usual; on a form
 * page its Cancel and Save move into that header from 768 px, and into a sticky
 * footer above the tab bar below that. The mobile layout fills the shell's
 * available height so short forms keep their footer directly above the tab bar,
 * and leaves room under the content for the raised rest timer pill.
 */
export function FormPage({
  title,
  width = "3xl",
  layout = "card",
  aside,
  danger,
  children,
}: FormPageProps) {
  const formId = useId();
  const [header, setHeader] = useState<HTMLDivElement | null>(null);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const [asideSlot, setAsideSlot] = useState<HTMLDivElement | null>(null);
  const slots = useMemo(
    () => ({ formId, header, footer, aside: asideSlot }),
    [formId, header, footer, asideSlot],
  );
  const inner = cn("mx-auto w-full", widthClass[width]);

  return (
    <FormPageSlotsProvider value={slots}>
      {/* The shell main pads form pages by the tab bar only; fill the rest of the viewport. */}
      <div className="flex min-h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))] flex-col md:block md:min-h-0">
        <div className="sticky top-0 z-30 border-border border-b bg-background/90 px-4 py-3 backdrop-blur-lg md:px-10 md:py-4">
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
        <div className="flex-1 px-4 pt-6 pb-16 md:px-10">
          <div className={cn(inner, "grid items-start gap-5", ASIDE_COLUMNS)}>
            <div className="flex min-w-0 flex-col gap-5 lg:col-start-1">
              {layout === "card" ? (
                <div className="rounded-xl border border-border bg-card p-4 md:p-5">{children}</div>
              ) : (
                children
              )}
            </div>
            <div
              ref={setAsideSlot}
              data-slot="form-page-aside"
              className="flex min-w-0 flex-col gap-4 empty:hidden lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1"
            >
              {aside}
            </div>
            {danger ? <div className="min-w-0 lg:col-start-1">{danger}</div> : null}
          </div>
        </div>
        <div
          ref={setFooter}
          data-slot="form-page-footer"
          className="sticky bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 flex gap-2 border-border border-t bg-background/95 px-4 py-3 backdrop-blur-lg empty:hidden md:hidden"
        />
      </div>
    </FormPageSlotsProvider>
  );
}

/**
 * Renders form-owned content (e.g. live meal totals) in the form page's side
 * column. Outside a form page, such as in a dialog, it renders in place.
 */
export function FormPageAside({ children }: { children: ReactNode }) {
  const page = useFormPageSlots();
  if (!page) {
    return <>{children}</>;
  }
  return page.aside ? createPortal(children, page.aside) : null;
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
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      <Button
        type="button"
        variant="destructive-outline"
        onClick={onAction}
        disabled={disabled}
        className="max-md:h-11"
      >
        {actionLabel}
      </Button>
    </section>
  );
}
