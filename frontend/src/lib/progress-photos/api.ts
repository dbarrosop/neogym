import { graphql } from "@/gql";
import type {
  ProgressPhoto_Bool_Exp,
  ProgressPhotoHistoryQuery,
  ProgressPhotoLabel_Enum,
} from "@/gql/graphql";
import { gqlRequest } from "@/lib/graphql";

const PhotoLabels = graphql(`
  query ProgressPhotoLabels {
    progressPhotoLabels(order_by: { value: asc }) {
      value
      comment
    }
  }
`);

const PhotoSummary = graphql(`
  query ProgressPhotoSummary($where: progressPhoto_bool_exp!) {
    progressPhotosAggregate(where: $where) {
      aggregate {
        count
        max { takenOn }
      }
    }
  }
`);

const PhotoHistory = graphql(`
  query ProgressPhotoHistory($where: progressPhoto_bool_exp!, $limit: Int!) {
    progressPhotos(
      where: $where
      order_by: [{ takenOn: desc }, { createdAt: desc }, { id: desc }]
      limit: $limit
    ) {
      id
      takenOn
      createdAt
      label { value comment }
      file { id isUploaded }
    }
  }
`);

const PhotoById = graphql(`
  query ProgressPhotoDetails($id: uuid!) {
    progressPhoto(id: $id) {
      id
      takenOn
      createdAt
      label { value comment }
      file { id isUploaded }
    }
  }
`);

const ReservePhoto = graphql(`
  mutation ReserveProgressPhoto($label: progressPhotoLabel_enum!, $date: date!) {
    insertProgressPhoto(object: { labelValue: $label, takenOn: $date }) { id }
  }
`);

const UpdatePhoto = graphql(`
  mutation UpdateProgressPhoto($id: uuid!, $label: progressPhotoLabel_enum!, $date: date!) {
    updateProgressPhoto(pk_columns: { id: $id }, _set: { labelValue: $label, takenOn: $date }) { id }
  }
`);

export const JPEG_LIMIT = 5 * 1024 * 1024;
export const PHOTO_PAGE_SIZE = 16;
const PHOTO_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type Photo = ProgressPhotoHistoryQuery["progressPhotos"][number];
export type PhotoLabel = Photo["label"];
export type ReadyPhoto = Photo & { file: { id: string; isUploaded: true } };
export type PhotoCursor = Pick<Photo, "takenOn" | "createdAt" | "id">;
export type PhotoFields = { label: ProgressPhotoLabel_Enum; date: string };

/**
 * Every photo query (rows and image bytes) lives under one owner-scoped prefix in the
 * app's in-memory query cache, so sign-out and account switches drop them together
 * (`PhotoCacheGuard`). A photo's row and bytes share `photo(owner, id)`.
 */
export const photoKeys = {
  all: ["progress_photos"] as const,
  owner: (owner: string) => ["progress_photos", owner] as const,
  labels: (owner: string) => ["progress_photos", owner, "labels"] as const,
  summary: (owner: string) => ["progress_photos", owner, "summary"] as const,
  list: (owner: string, label: string) => ["progress_photos", owner, "list", label] as const,
  /** One label's whole history (older/newer navigation and compare). */
  pose: (owner: string, label: string) => ["progress_photos", owner, "pose", label] as const,
  /** The photos taken on one date (Body's latest check-in). */
  day: (owner: string, date: string) => ["progress_photos", owner, "day", date] as const,
  photo: (owner: string, id: string) => ["progress_photos", owner, "photo", id] as const,
  detail: (owner: string, id: string) => ["progress_photos", owner, "photo", id, "row"] as const,
  bytes: (owner: string, id: string, variant: "thumbnail" | "full") =>
    ["progress_photos", owner, "photo", id, "bytes", variant] as const,
};

/** Image bytes never change (files aren't replaced), so writes don't refetch them. */
export function isPhotoBytesKey(key: readonly unknown[]) {
  return key[2] === "photo" && key[4] === "bytes";
}

/** Queries that list several photos; a delete drops them so none shows the deleted one. */
export function isPhotoCollectionKey(key: readonly unknown[]) {
  return key[2] === "list" || key[2] === "pose" || key[2] === "day";
}

/** Upper bound for one label's history, which older/newer navigation and compare read whole. */
export const POSE_HISTORY_LIMIT = 500;

/** Photo traffic never uses the browser's HTTP cache; auth and refresh stay with the SDK. */
export function photoRequest(signal?: AbortSignal): RequestInit {
  return { signal: signal ?? null, cache: "no-store" };
}

export function readyPhoto(photo: Photo | null | undefined): photo is ReadyPhoto {
  return Boolean(photo?.file?.isUploaded && photo.id === photo.file.id && PHOTO_ID.test(photo.id));
}

