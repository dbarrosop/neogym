import { Link } from "@tanstack/react-router";
import { Timer, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  formatRestClock,
  formatRestPreset,
  useRestRemaining,
  useRestTimer,
} from "@/lib/rest-timer";
import { cn } from "@/lib/utils";

/** Timers restored from older storage may not have a session to open. */
function RestTimerContent({
  sessionId,
  className,
  children,
}: {
  sessionId: string | null;
  className: string;
  children: ReactNode;
}) {
  if (!sessionId) {
    return <div className={className}>{children}</div>;
  }
  return (
    <Link
      to="/train/sessions/$sessionId"
      params={{ sessionId }}
      className={cn(
        "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="sr-only">Open session: </span>
      {children}
    </Link>
  );
}

/** Sidebar card shown while a rest is running (desktop shell). */
export function RestTimerCard() {
  const { timer, extend, clear } = useRestTimer();
  const remaining = useRestRemaining(timer);
  if (!timer) {
    return null;
  }
  const progress = timer.duration > 0 ? 1 - remaining / timer.duration : 1;
  return (
    <section
      aria-label="Rest timer"
      className="mb-2 flex flex-col gap-2.5 rounded-xl border bg-card p-3.5"
    >
      <RestTimerContent
        sessionId={timer.sessionId}
        className="flex min-h-11 items-center justify-between gap-2"
      >
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-[7px] shrink-0 animate-pulse rounded-full bg-link motion-reduce:animate-none"
            />
            <strong className="text-sm font-semibold">Rest</strong>
          </span>
          {timer.label ? (
            <span className="line-clamp-2 text-xs text-muted-foreground">{timer.label}</span>
          ) : null}
        </span>
        <span className="text-[22px] font-bold tabular-nums" role="timer" aria-live="off">
          {formatRestClock(remaining)}
        </span>
      </RestTimerContent>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-link transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" variant="outline" className="h-11" onClick={() => extend(30)}>
          +30 s
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={clear}>
          Skip
        </Button>
      </div>
    </section>
  );
}

/** Floating pill above the mobile tab bar, or above a form page's sticky actions. */
export function RestTimerPill({ raised = false }: { raised?: boolean }) {
  const { timer, extend, clear } = useRestTimer();
  const remaining = useRestRemaining(timer);
  if (!timer) {
    return null;
  }
  return (
    <section
      aria-label="Rest timer"
      className={cn(
        "fixed inset-x-4 z-40 flex items-center gap-1 rounded-full border bg-glass py-1 pr-1 pl-3.5 shadow-lg backdrop-blur-lg md:hidden dark:bg-muted/94",
        // Above the 4rem tab bar, or above a form page's ~4.4rem sticky footer that sits on it.
        raised
          ? "bottom-[calc(env(safe-area-inset-bottom)+9rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]",
      )}
    >
      <RestTimerContent
        sessionId={timer.sessionId}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2"
      >
        <Timer className="size-[18px] shrink-0 text-link" aria-hidden="true" />
        <span className="text-base font-bold tabular-nums" role="timer" aria-live="off">
          {formatRestClock(remaining)}
        </span>
        {timer.label ? (
          <span className="min-w-0 truncate text-[13px] text-muted-foreground">{timer.label}</span>
        ) : null}
      </RestTimerContent>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 min-w-11 rounded-full"
        onClick={() => extend(30)}
      >
        +30 s
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        aria-label="Skip rest"
        onClick={clear}
      >
        <X />
      </Button>
    </section>
  );
}

/**
 * Starts a rest with the default length. Used in session headers so a rest can
 * be started without logging a set.
 */
export function StartRestButton({
  sessionId,
  className,
}: {
  sessionId: string;
  className?: string;
}) {
  const { timer, defaultSeconds, start } = useRestTimer();
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(className)}
      onClick={() => start({ sessionId })}
      disabled={!!timer}
    >
      <Timer />
      Rest {formatRestPreset(defaultSeconds)}
    </Button>
  );
}
