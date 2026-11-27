import { type Photo, type PhotoFields, readPhoto, readyPhoto, reservePhoto } from "./api";
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
        "Couldn't start the upload. Check your connection, then leave this page and add the photo again.",
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
      return this.stop("Couldn't start the upload. Leave this page and add the photo again.");
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
          message:
            "Couldn't check whether the photo finished uploading. Check your connection and try again.",
        };
      }
      if (!photo || photo.id !== id) {
        return this.stop("This upload can't be finished. Leave this page and add the photo again.");
      }
      if (readyPhoto(photo)) {
        return this.ready(id);
      }
      if (!photo.file) {
        if (Date.now() - this.#startedAt >= 60 * 60 * 1000) {
          return this.stop("This upload expired. Leave this page and add the photo again.");
        }
        if (allowUpload) {
          return this.upload(id);
        }
        return {
          status: "retry",
          message: "The photo didn't finish uploading. Check your connection and try again.",
        };
      }
    }
    return {
      status: "retry",
      message: "The photo is still processing. Try again in a moment.",
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

/** `signal` belongs to the create form: leaving it stops the attempt and its requests. */
export function newPhotoAttempt(fields: PhotoFields, jpeg: Blob, signal: AbortSignal) {
  return new PhotoUploadAttempt(
    {
      reserve: (draft) => reservePhoto(draft, signal),
      upload: (id, blob) => uploadPhoto(id, blob, signal),
      read: (id) => readPhoto(id, signal),
    },
    signal,
    fields,
    jpeg,
  );
}
