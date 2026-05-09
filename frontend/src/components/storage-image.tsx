import { ImageOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fileUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface StorageImageProps {
  fileId: string | null | undefined;
  alt: string;
  className?: string | undefined;
}

export function StorageImage({ fileId, alt, className }: StorageImageProps) {
  if (!fileId) {
    return <Fallback className={className} />;
  }
  return <StorageImageInner key={fileId} fileId={fileId} alt={alt} className={className} />;
}

function StorageImageInner({
  fileId,
  alt,
  className,
}: {
  fileId: string;
  alt: string;
  className?: string | undefined;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <Fallback className={className} />;
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

interface AlternatingStorageImageProps {
  fileIds: (string | null | undefined)[];
  alt: string;
  className?: string | undefined;
  intervalMs?: number;
}

export function AlternatingStorageImage({
  fileIds,
  alt,
  className,
  intervalMs = 2000,
}: AlternatingStorageImageProps) {
  const ids = useMemo(() => fileIds.filter((id): id is string => !!id), [fileIds]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [settledIds, setSettledIds] = useState<ReadonlySet<string>>(() => new Set());

  const allSettled = ids.every((id) => settledIds.has(id));

  useEffect(() => {
    if (ids.length < 2 || !allSettled) {
      return;
    }
    const handle = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ids.length);
    }, intervalMs);
    return () => {
      clearInterval(handle);
    };
  }, [ids.length, intervalMs, allSettled]);

  if (ids.length === 0) {
    return <Fallback className={className} />;
  }

  if (ids.length === 1) {
    return <StorageImage fileId={ids[0]} alt={alt} className={className} />;
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

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {ids.map((id, i) => (
        <img
          key={id}
          src={fileUrl(id)}
          alt={alt}
          onLoad={() => handleSettle(id)}
          onError={() => handleSettle(id)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            i === activeIndex ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}
