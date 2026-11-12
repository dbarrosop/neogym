import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

/** Rest presets offered in the UI, in seconds (matches the iOS app). */
export const REST_PRESETS = [30, 60, 90, 180] as const;
export const DEFAULT_REST_SECONDS = 90;

const STATE_KEY = "neogym-rest-timer";
const DEFAULT_KEY = "neogym-rest-seconds";

export interface RestTimerState {
  /** Epoch milliseconds when the rest ends. */
  endsAt: number;
  /** Total length of this rest in seconds (grows with +30 s). */
  duration: number;
  /** Optional context, e.g. "Leg extensions · set 3 next". */
  label: string | null;
  /** Session that started this rest, or null for timers without session context. */
  sessionId: string | null;
}

interface RestTimerContextValue {
  timer: RestTimerState | null;
  defaultSeconds: number;
  start: (options?: { seconds?: number; label?: string | null; sessionId?: string | null }) => void;
  extend: (seconds: number) => void;
  clear: () => void;
  setDefaultSeconds: (seconds: number) => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Storage can be unavailable (private mode); the timer still works in memory.
  }
}

function isTimerState(
  value: unknown,
): value is Omit<RestTimerState, "sessionId"> & { sessionId?: string | null } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RestTimerState>;
  return (
    typeof candidate.endsAt === "number" &&
    typeof candidate.duration === "number" &&
    (candidate.sessionId == null ||
      (typeof candidate.sessionId === "string" && candidate.sessionId.length > 0))
  );
}

/**
 * One rest timer for the whole app. It lives in the shell (sidebar card on
 * desktop, floating pill on mobile) so it keeps running while you navigate,
 * and it survives reloads through localStorage.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<RestTimerState | null>(null);
  const [defaultSeconds, setDefaultSecondsState] = useState(DEFAULT_REST_SECONDS);

  useEffect(() => {
    const stored = readJson<unknown>(STATE_KEY);
    if (isTimerState(stored) && stored.endsAt > Date.now()) {
      setTimer({ ...stored, label: stored.label ?? null, sessionId: stored.sessionId ?? null });
    } else if (stored) {
      write(STATE_KEY, null);
    }
    const storedDefault = readJson<unknown>(DEFAULT_KEY);
    if (typeof storedDefault === "number" && storedDefault > 0) {
      setDefaultSecondsState(storedDefault);
    }
  }, []);

  const update = useCallback((next: RestTimerState | null) => {
    setTimer(next);
    write(STATE_KEY, next);
  }, []);

  useEffect(() => {
    if (!timer) {
      return;
    }
    const remaining = timer.endsAt - Date.now();
    const handle = window.setTimeout(
      () => {
        update(null);
        toast("Rest over", { description: timer.label ?? "Time for the next set." });
        try {
          navigator.vibrate?.([120, 80, 120]);
        } catch {
          // Vibration is best-effort.
        }
      },
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(handle);
  }, [timer, update]);

  const start = useCallback<RestTimerContextValue["start"]>(
    (options) => {
      const seconds = options?.seconds ?? defaultSeconds;
      update({
        endsAt: Date.now() + seconds * 1000,
        duration: seconds,
        label: options?.label ?? null,
        sessionId: options?.sessionId ?? null,
      });
    },
    [defaultSeconds, update],
  );

  const extend = useCallback((seconds: number) => {
    setTimer((current) => {
      if (!current) {
        return current;
      }
      const next = {
        ...current,
        endsAt: current.endsAt + seconds * 1000,
        duration: current.duration + seconds,
      };
      write(STATE_KEY, next);
      return next;
    });
  }, []);

  const clear = useCallback(() => update(null), [update]);

  const setDefaultSeconds = useCallback((seconds: number) => {
    setDefaultSecondsState(seconds);
    write(DEFAULT_KEY, seconds);
  }, []);

  const value = useMemo(
    () => ({ timer, defaultSeconds, start, extend, clear, setDefaultSeconds }),
    [timer, defaultSeconds, start, extend, clear, setDefaultSeconds],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const context = useContext(RestTimerContext);
  if (!context) {
    throw new Error("useRestTimer must be used inside RestTimerProvider");
  }
  return context;
}

/** Seconds left on the running timer, re-rendering about four times a second. */
export function useRestRemaining(timer: RestTimerState | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer) {
      return;
    }
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(handle);
  }, [timer]);
  if (!timer) {
    return 0;
  }
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

export function formatRestClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatRestPreset(seconds: number): string {
  return seconds < 60 || seconds % 60 !== 0 ? `${seconds} s` : `${seconds / 60} min`;
}
