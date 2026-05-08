import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type LinkTo = NonNullable<ComponentProps<typeof Link>["to"]>;

interface BackLinkProps {
  /** Where to go when there's no browser history to pop (e.g., direct/shared load). */
  fallback: LinkTo;
  /** Accessible label. Defaults to "Back". */
  label?: string;
  className?: string;
}

/**
 * Small chevron-only back affordance, designed to sit inline next to a page
 * eyebrow rather than on its own row.
 */
export function BackLink({ fallback, label = "Back", className }: BackLinkProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const baseClass = cn(
    "-ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
    className,
  );

  if (canGoBack) {
    return (
      <button
        type="button"
        onClick={() => router.history.back()}
        className={baseClass}
        aria-label={label}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Link to={fallback} className={baseClass} aria-label={label}>
      <ChevronLeft className="h-4 w-4" />
    </Link>
  );
}
