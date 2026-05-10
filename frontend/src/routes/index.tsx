import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Copy, Plug, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/nhost/auth-provider";

const MCP_URL = import.meta.env.VITE_MCP_URL ?? "http://localhost:3000";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  const { isAuthenticated, user } = useAuth();
  const [copied, setCopied] = useState(false);

  async function copyMcpUrl() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy the URL manually");
    }
  }

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

        {isAuthenticated && (
          <Card className="mt-16 w-full max-w-2xl border-border/60 bg-background/50 text-left backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-primary/10 text-primary">
                  <Plug className="h-4 w-4" />
                </div>
                <CardTitle>Connect your favorite agent</CardTitle>
              </div>
              <CardDescription>
                NeoGym speaks{" "}
                <a
                  href="https://modelcontextprotocol.io"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  MCP
                </a>
                . Point Claude, Cursor, or any MCP-compatible agent at the URL below to log workouts
                and query your training data in natural language.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-2">
                <code className="flex-1 truncate px-2 font-mono text-sm text-foreground">
                  {MCP_URL}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyMcpUrl}
                  aria-label="Copy MCP URL"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
