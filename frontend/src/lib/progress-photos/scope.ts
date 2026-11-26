import type { NhostClient } from "@nhost/nhost-js";
import { createAPIClient } from "@nhost/nhost-js/auth";
import { refreshSession, SessionStorage } from "@nhost/nhost-js/session";

async function waitForRefresh(refresh: Promise<unknown>, signal: AbortSignal) {
  let abort: (() => void) | undefined;
  try {
    await Promise.race([
      refresh,
      new Promise<never>((_, reject) => {
        signal.throwIfAborted();
        abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    if (abort) {
      signal.removeEventListener("abort", abort);
    }
  }
}

export class PhotoScope {
  readonly #controller = new AbortController();
  readonly #urls = new Set<string>();
  readonly #imageWaiters = new Set<() => void>();
  #imagesInFlight = 0;

  constructor(
    readonly client: NhostClient,
    readonly owner: string,
    private readonly onClose: () => void,
    private readonly keepWhileHidden = false,
  ) {}

  get signal() {
    return this.#controller.signal;
  }

  get active() {
    return (
      !this.signal.aborted &&
      typeof document !== "undefined" &&
      (this.keepWhileHidden || !document.hidden) &&
      this.client.getUserSession()?.user?.id === this.owner
    );
  }

  assertActive(signal = this.signal) {
    signal.throwIfAborted();
    if (!this.active) {
      this.close();
      this.signal.throwIfAborted();
    }
  }

  close() {
    if (this.signal.aborted) {
      return;
    }
    this.#controller.abort();
    for (const url of this.#urls) {
      URL.revokeObjectURL(url);
    }
    this.#urls.clear();
    this.onClose();
  }

  objectURL(blob: Blob) {
    this.assertActive();
    const url = URL.createObjectURL(blob);
    this.#urls.add(url);
    return url;
  }

  releaseURL(url: string) {
    if (this.#urls.delete(url)) {
      URL.revokeObjectURL(url);
    }
  }

  async withImageSlot<T>(signal: AbortSignal, load: () => Promise<T>): Promise<T> {
    while (this.#imagesInFlight >= 3) {
      // biome-ignore lint/performance/noAwaitInLoops: wait until a concurrency slot is free.
      await this.waitForSlot(signal);
    }
    this.assertActive(signal);
    this.#imagesInFlight++;
    try {
      return await load();
    } finally {
      this.#imagesInFlight--;
      for (const finish of this.#imageWaiters) {
        finish();
      }
    }
  }

  private waitForSlot(signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      signal.throwIfAborted();
      const finish = () => {
        this.#imageWaiters.delete(finish);
        signal.removeEventListener("abort", abort);
        resolve();
      };
      const abort = () => {
        this.#imageWaiters.delete(finish);
        reject(signal.reason);
      };
      this.#imageWaiters.add(finish);
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  async accessToken(signal: AbortSignal) {
    this.assertActive(signal);
    const { client } = this;
    const current = client.getUserSession();
    if (current?.user?.id !== this.owner) {
      throw new Error("A current sign-in is required.");
    }
    if (current.accessToken && (current.decodedToken?.exp ?? 0) - Date.now() > 60_000) {
      return current.accessToken;
    }
    // Pin the credential across lock waits and SDK retries. A new sign-in (even
    // for the same owner) or a concurrent rotation is not ours to rotate or clear.
    const sameCredential = () => {
      const raw = client.getUserSession();
      return raw?.user?.id === this.owner &&
        raw.refreshTokenId === current.refreshTokenId &&
        raw.refreshToken === current.refreshToken
        ? raw
        : null;
    };
    const auth = createAPIClient(client.auth.baseURL);
    let issued = false;
    const guardedStorage = new SessionStorage({
      get: () => (issued || (this.active && !signal.aborted) ? sameCredential() : null),
      set: (next) => {
        if (issued && next.user?.id === this.owner && sameCredential()) {
          client.sessionStorage.set(next);
        }
      },
      remove: () => {
        if (issued && sameCredential()) {
          client.clearSession();
        }
      },
    });
    // Auth rotates refresh tokens. Once issued, finish the SDK refresh even if
    // the photo caller leaves; only its wait and subsequent photo work are cancellable.
    const refresh = refreshSession(
      {
        ...auth,
        refreshToken: (body) => {
          issued = true;
          return auth.refreshToken(body, {
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
          });
        },
      },
      guardedStorage,
    );
    await waitForRefresh(refresh, signal);
    this.assertActive(signal);
    const token = client.getUserSession();
    if (!token?.accessToken || (token.decodedToken?.exp ?? 0) <= Date.now()) {
      throw new Error("A current sign-in is required.");
    }
    return token.accessToken;
  }
}
