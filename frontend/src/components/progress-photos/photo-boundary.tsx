import type { NhostClient } from "@nhost/nhost-js";
import { DEFAULT_SESSION_KEY } from "@nhost/nhost-js/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/nhost/auth-provider";
import { PhotoScope } from "@/lib/progress-photos/scope";

const PhotoContext = createContext<PhotoScope | null>(null);

export function usePhotoScope() {
  const scope = useContext(PhotoContext);
  if (!scope) {
    throw new Error("Progress photos are outside their private route.");
  }
  return scope;
}

export function PhotoBoundary() {
  const { nhost, user, isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const keepWhileHidden =
    pathname === "/progress/body/photos/new" || pathname === "/progress/body/photos/new/";
  return user && isAuthenticated ? (
    <PhotoLifetime
      key={`${user.id}:${pathname}`}
      owner={user.id}
      client={nhost}
      keepWhileHidden={keepWhileHidden}
    />
  ) : null;
}

function sessionEventMatches(value: string | null, owner: string) {
  try {
    return value !== null && JSON.parse(value)?.user?.id === owner;
  } catch {
    return false;
  }
}

function PhotoLifetime({
  owner,
  client,
  keepWhileHidden,
}: {
  owner: string;
  client: NhostClient;
  keepWhileHidden: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [lifetime, setLifetime] = useState<{
    scope: PhotoScope;
    queries: QueryClient;
    generation: number;
  } | null>(null);
  const generation = useRef(0);

  useLayoutEffect(() => {
    const node = root.current;
    let scope: PhotoScope | undefined;
    let disposed = false;
    let pageHidden = false;

    const reconcile = () => {
      // A native chooser can hide the document without navigating. Conceal just
      // the preview, leaving its input and any in-flight create submission intact.
      node?.toggleAttribute("data-photo-concealed", document.hidden);
      if (
        pageHidden ||
        client.getUserSession()?.user?.id !== owner ||
        (document.hidden && !keepWhileHidden)
      ) {
        scope?.close();
      } else if (!scope && !document.hidden) {
        // A fresh cache per foreground owner and path. Never use the global app
        // cache, route loaders, persistent drafts, or offline mutation replay.
        const queries = new QueryClient({
          defaultOptions: { queries: { gcTime: 0, retry: false, networkMode: "always" } },
        });
        scope = new PhotoScope(
          client,
          owner,
          () => {
            // Revoking an object URL alone doesn't remove decoded pixels.
            if (node) {
              node.hidden = true;
            }
            queries.clear();
            scope = undefined;
            if (!disposed) {
              setLifetime(null);
            }
          },
          keepWhileHidden,
        );
        setLifetime({ scope, queries, generation: ++generation.current });
      }
    };

    const unsubscribe = client.sessionStorage.onChange((session) => {
      if (session?.user?.id !== owner) {
        scope?.close();
      }
      reconcile();
    });
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }
      if (event.key === null || event.key === DEFAULT_SESSION_KEY) {
        if (!sessionEventMatches(event.newValue, owner)) {
          scope?.close();
        }
        reconcile();
      }
    };
    const hide = () => {
      pageHidden = true;
      scope?.close();
    };
    const show = () => {
      pageHidden = false;
      reconcile();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    reconcile();

    return () => {
      disposed = true;
      unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      scope?.close();
    };
  }, [owner, client, keepWhileHidden]);

  const active = lifetime !== null && !lifetime.scope.signal.aborted;
  useLayoutEffect(() => {
    if (root.current) {
      root.current.hidden = !lifetime || lifetime.scope.signal.aborted;
    }
  }, [lifetime]);

  return (
    <div ref={root} hidden={!active} className="group/photo-route">
      {active ? (
        <QueryClientProvider key={lifetime.generation} client={lifetime.queries}>
          <PhotoContext.Provider value={lifetime.scope}>
            <Outlet />
          </PhotoContext.Provider>
        </QueryClientProvider>
      ) : null}
    </div>
  );
}
