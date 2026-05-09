import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
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
  const ids = fileIds.filter((id): id is string => !!id);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (ids.length < 2) {
      return;
    }
    const handle = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ids.length);
    }, intervalMs);
    return () => {
      clearInterval(handle);
    };
  }, [ids.length, intervalMs]);

  if (ids.length === 0) {
    return <Fallback className={className} />;
  }

  if (ids.length === 1) {
    return <StorageImage fileId={ids[0]} alt={alt} className={className} />;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {ids.map((id, i) => (
        <img
          key={id}
          src={fileUrl(id)}
          alt={alt}
          loading="lazy"
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            i === activeIndex ? "block" : "hidden",
          )}
        />
      ))}
    </div>
  );
}
