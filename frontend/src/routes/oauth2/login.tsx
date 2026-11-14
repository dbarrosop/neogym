import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Shield } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/nhost/auth-provider";

const searchSchema = z.object({
  request_id: z.string().uuid(),
});

export const Route = createFileRoute("/oauth2/login")({
  validateSearch: searchSchema,
  component: OAuth2LoginRoute,
});

function OAuth2LoginRoute() {
  const { request_id } = Route.useSearch();
  const { nhost, isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const navigate = useNavigate();

  const consent = useQuery({
    queryKey: ["oauth2", "login", request_id],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await nhost.auth.oauth2LoginGet({ request_id });
      if (!response.body) {
        throw new Error("Empty response from authorization server");
      }
      return response.body;
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      const response = await nhost.auth.oauth2LoginPost({ requestId: request_id });
      if (!response.body?.redirectUri) {
        throw new Error("Missing redirect URI");
      }
      return response.body.redirectUri;
    },
    onSuccess: (redirectUri) => {
      window.location.href = redirectUri;
    },
    onError: (err) => {
      toast.error("Could not authorize the application", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    },
  });

  useEffect(() => {
    if (!(isAuthLoading || isAuthenticated)) {
      const redirect = `/oauth2/login?request_id=${encodeURIComponent(request_id)}`;
      navigate({ to: "/signin", search: { redirect }, replace: true });
    }
  }, [isAuthLoading, isAuthenticated, navigate, request_id]);

  if (isAuthLoading || !isAuthenticated) {
    return (
      <AuthCard layout="card" title="Authorizing" description="Checking your session…">
        <div className="flex items-center justify-center py-6">
          <Loader2 aria-hidden="true" className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    );
  }

  if (consent.isPending) {
    return (
      <AuthCard
        layout="card"
        title="Loading authorization request"
        description="Hang tight while we fetch the details."
      >
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </AuthCard>
    );
  }

  if (consent.isError || !consent.data) {
    return (
      <AuthCard
        layout="card"
        title="Authorization request unavailable"
        description="We couldn't load the details for this request. The link may have expired."
        footer={
          <Link
            to="/"
            className="rounded-sm font-semibold text-link underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Back home
          </Link>
        }
      >
        <p className="text-muted-foreground">
          {consent.error instanceof Error ? consent.error.message : "Unknown error"}
        </p>
      </AuthCard>
    );
  }

  const { clientId, scopes, redirectUri } = consent.data;

  return (
    <AuthCard
      layout="card"
      title="Authorize application"
      description={`${clientId} wants access to your NeoGym account.`}
      footer="Only approve apps you started connecting yourself."
    >
      <p className="flex items-center gap-2.5 rounded-[10px] bg-surface-inset px-3 py-2.5 text-muted-foreground">
        <Shield aria-hidden="true" className="size-5 shrink-0 text-link" />
        <span className="min-w-0 break-all">
          Signed in as <strong className="font-medium text-foreground">{user?.email}</strong>
        </span>
      </p>
      <div className="flex flex-col gap-2">
        <p className="font-medium text-foreground">Requested permissions</p>
        {scopes.length === 0 ? (
          <p className="text-muted-foreground">No specific scopes requested.</p>
        ) : (
          <ul className="divide-y divide-border rounded-[10px] border border-border">
            {scopes.map((scope) => (
              <li key={scope} className="flex min-h-[38px] items-center gap-2.5 px-3 py-1.5">
                <Check
                  aria-hidden="true"
                  strokeWidth={2.4}
                  className="size-4 shrink-0 text-positive"
                />
                <code className="break-all font-medium font-mono text-[13px] text-foreground">
                  {scope}
                </code>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">Will redirect to</p>
        <code className="break-all font-medium font-mono text-[13px] text-muted-foreground">
          {redirectUri}
        </code>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-28 font-semibold"
          disabled={approve.isPending}
          onClick={() => navigate({ to: "/today", replace: true })}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11 min-w-32 font-semibold"
          disabled={approve.isPending}
          onClick={() => approve.mutate()}
        >
          {approve.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Authorizing
            </>
          ) : (
            "Authorize"
          )}
        </Button>
      </div>
    </AuthCard>
  );
}
