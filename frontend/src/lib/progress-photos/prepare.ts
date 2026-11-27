import { JPEG_LIMIT } from "./api";
import {
  checkDimensions,
  INPUT_BYTE_LIMIT,
  inspectImage,
  jpegDimensions,
  OUTPUT_EDGE,
} from "./image-headers";
import { stripJpegMetadata } from "./jpeg";

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

/**
 * Decode a chosen still (orientation applied by the browser) and re-encode it as a
 * bounded JPEG without the source's metadata. Everything stays in this page's memory.
 */
export async function preparePhoto(source: File, signal: AbortSignal) {
  signal.throwIfAborted();
  if (source.size === 0 || source.size > INPUT_BYTE_LIMIT) {
    throw new Error("Choose a photo up to 25 MB.");
  }
  const bytes = await readSource(source, signal);
  signal.throwIfAborted();
  let type: ReturnType<typeof inspectImage>;
  try {
    type = inspectImage(bytes);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error("This file looks damaged. Choose another photo.");
    }
    throw error;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const image = new Image();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    }
  };
  signal.addEventListener("abort", release, { once: true });
  try {
    image.src = url;
    await image.decode().catch(() => {
      signal.throwIfAborted();
      if (type === "image/heic") {
        throw new Error("This browser can't open HEIC photos. Export it as a JPEG or PNG first.");
      }
      throw new Error("Couldn't open this photo. Choose a JPEG or PNG.");
    });
    signal.throwIfAborted();
    return await encodePhoto(image, signal);
  } finally {
    signal.removeEventListener("abort", release);
    release();
  }
}

async function encodePhoto(image: HTMLImageElement, signal: AbortSignal) {
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
      signal.throwIfAborted();
      if (jpeg?.type === "image/jpeg" && jpeg.size > 0 && jpeg.size <= JPEG_LIMIT) {
        const encoded = await jpeg.arrayBuffer();
        const view = new DataView(encoded);
        signal.throwIfAborted();
        if (view.getUint16(0) === 0xffd8) {
          const size = jpegDimensions(view);
          if (size.width === canvas.width && size.height === canvas.height) {
            return stripJpegMetadata(encoded);
          }
        }
      }
    }
    throw new Error("This photo is too detailed to upload. Choose a smaller one.");
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
