import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type LinkTo = NonNullable<ComponentProps<typeof Link>["to"]>;

interface BackLinkProps {
  /** Where to go when there's no browser history to pop (e.g., direct/shared load). */
  fallback: LinkTo;
  /** Visible label. Defaults to "Back". */
  children?: React.ReactNode;
  className?: string;
}

export function BackLink({ fallback, children = "Back", className }: BackLinkProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const baseClass = cn(
    "inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
    className,
  );

  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.history.back()} className={baseClass}>
        <ArrowLeft className="h-4 w-4" />
        {children}
      </button>
    );
  }

  return (
    <Link to={fallback} className={baseClass}>
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Link>
  );
}
