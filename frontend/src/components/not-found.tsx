import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/nhost/auth-provider";

export function NotFound() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col items-center justify-center gap-3.5 px-4 py-24 text-center">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-muted-foreground">404</p>
      <h1 className="text-balance text-[34px] font-bold tracking-[-0.02em]">Page not found</h1>
      <p className="max-w-[380px] text-balance text-base leading-normal text-muted-foreground">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Button asChild className="mt-2 h-11">
        {isAuthenticated ? (
          <Link to="/today">
            <ArrowLeft />
            Back to Today
          </Link>
        ) : (
          <Link to="/">
            <ArrowLeft />
            Back to home
          </Link>
        )}
      </Button>
    </section>
  );
}
