import { Heart } from "lucide-react";

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
 * Source tag for rows imported on iPhone. The web can show them but never
 * triggers an import itself.
 */
export function HealthSourceTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-px text-[11px] font-medium whitespace-nowrap text-muted-foreground">
      <Heart className="size-3 fill-current text-destructive" aria-hidden="true" />
      Apple Health
    </span>
  );
}
