import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { ProgressPhotoLabel_Enum } from "@/gql/graphql";
import { useBodyMeasurements } from "@/lib/hooks/use-body-measurements";
import { useAuth } from "@/lib/nhost/auth-provider";
import {
  isPhotoBytesKey,
  isPhotoCollectionKey,
  listPosePhotos,
  photoKeys,
} from "@/lib/progress-photos/api";
import { measurementNear } from "@/lib/progress-photos/sheet";

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

/**
 * Before leaving a deleted photo: drop every cached photo list (so none can show it while
 * reloading) and refresh the count. Call `forgetPhoto` once its screen has unmounted.
 */
export function dropPhotoCollections(queryClient: QueryClient, owner: string) {
  queryClient.removeQueries({
    queryKey: photoKeys.owner(owner),
    predicate: (query) => isPhotoCollectionKey(query.queryKey),
  });
  return queryClient.invalidateQueries({ queryKey: photoKeys.summary(owner) });
}

export function forgetPhoto(queryClient: QueryClient, owner: string, id: string) {
  queryClient.removeQueries({ queryKey: photoKeys.photo(owner, id) });
}

/** One label's ready photos, newest first; `null` label disables the read. */
export function usePosePhotos(label: ProgressPhotoLabel_Enum | null) {
  const owner = usePhotoOwner();
  return useQuery({
    queryKey: photoKeys.pose(owner, label ?? ""),
    queryFn: ({ signal }) => listPosePhotos(owner, label as ProgressPhotoLabel_Enum, signal),
    enabled: label !== null,
  });
}

/**
 * Body measurements for photo dates, from the same cache as Progress › Body. `maxDays`
 * = 0 matches the same date only; more also accepts the latest earlier reading.
 */
export function usePhotoMeasurements(maxDays: number) {
  const { data } = useBodyMeasurements();
  const rows = data?.bodyMeasurements;
  return useMemo(
    () => (date: string) => (rows ? measurementNear(rows, date, maxDays) : null),
    [rows, maxDays],
  );
}
