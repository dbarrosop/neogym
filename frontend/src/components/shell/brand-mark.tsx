import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <Dumbbell className="size-4" />
    </span>
  );
}
