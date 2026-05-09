import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthCard } from "@/components/auth-card";
import { useAuth } from "@/lib/nhost/auth-provider";
import { PKCE_VERIFIER_STORAGE_KEY } from "@/lib/nhost/pkce";

const searchSchema = z.object({
  code: z.string().optional(),
  refreshToken: z.string().optional(),
  error: z.string().optional(),
  errorDescription: z.string().optional(),
});

export const Route = createFileRoute("/verify")({
  validateSearch: searchSchema,
  component: VerifyRoute,
});

function VerifyRoute() {
  const { nhost } = useAuth();
  const navigate = useNavigate();
  const { code, error, errorDescription } = Route.useSearch();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) {
      return;
    }
    ranRef.current = true;

    if (error) {
      toast.error("Verification failed", {
        description: errorDescription ?? error,
      });
      navigate({ to: "/profile", replace: true });
      return;
    }

    if (!code) {
      toast.error("Verification link is missing a code");
      navigate({ to: "/profile", replace: true });
      return;
    }

    const verifier = localStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
    if (!verifier) {
      toast.error("Verification expired", {
        description: "Please retry from the device where you started the request.",
      });
      navigate({ to: "/profile", replace: true });
      return;
    }

    (async () => {
      try {
        const response = await nhost.auth.tokenExchange({
          code,
          codeVerifier: verifier,
        });
        if (!response.body?.session) {
          throw new Error("No session returned from token exchange");
        }
        toast.success("Email verified");
        navigate({ to: "/profile", replace: true });
      } catch (err) {
        toast.error("Couldn't verify that link", {
          description: err instanceof Error ? err.message : "Unexpected error",
        });
        navigate({ to: "/profile", replace: true });
      } finally {
        localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
      }
    })();
  }, [code, error, errorDescription, nhost, navigate]);

  return (
    <AuthCard title="Verifying" description="Hang tight while we confirm your link.">
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AuthCard>
  );
}
