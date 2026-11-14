import { AlertCircle, type LucideIcon, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Icon shown in a 44 px accent-soft tile above the title. */
  icon?: LucideIcon;
  /** Primary and secondary actions, rendered in one centred row. */
  actions?: ReactNode;
  /** Extra content under the description (kept for existing callers; prefer `actions`). */
  children?: ReactNode;
  className?: string;
}

/** Dashed empty-list surface from the Web · States board. */
export function EmptyState({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-input border-dashed px-6 py-9 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-xl bg-accent-soft text-link"
        >
          <Icon className="size-[22px]" />
        </span>
      ) : null}
      <p className="text-[17px] font-bold">{title}</p>
      {description ? (
        <p className="max-w-[340px] text-sm leading-normal text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}
      {children ? <div className="flex justify-center">{children}</div> : null}
    </div>
  );
}

/** Shown instead of a raw fetch failure; the request never reached the server. */
export const NETWORK_ERROR_MESSAGE = "Network request failed. Check your connection and try again.";

// Chromium, Firefox, Safari and React Native-style fetch failures.
const NETWORK_FAILURE =
  /failed to fetch|networkerror|network request failed|load failed|network error/i;

/** Replaces browser fetch-failure text with a friendly message; keeps specific messages. */
export function errorStateMessage(message: ReactNode): ReactNode {
  if (message === undefined || message === null || message === "") {
    return NETWORK_ERROR_MESSAGE;
  }
  return typeof message === "string" && NETWORK_FAILURE.test(message)
    ? NETWORK_ERROR_MESSAGE
    : message;
}

interface ErrorStateProps {
  title?: ReactNode;
  /** Specific failure text; omitted or browser network failures show `NETWORK_ERROR_MESSAGE`. */
  message?: ReactNode;
  /** Renders an outline Retry button under the alert. */
  onRetry?: () => void;
  /** Disables Retry while the request is running again. */
  isRetrying?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  isRetrying = false,
  className,
}: ErrorStateProps) {
  const alert = (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3.5",
        onRetry ? undefined : className,
      )}
    >
      <AlertCircle aria-hidden="true" className="size-5 shrink-0 text-destructive" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-sm leading-[1.45] text-destructive-soft-foreground">
          {errorStateMessage(message)}
        </p>
      </div>
    </div>
  );
  if (!onRetry) {
    return alert;
  }
  return (
    <div className={cn("flex flex-col items-start gap-3.5", className)}>
      <div className="self-stretch">{alert}</div>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={onRetry}
        disabled={isRetrying}
      >
        <RefreshCw className={cn(isRetrying && "animate-spin motion-reduce:animate-none")} />
        Retry
      </Button>
    </div>
  );
}

interface SkeletonStateProps {
  children: ReactNode;
  className?: string;
}

export function SkeletonState({ children, className }: SkeletonStateProps) {
  return (
    <div className={className} role="status" aria-busy="true" aria-label="Loading">
      {children}
    </div>
  );
}
