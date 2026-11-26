import { Heart } from "lucide-react";
import { Tag } from "@/components/patterns/tag";

/** The note the iPhone and watch apps write on rows they import from Apple Health. */
export const HEALTH_IMPORT_NOTE = "Imported from Apple Health";

export function isHealthImport(notes: string | null | undefined): boolean {
  return notes?.trim() === HEALTH_IMPORT_NOTE;
}

/** Notes worth showing: the import marker is shown as a tag instead. */
export function visibleNotes(notes: string | null | undefined): string {
  return isHealthImport(notes) ? "" : (notes ?? "");
}

/**
 * Source tag for rows imported on iPhone (Body) or Apple Watch (Energy): the
 * neutral 22 px tag with a red heart. The web can show these rows but never
 * triggers an import itself.
 */
export function HealthSourceTag({ className }: { className?: string }) {
  return (
    <Tag className={className}>
      <Heart className="fill-current text-destructive" aria-hidden="true" />
      Apple Health
    </Tag>
  );
}
