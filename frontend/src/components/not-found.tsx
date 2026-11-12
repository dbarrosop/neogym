import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <section className="relative">
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">404</p>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Page not found
        </h1>
        <p className="mt-6 max-w-md text-balance text-lg text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-10">
          <Button asChild size="lg">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
