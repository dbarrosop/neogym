import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthCard } from "@/components/auth-card";
import { Badge } from "@/components/ui/badge";
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
      <AuthCard title="Authorizing" description="Checking your session…">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    );
  }

  if (consent.isPending) {
    return (
      <AuthCard
        title="Loading authorization request"
        description="Hang tight while we fetch the details."
      >
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </AuthCard>
    );
  }

  if (consent.isError || !consent.data) {
    return (
      <AuthCard
        title="Authorization request unavailable"
        description="We couldn't load the details for this request. The link may have expired."
        footer={
          <Link to="/" className="font-medium text-foreground hover:underline">
            Back home
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          {consent.error instanceof Error ? consent.error.message : "Unknown error"}
        </p>
      </AuthCard>
    );
  }

  const { clientId, scopes, redirectUri } = consent.data;

  return (
    <AuthCard
      title="Authorize application"
      description={`${clientId} wants access to your NeoGym account.`}
      footer={
        <span>
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </span>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-foreground">Will redirect to</p>
          <p className="break-all text-muted-foreground">{redirectUri}</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-foreground">Requested permissions</p>
          {scopes.length === 0 ? (
            <p className="text-muted-foreground">No specific scopes requested.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {scopes.map((scope) => (
                <li key={scope}>
                  <Badge variant="outline" className="font-mono text-xs">
                    {scope}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={approve.isPending}
            onClick={() => navigate({ to: "/" })}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={approve.isPending}
            onClick={() => approve.mutate()}
          >
            {approve.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authorizing
              </>
            ) : (
              "Authorize"
            )}
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
