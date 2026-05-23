import { useEffect, useRef } from "react";

interface UsePersistedSearchOptions<T> {
  storageKey: string;
  search: T;
  isEmpty: boolean;
  apply: (next: T) => void;
}

// Persists a route's search params to localStorage and restores them when the
// user revisits the page with an empty URL. URL is still the source of truth —
// links into the page with explicit filters override what's stored.
export function usePersistedSearch<T>({
  storageKey,
  search,
  isEmpty,
  apply,
}: UsePersistedSearchOptions<T>) {
  const hydrated = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // biome-ignore lint/correctness/useExhaustiveDependencies: hydrate once on mount
  useEffect(() => {
    if (hydrated.current) {
      return;
    }
    hydrated.current = true;
    if (typeof window === "undefined") {
      return;
    }
    if (!isEmpty) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as T;
      applyRef.current(parsed);
    } catch {
      // ignore corrupted storage
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (isEmpty) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(search));
      }
    } catch {
      // ignore storage failures (quota, private mode)
    }
  }, [storageKey, search, isEmpty]);
}
