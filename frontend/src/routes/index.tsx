import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/nhost/auth-provider";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  const { isAuthenticated, user } = useAuth();

  return (
    <section className="grid-bg relative">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Built with TanStack Start, Nhost, and Tailwind v4
        </div>

        <h1 className="text-balance bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
          Train smarter.
          <br />
          Move faster.
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          NeoGym is your modern fitness HQ — secure auth, real-time data, and a UI that gets out of
          your way.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {isAuthenticated ? (
            <Button asChild size="lg">
              <Link to="/sessions">
                Welcome back, {user?.displayName?.split(" ")[0] ?? "athlete"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link to="/signup">
                  Create your account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/signin">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
