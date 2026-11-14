import { Link } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import { BRAND_HEADLINE, BRAND_HIGHLIGHTS, BRAND_PLATFORMS } from "@/components/shell/brand-copy";
import { BrandMark } from "@/components/shell/brand-mark";

/** 46 px email/name fields on the sign-in and sign-up forms. */
export const AUTH_INPUT_CLASS =
  "h-[46px] rounded-[10px] bg-card px-3.5 text-[15px] md:text-[15px] dark:bg-card";

/** 46 px full-width primary action (Send code, Verify). */
export const AUTH_SUBMIT_CLASS = "h-[46px] w-full rounded-[10px] font-semibold text-[15px]";

interface AuthCardProps {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
  /**
   * `split` (sign in, sign up): the brand panel beside the form, full screen.
   * `card`: a centered card inside the surrounding chrome (verify, authorize).
   */
  layout?: "split" | "card";
}

export function AuthCard({ layout = "split", ...props }: AuthCardProps) {
  return layout === "card" ? <CenteredAuthCard {...props} /> : <SplitAuthLayout {...props} />;
}

/** "New to NeoGym? Create an account": an accent link under the sign-in and sign-up forms. */
export function AuthFooterLink({
  to,
  children,
}: {
  to: "/signin" | "/signup";
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-sm font-semibold text-link underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}

type AuthContentProps = Omit<AuthCardProps, "layout">;

function BrandPanel() {
  return (
    <section
      aria-label="About NeoGym"
      className="hidden min-w-0 flex-[1_1_420px] flex-col justify-between gap-10 border-sidebar-border border-r bg-sidebar p-14 text-sidebar-foreground md:flex"
    >
      <Link to="/" className="flex w-fit items-center gap-2.5 font-semibold text-[17px]">
        <BrandMark className="size-8 rounded-[9px]" />
        NeoGym
      </Link>
      <div className="flex max-w-[460px] flex-col gap-6">
        <p className="text-balance font-bold text-[40px] leading-[1.1] tracking-[-0.025em]">
          {BRAND_HEADLINE}
        </p>
        <ul className="flex flex-col gap-3.5 text-base text-soft-foreground leading-normal">
          {BRAND_HIGHLIGHTS.map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden="true" className="text-link">
                —
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[13px] text-tertiary-foreground">{BRAND_PLATFORMS}</p>
    </section>
  );
}

function SplitAuthLayout({ title, description, footer, children }: AuthContentProps) {
  return (
    <div className="flex min-h-dvh">
      <BrandPanel />
      <section className="flex min-w-0 flex-[1_1_480px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <Link to="/" className="flex w-fit items-center gap-2 font-semibold md:hidden">
            <BrandMark />
            NeoGym
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="font-bold text-[28px] tracking-[-0.02em]">{title}</h1>
            <p className="text-[15px] text-muted-foreground leading-normal">{description}</p>
          </div>
          <div>{children}</div>
          {footer ? <div className="text-muted-foreground text-sm">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}

/**
 * A 448 px card centred in whatever space the surrounding chrome leaves; it
 * makes no assumption about a top bar's height.
 */
function CenteredAuthCard({ title, description, footer, children }: AuthContentProps) {
  const titleId = useId();
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-12">
      <section
        aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col rounded-[14px] border border-border bg-card text-card-foreground shadow-2xl shadow-black/10 dark:shadow-black/45"
      >
        <div className="flex flex-col gap-1.5 px-6 pt-6">
          <h1 id={titleId} className="font-bold text-2xl tracking-[-0.015em]">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm leading-normal">{description}</p>
        </div>
        <div className="flex flex-col gap-5 px-6 pt-5 pb-6 text-sm">{children}</div>
        {footer ? (
          <div className="border-border border-t px-6 py-3.5 text-center text-[13px] text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  );
}
