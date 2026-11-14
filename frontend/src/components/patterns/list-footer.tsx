import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const countFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** "7 of 32 entries"; numbers use the locale's grouping. */
export function listFooterCaption(shown: number, total: number, noun: string): string {
  return `${countFormat.format(Math.min(shown, total))} of ${countFormat.format(total)} ${noun}`;
}

interface ListFooterProps {
  /** Rows currently rendered. */
  shown: number;
  /** All rows available. */
  total: number;
  /** Plural noun after the count, e.g. "entries" or "days". */
  noun: string;
  onLoadMore: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Footer of an entry history (Body, Energy): the "7 of 32 entries" count and
 * a ghost Load more button that disappears once every row is shown.
 */
export function ListFooter({
  shown,
  total,
  noun,
  onLoadMore,
  isLoading = false,
  className,
}: ListFooterProps) {
  return (
    <div
      className={cn(
        "flex min-h-[58px] items-center justify-between gap-3 border-border border-t px-4 py-2.5",
        className,
      )}
    >
      <span className="text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
        {listFooterCaption(shown, total, noun)}
      </span>
      {shown < total ? (
        <Button
          type="button"
          variant="ghost"
          className="max-md:h-11"
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
          Load more
        </Button>
      ) : null}
    </div>
  );
}
