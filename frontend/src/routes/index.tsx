import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { BRAND_HEADLINE, BRAND_HIGHLIGHTS, BRAND_PLATFORMS } from "@/components/shell/brand-copy";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/nhost/auth-provider";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

const CTA_CLASS = "h-[46px] px-5 font-semibold text-[15px] has-[>svg]:px-5";

function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Signed-in visitors land on Today; the marketing page is for signed-out users.
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/today", replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Render nothing until the session is known, and while a signed-in visitor
  // is redirected, so they never see the pitch flash first.
  if (isLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="flex w-full flex-1 items-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
        <h1 className="text-balance font-bold text-[40px] leading-[1.05] tracking-[-0.03em] sm:text-[52px]">
          {BRAND_HEADLINE}
        </h1>
        <ul className="flex flex-col gap-3.5 text-lg text-soft-foreground leading-normal">
          {BRAND_HIGHLIGHTS.map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden="true" className="text-link">
                —
              </span>
              {line}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className={CTA_CLASS}>
            <Link to="/signup">
              Create your account
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={CTA_CLASS}>
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
        <p className="text-sm text-tertiary-foreground">{BRAND_PLATFORMS}.</p>
      </div>
    </div>
  );
}
