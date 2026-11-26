import { type Photo, type PhotoFields, readPhoto, readyPhoto, reservePhoto } from "./api";
import type { PhotoScope } from "./scope";
import { uploadPhoto } from "./storage";

export type UploadResult =
  | { status: "ready"; id: string }
  | { status: "retry"; message: string }
  | { status: "stopped"; message: string };

type Protocol = {
  reserve: (fields: PhotoFields) => Promise<string>;
  upload: (id: string, jpeg: Blob) => Promise<boolean>;
  read: (id: string) => Promise<Photo | null | undefined>;
};

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** One immutable submission. Only the original reservation may ever be retried. */
export class PhotoUploadAttempt {
  #id: string | undefined;
  #started = false;
  #busy = false;
  #finished: Exclude<UploadResult, { status: "retry" }> | undefined;
  readonly #startedAt = Date.now();

  constructor(
    private readonly protocol: Protocol,
    private readonly signal: AbortSignal,
    private readonly fields: PhotoFields,
    private readonly jpeg: Blob,
    private readonly delays = [300, 750, 1500],
  ) {}

  async run(): Promise<UploadResult> {
    this.signal.throwIfAborted();
    if (this.#busy) {
      return { status: "retry", message: "An upload check is already running." };
    }
    if (this.#finished) {
      return this.#finished;
    }
    this.#busy = true;
    try {
      if (!this.#started) {
        this.#started = true;
        return await this.reserve();
      }
      return await this.reconcile(true);
    } finally {
      this.#busy = false;
    }
  }

  private async reserve() {
    try {
      this.#id = await this.protocol.reserve(this.fields);
      this.signal.throwIfAborted();
    } catch {
      this.signal.throwIfAborted();
      return this.stop(
        "Couldn't confirm the reservation. No photo was sent. Return to the gallery before starting a new submission.",
      );
    }
    return this.upload(this.#id);
  }

  private async upload(id: string): Promise<UploadResult> {
    try {
      const confirmed = await this.protocol.upload(id, this.jpeg);
      this.signal.throwIfAborted();
      if (confirmed) {
        return this.ready(id);
      }
    } catch {
      this.signal.throwIfAborted();
    }
    return this.reconcile(false);
  }

  private async reconcile(allowUpload: boolean): Promise<UploadResult> {
    const id = this.#id;
    if (!id) {
      return this.stop("No confirmed reservation is available.");
    }
    for (const delay of [0, ...this.delays]) {
      if (delay) {
        // biome-ignore lint/performance/noAwaitInLoops: each probe waits for Storage to progress.
        await wait(delay, this.signal);
      }
      let photo: Photo | null | undefined;
      try {
        photo = await this.protocol.read(id);
        this.signal.throwIfAborted();
      } catch {
        this.signal.throwIfAborted();
        return {
          status: "retry",
          message: "Couldn't check the upload. Check again when your connection is available.",
        };
      }
      if (!photo || photo.id !== id) {
        return this.stop(
          "The reservation is no longer available. Return to the gallery before starting a new submission.",
        );
      }
      if (readyPhoto(photo)) {
        return this.ready(id);
      }
      if (!photo.file) {
        if (Date.now() - this.#startedAt >= 60 * 60 * 1000) {
          return this.stop(
            "The reservation has expired. Return to the gallery before starting a new submission.",
          );
        }
        if (allowUpload) {
          return this.upload(id);
        }
        return {
          status: "retry",
          message: "The upload wasn't confirmed. Check and retry with this reservation.",
        };
      }
    }
    return {
      status: "retry",
      message:
        "Storage is still processing the photo. Check again shortly; don't start another upload for this photo yet.",
    };
  }

  private ready(id: string) {
    this.#finished = { status: "ready", id };
    return this.#finished;
  }

  private stop(message: string) {
    this.#finished = { status: "stopped", message };
    return this.#finished;
  }
}

export function newPhotoAttempt(scope: PhotoScope, fields: PhotoFields, jpeg: Blob) {
  return new PhotoUploadAttempt(
    {
      reserve: (draft) => reservePhoto(scope, draft),
      upload: (id, blob) => uploadPhoto(scope, id, blob),
      read: (id) => readPhoto(scope, id),
    },
    scope.signal,
    fields,
    jpeg,
  );
}
