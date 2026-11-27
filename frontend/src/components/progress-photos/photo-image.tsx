import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { photoKeys } from "@/lib/progress-photos/api";
import { loadPhotoBytes } from "@/lib/progress-photos/storage";
import { cn } from "@/lib/utils";
import { usePhotoOwner } from "./photo-session";

/** An object URL for `blob`, revoked when the blob changes or the component unmounts. */
export function useObjectURL(blob: Blob | undefined) {
  const [entry, setEntry] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  // Never hand out a URL created for a previous blob (it may already be revoked).
  return entry?.blob === blob ? entry?.url : undefined;
}

/** True once `target` comes within 200 px of the viewport (always true without the API). */
function useNearViewport(target: RefObject<HTMLElement | null>, enabled: boolean) {
  const [near, setNear] = useState(!enabled);
  useEffect(() => {
    const node = target.current;
    if (!enabled || near || !node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setNear(true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [target, enabled, near]);
  return near;
}

const LAYOUT = {
  thumbnail: { box: "aspect-[4/5]", image: "h-full w-full object-cover" },
  viewer: { box: "min-h-48 rounded-xl border", image: "max-h-[75dvh] w-full object-contain" },
  fill: { box: "h-full w-full", image: "h-full w-full object-contain" },
} as const;

/**
 * A private photo read through authenticated Storage. Bytes are cached in memory per
 * owner (`photoKeys.bytes`); thumbnails load only near the viewport. `fill` draws the
 * original contained in its parent's box (the compare slider stacks two).
 */
export function PhotoImage({
  id,
  thumbnail = false,
  fill = false,
  eager = false,
  alt,
}: {
  id: string;
  thumbnail?: boolean;
  fill?: boolean;
  /** Load a thumbnail right away instead of near the viewport (a handful of tiles). */
  eager?: boolean;
  alt: string;
}) {
  let layout: (typeof LAYOUT)[keyof typeof LAYOUT] = LAYOUT.viewer;
  if (thumbnail) {
    layout = LAYOUT.thumbnail;
  } else if (fill) {
    layout = LAYOUT.fill;
  }
  const owner = usePhotoOwner();
  const target = useRef<HTMLDivElement>(null);
  const near = useNearViewport(target, thumbnail && !eager);
  const variant = thumbnail ? "thumbnail" : "full";
  const bytes = useQuery({
    queryKey: photoKeys.bytes(owner, id, variant),
    queryFn: ({ signal }) => loadPhotoBytes(id, variant, signal),
    enabled: near,
    // A photo's file is never replaced; edits only change its date and label.
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const url = useObjectURL(bytes.data);
  const [broken, setBroken] = useState(false);
  const failed = bytes.isError || broken;

  return (
    <div
      ref={target}
      className={cn("grid place-items-center overflow-hidden bg-surface-inset", layout.box)}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          draggable={false}
          decoding="async"
          className={layout.image}
          onError={() => setBroken(true)}
        />
      ) : null}
      {failed ? (
        <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-5" />
          <p>{thumbnail ? "Couldn't load" : "Couldn't load this photo."}</p>
          {thumbnail ? null : (
            <Button
              type="button"
              variant="outline"
              disabled={bytes.isFetching}
              onClick={() => {
                setBroken(false);
                void bytes.refetch();
              }}
            >
              Retry
            </Button>
          )}
        </div>
      ) : null}
      {url || failed ? null : <PhotoPlaceholder thumbnail={thumbnail} fill={fill} />}
    </div>
  );
}

function PhotoPlaceholder({ thumbnail, fill }: { thumbnail: boolean; fill: boolean }) {
  const pulse = "h-full w-full animate-pulse bg-muted motion-reduce:animate-none";
  // Tiles are decorative while loading; a viewer or compare image announces itself.
  return thumbnail ? (
    <div aria-hidden="true" className={pulse} />
  ) : (
    <div
      role="status"
      aria-label="Loading photo"
      className={cn(pulse, fill ? undefined : "min-h-[60dvh]")}
    />
  );
}

export function PhotoPreview({ jpeg }: { jpeg: Blob }) {
  const url = useObjectURL(jpeg);
  return url ? (
    <img
      src={url}
      alt="Preview for upload"
      draggable={false}
      className="max-h-64 rounded-lg object-contain"
    />
  ) : null;
}
