import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";
import { graphql } from "@/gql";
import type {
  ProgressPhoto_Bool_Exp,
  ProgressPhotoHistoryQuery,
  ProgressPhotoLabel_Enum,
} from "@/gql/graphql";
import type { PhotoScope } from "./scope";

const PhotoLabels = graphql(`
  query ProgressPhotoAngles {
    progressPhotoLabels(order_by: { value: asc }) {
      value
      comment
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
export type PhotoAngle = Photo["label"];
export type PhotoCursor = Pick<Photo, "takenOn" | "createdAt" | "id">;
export type PhotoFields = { label: ProgressPhotoLabel_Enum; date: string };

export function readyPhoto(photo: Photo | null | undefined): photo is Photo & {
  file: { id: string; isUploaded: true };
} {
  return Boolean(photo?.file?.isUploaded && photo.id === photo.file.id && PHOTO_ID.test(photo.id));
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

export async function photoFetch(
  scope: PhotoScope,
  url: string,
  request: RequestInit,
  use: AbortSignal,
  timeout: number,
) {
  const signal = AbortSignal.any([scope.signal, use, AbortSignal.timeout(timeout)]);
  const token = await scope.accessToken(signal);
  scope.assertActive(signal);
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    ...request,
    headers,
    signal,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  scope.assertActive(signal);
  return response;
}

async function photoGraphQL<T, V>(
  scope: PhotoScope,
  document: TypedDocumentNode<T, V>,
  variables: V,
  use = scope.signal,
) {
  const response = await photoFetch(
    scope,
    scope.client.graphql.url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: print(document), variables }),
    },
    use,
    12_000,
  );
  if (!response.ok) {
    throw new Error("Photo request failed.");
  }
  const body: { data?: T; errors?: unknown[] } = await response.json();
  scope.assertActive(use);
  if (!body.data || (body.errors?.length ?? 0) > 0) {
    throw new Error("Photo request failed.");
  }
  return body.data;
}

export async function listAngles(scope: PhotoScope, signal: AbortSignal) {
  return (await photoGraphQL(scope, PhotoLabels, {}, signal)).progressPhotoLabels;
}

export async function listPhotos(
  scope: PhotoScope,
  label: ProgressPhotoLabel_Enum | null,
  cursor: PhotoCursor | null,
  signal: AbortSignal,
) {
  const { progressPhotos } = await photoGraphQL(
    scope,
    PhotoHistory,
    { where: galleryWhere(scope.owner, label, cursor), limit: PHOTO_PAGE_SIZE + 1 },
    signal,
  );
  return {
    items: progressPhotos.slice(0, PHOTO_PAGE_SIZE).filter(readyPhoto),
    hasNext: progressPhotos.length > PHOTO_PAGE_SIZE,
  };
}

export async function readPhoto(scope: PhotoScope, id: string, signal = scope.signal) {
  if (!PHOTO_ID.test(id)) {
    return null;
  }
  return (await photoGraphQL(scope, PhotoById, { id }, signal)).progressPhoto;
}

export async function reservePhoto(scope: PhotoScope, fields: PhotoFields) {
  const { insertProgressPhoto } = await photoGraphQL(scope, ReservePhoto, fields);
  if (!insertProgressPhoto || !PHOTO_ID.test(insertProgressPhoto.id)) {
    throw new Error("Reservation not confirmed.");
  }
  return insertProgressPhoto.id;
}

export async function updatePhoto(scope: PhotoScope, id: string, fields: PhotoFields) {
  const { updateProgressPhoto } = await photoGraphQL(scope, UpdatePhoto, { id, ...fields });
  return updateProgressPhoto?.id === id;
}
