import { Image as ImageIcon } from "lucide-react";
import { StorageImage } from "@/components/storage-image";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  36: "size-9 rounded-[10px]",
  48: "size-12 rounded-[12px]",
} as const;

const GLYPH_CLASS = {
  36: "size-4",
  48: "size-5",
} as const;

export interface ExerciseThumbnailProps {
  /** The exercise's first image (`image1FileId`); falls back to a photo glyph. */
  fileId: string | null | undefined;
  /** 48 px (default) for list rows; 36 px for dense rows. */
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

/**
 * The square exercise photo that leads exercise rows (catalog, workout
 * table/editor, Add exercises, collapsed session cards): the first image
 * cropped to fill, on the page background, radius 12. Decorative: the row's
 * exercise name is its label. Mirrors iOS `ExerciseThumbnail`.
 */
export function ExerciseThumbnail({ fileId, size = 48, className }: ExerciseThumbnailProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-background",
        SIZE_CLASS[size],
        className,
      )}
    >
      <StorageImage
        fileId={fileId}
        alt=""
        className="block h-full w-full object-cover"
        fallback={
          <ImageIcon
            strokeWidth={1.8}
            className={cn("text-tertiary-foreground", GLYPH_CLASS[size])}
          />
        }
      />
    </span>
  );
}
