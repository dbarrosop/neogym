import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFileBlob } from "@/lib/storage";
import { cn } from "@/lib/utils";

function useFileObjectUrl(fileId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["storage", "file", fileId],
    queryFn: () => fetchFileBlob(fileId as string),
    enabled: !!fileId,
    staleTime: 1000 * 60 * 60,
  });

  const url = useMemo(() => (query.data ? URL.createObjectURL(query.data) : null), [query.data]);

  useEffect(() => {
    if (!url) {
      return;
    }
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return { url, isLoading: query.isLoading, isError: query.isError };
}

interface StorageImageProps {
  fileId: string | null | undefined;
  alt: string;
  className?: string | undefined;
}

export function StorageImage({ fileId, alt, className }: StorageImageProps) {
  const { url, isLoading, isError } = useFileObjectUrl(fileId);

  if (!fileId || isError) {
    return (
      <div className={cn("flex items-center justify-center text-muted-foreground", className)}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  if (isLoading || !url) {
    return <Skeleton className={className} />;
  }

  return <img src={url} alt={alt} className={className} />;
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
    return (
      <div className={cn("flex items-center justify-center text-muted-foreground", className)}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  if (ids.length === 1) {
    return <StorageImage fileId={ids[0]} alt={alt} className={className} />;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {ids.map((id, i) => (
        <Frame key={id} fileId={id} alt={alt} active={i === activeIndex} />
      ))}
    </div>
  );
}

interface FrameProps {
  fileId: string;
  alt: string;
  active: boolean;
}

function Frame({ fileId, alt, active }: FrameProps) {
  const { url } = useFileObjectUrl(fileId);
  if (!url) {
    return null;
  }
  return (
    <img
      src={url}
      alt={alt}
      className={cn("absolute inset-0 h-full w-full object-cover", active ? "block" : "hidden")}
    />
  );
}
