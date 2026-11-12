import { Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatRestClock,
  formatRestPreset,
  useRestRemaining,
  useRestTimer,
} from "@/lib/rest-timer";
import { cn } from "@/lib/utils";

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
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
        <strong className="flex-1 text-sm font-semibold">Rest</strong>
        <span className="text-xl font-semibold tabular-nums" role="timer" aria-live="off">
          {formatRestClock(remaining)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
      {timer.label ? (
        <span className="line-clamp-2 text-[13px] text-muted-foreground">{timer.label}</span>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => extend(30)}>
          +30 s
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Skip
        </Button>
      </div>
    </section>
  );
}

/** Floating pill above the mobile tab bar while a rest is running. */
export function RestTimerPill() {
  const { timer, extend, clear } = useRestTimer();
  const remaining = useRestRemaining(timer);
  if (!timer) {
    return null;
  }
  return (
    <section
      aria-label="Rest timer"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 flex items-center gap-1 rounded-full border bg-glass py-1 pr-1 pl-3.5 shadow-lg backdrop-blur-lg md:hidden"
    >
      <Timer className="size-4 text-link" aria-hidden="true" />
      <span className="px-1.5 text-base font-semibold tabular-nums" role="timer" aria-live="off">
        {formatRestClock(remaining)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => extend(30)}
      >
        +30 s
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
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
export function StartRestButton({ className }: { className?: string }) {
  const { timer, defaultSeconds, start } = useRestTimer();
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(className)}
      onClick={() => start()}
      disabled={!!timer}
    >
      <Timer />
      Rest {formatRestPreset(defaultSeconds)}
    </Button>
  );
}
