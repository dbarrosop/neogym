import { ImageOff } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { fileUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface StorageImageProps {
  fileId: string | null | undefined;
  alt: string;
  className?: string | undefined;
  /** Rendered instead of the default broken-image glyph when there is no file or it fails. */
  fallback?: ReactNode;
}

export function StorageImage({ fileId, alt, className, fallback }: StorageImageProps) {
  if (!fileId) {
    return fallback ?? <Fallback className={className} />;
  }
  return (
    <StorageImageInner
      key={fileId}
      fileId={fileId}
      alt={alt}
      className={className}
      fallback={fallback}
    />
  );
}

function StorageImageInner({
  fileId,
  alt,
  className,
  fallback,
}: {
  fileId: string;
  alt: string;
  className?: string | undefined;
  fallback?: ReactNode;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return fallback ?? <Fallback className={className} />;
  }

  return (
    <img
      src={fileUrl(fileId)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}

function Fallback({ className }: { className?: string | undefined }) {
  return (
    <div className={cn("flex items-center justify-center text-muted-foreground", className)}>
      <ImageOff className="h-6 w-6" />
    </div>
  );
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** True when the viewer asked the OS for reduced motion; false during SSR. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
}

/**
 * Preset frames from the boards: `session` is the 133 px media tile beside the
 * session Recent panel (its 200 px width comes from the caller's grid), `hero`
 * the 236 px exercise-detail image. Both use radius 12 on the page background.
 */
const FRAME_CLASS = {
  session: "h-[133px] w-full rounded-[12px] bg-background",
  hero: "h-[236px] w-full rounded-[12px] bg-background",
} as const;

const DOT_CLASS = {
  session: "size-[5px]",
  hero: "size-1.5",
} as const;

export type AlternatingImageFrame = keyof typeof FRAME_CLASS;

interface AlternatingStorageImageProps {
  fileIds: (string | null | undefined)[];
  alt: string;
  className?: string | undefined;
  intervalMs?: number;
  /**
   * Pager dots over the bottom edge. With dots the viewer can also switch
   * images by tapping the image or a dot; switching manually stops the
   * automatic alternation. Do not enable inside a link or button.
   */
  pager?: boolean;
  /** A fixed frame from the boards; `className` still applies on top. */
  frame?: AlternatingImageFrame;
}

/**
 * Alternates an exercise's start/end photos. Auto-advances only after every
 * image settled and never when the viewer prefers reduced motion; with
 * `pager`, the dots and a tap on the image switch manually.
 */
export function AlternatingStorageImage({
  fileIds,
  alt,
  className,
  intervalMs = 2000,
  pager = false,
  frame,
}: AlternatingStorageImageProps) {
  const ids = useMemo(() => fileIds.filter((id): id is string => !!id), [fileIds]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [manual, setManual] = useState(false);
  const [settledIds, setSettledIds] = useState<ReadonlySet<string>>(() => new Set());
  const reducedMotion = usePrefersReducedMotion();
  const frameClass = frame ? FRAME_CLASS[frame] : undefined;

  const allSettled = ids.every((id) => settledIds.has(id));
  const autoAdvance = ids.length > 1 && allSettled && !reducedMotion && !manual;

  useEffect(() => {
    if (!autoAdvance) {
      return;
    }
    const handle = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ids.length);
    }, intervalMs);
    return () => {
      clearInterval(handle);
    };
  }, [autoAdvance, ids.length, intervalMs]);

  if (ids.length === 0) {
    return <Fallback className={cn(frameClass, className)} />;
  }

  if (ids.length === 1) {
    return (
      <StorageImage
        fileId={ids[0]}
        alt={alt}
        className={cn(frameClass, frameClass && "object-cover", className)}
      />
    );
  }

  const handleSettle = (id: string) => {
    setSettledIds((prev) => {
      if (prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const current = activeIndex % ids.length;
  const show = (index: number) => {
    setManual(true);
    setActiveIndex(index);
  };

  return (
    <div className={cn("relative overflow-hidden", frameClass, className)}>
      {ids.map((id, i) => (
        <img
          key={id}
          src={fileUrl(id)}
          alt={i === current ? alt : ""}
          aria-hidden={i === current ? undefined : true}
          loading="lazy"
          onLoad={() => handleSettle(id)}
          onError={() => handleSettle(id)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
            i === current ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      {pager ? (
        <>
          {/* Pointer convenience; the dots below are the keyboard path. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 cursor-pointer"
            onClick={() => show((current + 1) % ids.length)}
          />
          <div className="absolute inset-x-0 bottom-0.5 flex justify-center">
            {ids.map((id, i) => (
              <button
                key={id}
                type="button"
                aria-label={`Show image ${i + 1} of ${ids.length}`}
                aria-pressed={i === current}
                onClick={() => show(i)}
                className="grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "rounded-full shadow-[0_1px_1px_rgb(0_0_0/0.3)]",
                    DOT_CLASS[frame ?? "session"],
                    i === current ? "bg-white" : "bg-white/45",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