/** Group server-ordered rows across page boundaries without collapsing distinct uploads. */
export function photosByDate(photos: readonly ReadyPhoto[]) {
  const dates = new Map<string, ReadyPhoto[]>();
  const seen = new Set<string>();
  for (const photo of photos) {
    if (seen.has(photo.id)) {
      continue;
    }
    seen.add(photo.id);
    const group = dates.get(photo.takenOn);
    if (group) {
      group.push(photo);
    } else {
      dates.set(photo.takenOn, [photo]);
    }
  }
  return [...dates];
}

export function galleryWhere(
  owner: string,
  label: ProgressPhotoLabel_Enum | null,
  cursor: PhotoCursor | null,
): ProgressPhoto_Bool_Exp {
  const where: ProgressPhoto_Bool_Exp = {
    userId: { _eq: owner },
    file: { isUploaded: { _eq: true } },
  };
  if (label) {
    where.labelValue = { _eq: label };
  }
  if (cursor) {
    const { takenOn, createdAt, id } = cursor;
    where._or = [
      { takenOn: { _lt: takenOn } },
      { takenOn: { _eq: takenOn }, createdAt: { _lt: createdAt } },
      { takenOn: { _eq: takenOn }, createdAt: { _eq: createdAt }, id: { _lt: id } },
    ];
  }
  return where;
}

export async function listLabels(signal?: AbortSignal) {
  return (await gqlRequest(PhotoLabels, {}, photoRequest(signal))).progressPhotoLabels;
}

export async function readPhotoSummary(owner: string, signal?: AbortSignal) {
  const { progressPhotosAggregate } = await gqlRequest(
    PhotoSummary,
    { where: galleryWhere(owner, null, null) },
    photoRequest(signal),
  );
  const aggregate = progressPhotosAggregate.aggregate;
  if (!aggregate) {
    throw new Error("Photo summary unavailable.");
  }
  return { count: aggregate.count, latestDate: aggregate.max?.takenOn ?? null };
}

export async function listPhotos(
  owner: string,
  label: ProgressPhotoLabel_Enum | null,
  cursor: PhotoCursor | null,
  signal?: AbortSignal,
) {
  const { progressPhotos } = await gqlRequest(
    PhotoHistory,
    { where: galleryWhere(owner, label, cursor), limit: PHOTO_PAGE_SIZE + 1 },
    photoRequest(signal),
  );
  const visible = progressPhotos.slice(0, PHOTO_PAGE_SIZE);
  const last = visible.at(-1);
  let nextCursor: PhotoCursor | undefined;
  if (last && progressPhotos.length > PHOTO_PAGE_SIZE) {
    const { takenOn, createdAt, id } = last;
    nextCursor = { takenOn, createdAt, id };
  }
  return { items: visible.filter(readyPhoto), nextCursor };
}

/** One label's ready photos, newest first (up to `POSE_HISTORY_LIMIT`). */
export async function listPosePhotos(
  owner: string,
  label: ProgressPhotoLabel_Enum,
  signal?: AbortSignal,
) {
  const { progressPhotos } = await gqlRequest(
    PhotoHistory,
    { where: galleryWhere(owner, label, null), limit: POSE_HISTORY_LIMIT },
    photoRequest(signal),
  );
  return progressPhotos.filter(readyPhoto);
}

/** Up to `limit` ready photos taken on `date`, newest upload first. */
export async function listPhotosOn(owner: string, date: string, signal?: AbortSignal, limit = 8) {
  const where = galleryWhere(owner, null, null);
  where.takenOn = { _eq: date };
  const { progressPhotos } = await gqlRequest(PhotoHistory, { where, limit }, photoRequest(signal));
  return progressPhotos.filter(readyPhoto);
}

export async function readPhoto(id: string, signal?: AbortSignal) {
  if (!PHOTO_ID.test(id)) {
    return null;
  }
  return (await gqlRequest(PhotoById, { id }, photoRequest(signal))).progressPhoto;
}

export async function reservePhoto(fields: PhotoFields, signal?: AbortSignal) {
  const { insertProgressPhoto } = await gqlRequest(ReservePhoto, fields, photoRequest(signal));
  if (!insertProgressPhoto || !PHOTO_ID.test(insertProgressPhoto.id)) {
    throw new Error("Reservation not confirmed.");
  }
  return insertProgressPhoto.id;
}

export async function updatePhoto(id: string, fields: PhotoFields, signal?: AbortSignal) {
  const { updateProgressPhoto } = await gqlRequest(
    UpdatePhoto,
    { id, ...fields },
    photoRequest(signal),
  );
  return updateProgressPhoto?.id === id;
}
