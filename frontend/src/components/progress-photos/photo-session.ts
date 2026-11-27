import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/nhost/auth-provider";
import { isPhotoBytesKey, photoKeys } from "@/lib/progress-photos/api";

/** The signed-in user whose photos are shown. Photo screens only render under `_authed`. */
export function usePhotoOwner() {
  const { user } = useAuth();
  if (!user) {
    throw new Error("Progress photos need a signed-in user.");
  }
  return user.id;
}

/**
 * Photo rows and image bytes live in the app's in-memory query cache, keyed by owner.
 * Drop every entry that isn't the signed-in user's: all of them after sign-out, and the
 * previous account's after a switch. Mounted once at the root, beside `AuthProvider`.
 */
export function PhotoCacheGuard() {
  const queryClient = useQueryClient();
  const owner = useAuth().user?.id;
  useEffect(() => {
    queryClient.removeQueries({
      queryKey: photoKeys.all,
      predicate: (query) => query.queryKey[1] !== owner,
    });
  }, [queryClient, owner]);
  return null;
}

/** After a write, refetch photo rows (lists, summary, details); image bytes never change. */
export function invalidatePhotoRows(queryClient: QueryClient, owner: string) {
  return queryClient.invalidateQueries({
    queryKey: photoKeys.owner(owner),
    predicate: (query) => !isPhotoBytesKey(query.queryKey),
  });
}
