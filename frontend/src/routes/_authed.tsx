import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/nhost/auth-provider";

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!(isLoading || isAuthenticated)) {
      navigate({ to: "/signin", replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="grid-bg flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="h-2 w-32 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  return <Outlet />;
}
