import type { NhostClient } from "@nhost/nhost-js";
import type { Session } from "@nhost/nhost-js/auth";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { nhost } from "./client";

interface AuthContextType {
  user: Session["user"] | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  nhost: NhostClient;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const lastRefreshTokenIdRef = useRef<string | null>(null);

  const client = useMemo(() => nhost, []);

  const reloadSession = useCallback(
    (currentRefreshTokenId: string | null) => {
      if (currentRefreshTokenId === lastRefreshTokenIdRef.current) {
        return;
      }
      lastRefreshTokenIdRef.current = currentRefreshTokenId;
      const next = client.getUserSession();
      setUser(next?.user ?? null);
      setSession(next);
      setIsAuthenticated(Boolean(next));
    },
    [client],
  );

  useEffect(() => {
    setIsLoading(true);
    const initial = client.getUserSession();
    setUser(initial?.user ?? null);
    setSession(initial);
    setIsAuthenticated(Boolean(initial));
    lastRefreshTokenIdRef.current = initial?.refreshTokenId ?? null;
    setIsLoading(false);

    const unsubscribe = client.sessionStorage.onChange((next) => {
      reloadSession(next?.refreshTokenId ?? null);
    });

    return unsubscribe;
  }, [client, reloadSession]);

  useEffect(() => {
    const checkSessionOnFocus = () => {
      reloadSession(client.getUserSession()?.refreshTokenId ?? null);
    };
    const visibilityHandler = () => {
      if (!document.hidden) {
        checkSessionOnFocus();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("focus", checkSessionOnFocus);
    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("focus", checkSessionOnFocus);
    };
  }, [client, reloadSession]);

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated,
    isLoading,
    nhost: client,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
