import { JPEG_LIMIT, photoFetch, readPhoto } from "./api";
import type { PhotoScope } from "./scope";

const DISPLAY_IMAGE = /^image\/(jpeg|webp|png)(;|$)/i;

function filesURL(scope: PhotoScope) {
  return `${scope.client.storage.baseURL}/files`;
}

export async function uploadPhoto(scope: PhotoScope, id: string, jpeg: Blob) {
  const body = new FormData();
  body.append("bucket-id", "progress_photos");
  body.append("metadata[]", new Blob([JSON.stringify({ id })], { type: "application/json" }), "");
  body.append("file[]", jpeg, "progress-photo.jpg");
  const response = await photoFetch(
    scope,
    filesURL(scope),
    { method: "POST", body },
    scope.signal,
    45_000,
  );
  if (!response.ok) {
    return false;
  }
  const result: { processedFiles?: { id?: string; isUploaded?: boolean }[] } =
    await response.json();
  scope.assertActive();
  return (
    result.processedFiles?.length === 1 &&
    result.processedFiles[0]?.id === id &&
    result.processedFiles[0]?.isUploaded === true
  );
}

export async function deletePhoto(scope: PhotoScope, id: string) {
  try {
    const response = await photoFetch(
      scope,
      `${filesURL(scope)}/${id}`,
      { method: "DELETE" },
      scope.signal,
      12_000,
    );
    if (response.ok || response.status === 404) {
      return true;
    }
  } catch {
    scope.assertActive();
  }
  // A missing row establishes inaccessibility, not physical byte removal.
  return (await readPhoto(scope, id)) === null;
}

export function loadPhotoBytes(
  scope: PhotoScope,
  id: string,
  thumbnail: boolean,
  use: AbortSignal,
) {
  const signal = AbortSignal.any([scope.signal, use]);
  return scope.withImageSlot(signal, async () => {
    const url = `${filesURL(scope)}/${id}${thumbnail ? "?w=480&h=600" : ""}`;
    const response = await photoFetch(scope, url, {}, signal, 20_000);
    if (
      !response.ok ||
      !response.body ||
      !DISPLAY_IMAGE.test(response.headers.get("Content-Type") ?? "")
    ) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error("Image unavailable.");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0;
    try {
      while (true) {
        // biome-ignore lint/performance/noAwaitInLoops: cap the byte stream before accumulating more chunks.
        const { value, done } = await reader.read();
        scope.assertActive(signal);
        if (done) {
          break;
        }
        bytes += value.byteLength;
        if (bytes > JPEG_LIMIT) {
          throw new Error("Image unavailable.");
        }
        chunks.push(new Uint8Array(value));
      }
    } finally {
      void reader.cancel().catch(() => undefined);
    }
    if (bytes === 0) {
      throw new Error("Image unavailable.");
    }
    return new Blob(chunks, { type: response.headers.get("Content-Type") ?? "image/jpeg" });
  });
}
