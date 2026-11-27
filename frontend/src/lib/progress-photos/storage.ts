import { FetchError } from "@nhost/nhost-js/fetch";
import { nhost } from "@/lib/nhost/client";
import { photoRequest, readPhoto } from "./api";

export const PHOTO_BUCKET = "progress_photos";
const DISPLAY_IMAGE = /^image\/(jpeg|webp|png)(;|$)/i;
/** Private server-side resize for gallery tiles; the viewer reads the prepared JPEG. */
const THUMBNAIL = { w: 480, h: 600 } as const;

/** Upload bytes for a reservation. `true` only when Storage confirms this exact ID is ready. */
export async function uploadPhoto(id: string, jpeg: Blob, signal?: AbortSignal) {
  const file = new File([jpeg], "progress-photo.jpg", { type: "image/jpeg" });
  const { body } = await nhost.storage.uploadFiles(
    { "bucket-id": PHOTO_BUCKET, "metadata[]": [{ id }], "file[]": [file] },
    photoRequest(signal),
  );
  const [processed] = body.processedFiles ?? [];
  return body.processedFiles?.length === 1 && processed?.id === id && processed.isUploaded === true;
}

/** Delete a photo's file (cascading to its row); reconciles an uncertain response by reading it. */
export async function deletePhoto(id: string, signal?: AbortSignal) {
  try {
    await nhost.storage.deleteFile(id, photoRequest(signal));
    return true;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof FetchError && error.status === 404) {
      return true;
    }
  }
  // A missing row establishes inaccessibility, not physical byte removal.
  return (await readPhoto(id, signal)) === null;
}

export async function loadPhotoBytes(
  id: string,
  variant: "thumbnail" | "full",
  signal?: AbortSignal,
) {
  const { body, headers } = await nhost.storage.getFile(
    id,
    variant === "thumbnail" ? THUMBNAIL : undefined,
    photoRequest(signal),
  );
  if (body.size === 0 || !DISPLAY_IMAGE.test(headers.get("Content-Type") ?? "")) {
    throw new Error("Image unavailable.");
  }
  return body;
}
