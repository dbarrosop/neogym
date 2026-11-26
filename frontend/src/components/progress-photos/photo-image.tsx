import { useEffect, useRef, useState } from "react";
import { loadPhotoBytes } from "@/lib/progress-photos/storage";
import { cn } from "@/lib/utils";
import { usePhotoScope } from "./photo-boundary";

export function PhotoImage({
  id,
  thumbnail = false,
  alt,
}: {
  id: string;
  thumbnail?: boolean;
  alt: string;
}) {
  const scope = usePhotoScope();
  const target = useRef<HTMLDivElement>(null);
  const [url, setURL] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry starts a new request.
  useEffect(() => {
    // Each explicit retry owns a new request and URL.
    const controller = new AbortController();
    let created: string | undefined;
    const load = async () => {
      try {
        const blob = await loadPhotoBytes(scope, id, thumbnail, controller.signal);
        scope.assertActive(controller.signal);
        created = scope.objectURL(blob);
        setURL(created);
      } catch {
        if (scope.active && !controller.signal.aborted) {
          setFailed(true);
        }
      }
    };
    let observer: IntersectionObserver | undefined;
    if (thumbnail && target.current && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            void load();
          }
        },
        { rootMargin: "100px" },
      );
      observer.observe(target.current);
    } else {
      void load();
    }
    return () => {
      observer?.disconnect();
      controller.abort();
      if (created) {
        scope.releaseURL(created);
      }
    };
  }, [scope, id, thumbnail, retry]);

  return (
    <div
      ref={target}
      className={cn(
        "grid place-items-center overflow-hidden bg-surface-inset",
        thumbnail ? "aspect-[4/5]" : "min-h-48 rounded-xl border",
      )}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          draggable={false}
          decoding="async"
          className={
            thumbnail ? "h-full w-full object-cover" : "max-h-[75dvh] w-full object-contain"
          }
          onError={() => {
            scope.releaseURL(url);
            setURL(undefined);
            setFailed(true);
          }}
        />
      ) : (
        <div className="space-y-2 px-2 text-center text-sm text-muted-foreground">
          {failed ? <p>Image unavailable</p> : <p>{thumbnail ? "Preview" : "Loading image…"}</p>}
          {failed && !thumbnail ? (
            <button
              type="button"
              className="min-h-11 px-3 text-link underline"
              onClick={() => {
                setFailed(false);
                setRetry((value) => value + 1);
              }}
            >
              Retry image
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function PhotoPreview({ jpeg }: { jpeg: Blob }) {
  const scope = usePhotoScope();
  const [url, setURL] = useState<string>();
  useEffect(() => {
    if (!scope.active) {
      return;
    }
    const created = scope.objectURL(jpeg);
    setURL(created);
    return () => scope.releaseURL(created);
  }, [scope, jpeg]);
  return url ? (
    <img
      src={url}
      alt="Preview for upload"
      draggable={false}
      className="max-h-64 rounded-lg object-contain group-data-[photo-concealed]/photo-route:invisible"
    />
  ) : null;
}
