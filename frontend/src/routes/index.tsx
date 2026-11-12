import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/nhost/auth-provider";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

const HIGHLIGHTS = [
  "Log sets with last session’s numbers beside them.",
  "Eat to a plan, slot by slot, with snapshots that never drift.",
  "See weekly sets per muscle, strength trends, weight and energy.",
];

function HomeRoute() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Signed-in visitors land on Today; the marketing page is for signed-out users.
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/today", replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <section className="relative">
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col justify-center gap-8 px-4 py-20">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Training, food and body data in one log.
        </h1>
        <ul className="flex flex-col gap-3 text-lg text-muted-foreground">
          {HIGHLIGHTS.map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden="true" className="text-link">
                —
              </span>
              {line}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/signup">
              Create your account
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
        <p className="text-sm text-tertiary-foreground">Web · iPhone · Apple Watch</p>
      </div>
    </section>
  );
}
