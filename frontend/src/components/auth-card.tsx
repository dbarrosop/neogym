import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BRAND_HEADLINE, BRAND_HIGHLIGHTS, BRAND_PLATFORMS } from "@/components/shell/brand-copy";
import { BrandMark } from "@/components/shell/brand-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

type AuthContentProps = Omit<AuthCardProps, "layout">;

function SplitAuthLayout({ title, description, footer, children }: AuthContentProps) {
  return (
    <div className="flex min-h-dvh">
      <section
        aria-label="About NeoGym"
        className="hidden w-[44%] max-w-[640px] shrink-0 flex-col justify-between gap-10 border-sidebar-border border-r bg-sidebar p-14 text-sidebar-foreground md:flex"
      >
        <Link to="/" className="flex w-fit items-center gap-2.5 text-[17px] font-semibold">
          <BrandMark className="size-8" />
          NeoGym
        </Link>
        <div className="max-w-[460px] space-y-6">
          <p className="text-balance text-4xl font-bold leading-tight tracking-tight">
            {BRAND_HEADLINE}
          </p>
          <ul className="space-y-3.5 text-base leading-relaxed text-muted-foreground">
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
      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] space-y-6">
          <Link to="/" className="flex w-fit items-center gap-2 font-semibold md:hidden">
            <BrandMark />
            NeoGym
          </Link>
          <div className="space-y-2">
            <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="space-y-4">{children}</div>
          {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}

function CenteredAuthCard({ title, description, footer, children }: AuthContentProps) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? (
          <div className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
