import { JPEG_LIMIT } from "./api";
import {
  checkDimensions,
  INPUT_BYTE_LIMIT,
  inspectImage,
  jpegDimensions,
  OUTPUT_EDGE,
} from "./image-headers";
import { stripJpegMetadata } from "./jpeg";
import type { PhotoScope } from "./scope";

function readSource(source: File, signal: AbortSignal) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    signal.throwIfAborted();
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal.addEventListener("abort", abort, { once: true });
    reader.onloadend = () => {
      signal.removeEventListener("abort", abort);
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(signal.aborted ? signal.reason : new Error("Couldn't read the selected photo."));
      }
    };
    reader.readAsArrayBuffer(source);
  });
}

export async function preparePhoto(scope: PhotoScope, source: File, signal: AbortSignal) {
  scope.assertActive(signal);
  if (source.size === 0 || source.size > INPUT_BYTE_LIMIT) {
    throw new Error("Choose a nonempty photo up to 25 MiB.");
  }
  const bytes = await readSource(source, signal);
  scope.assertActive(signal);
  let type: ReturnType<typeof inspectImage>;
  try {
    type = inspectImage(bytes);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error("The image header is incomplete or invalid.");
    }
    throw error;
  }
  const url = scope.objectURL(new Blob([bytes], { type }));
  const image = new Image();
  const release = () => {
    image.removeAttribute("src");
    scope.releaseURL(url);
  };
  signal.addEventListener("abort", release, { once: true });
  try {
    image.src = url;
    await image.decode().catch(() => {
      scope.assertActive(signal);
      if (type === "image/heic") {
        throw new Error(
          "This browser can't open this HEIC photo. Choose or export a JPEG or PNG instead.",
        );
      }
      throw new Error("This browser couldn't open the photo. Choose a valid JPEG or PNG.");
    });
    scope.assertActive(signal);
    return await encodePhoto(image, scope, signal);
  } finally {
    signal.removeEventListener("abort", release);
    release();
  }
}

async function encodePhoto(image: HTMLImageElement, scope: PhotoScope, signal: AbortSignal) {
  // The browser's image decoder applies source orientation before drawImage.
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  checkDimensions({ width, height });
  const ratio = Math.min(1, OUTPUT_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  try {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("This browser couldn't prepare the photo.");
    }
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.76, 0.62]) {
      // biome-ignore lint/performance/noAwaitInLoops: lower quality only when the previous encode is too large.
      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      scope.assertActive(signal);
      if (jpeg?.type === "image/jpeg" && jpeg.size > 0 && jpeg.size <= JPEG_LIMIT) {
        const encoded = await jpeg.arrayBuffer();
        const view = new DataView(encoded);
        scope.assertActive(signal);
        if (view.getUint16(0) === 0xffd8) {
          const size = jpegDimensions(view);
          if (size.width === canvas.width && size.height === canvas.height) {
            return stripJpegMetadata(encoded);
          }
        }
      }
    }
    throw new Error("Couldn't make a JPEG under 5 MiB. Try a smaller photo.");
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
