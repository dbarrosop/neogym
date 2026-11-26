import { MoreHorizontal } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

/**
 * A "More actions" button that opens a small menu of row actions (ARIA menu
 * button): Enter, Space or Down opens it on the first item, Up/Down/Home/End
 * move, Escape or Tab closes it, and choosing an item returns focus to the
 * button before running it (so a dialog it opens restores focus there).
 */
export function RowActionsMenu({
  label,
  items,
  disabled = false,
  className,
  buttonClassName,
}: {
  /** Accessible name of the button, e.g. "More actions for Banana". */
  label: string;
  items: RowMenuItem[];
  disabled?: boolean;
  className?: string;
  /** Extra classes for the trigger, e.g. `size-11` for a 44 px touch target. */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    menuItems(menuRef.current)[0]?.focus();
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function close(focusButton: boolean) {
    setOpen(false);
    if (focusButton) {
      buttonRef.current?.focus();
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = menuItems(menuRef.current);
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => enabled.at(next % enabled.length)?.focus();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "grid size-9 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          buttonClassName,
        )}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="absolute top-full right-0 z-30 mt-1 flex min-w-52 flex-col rounded-[10px] border bg-popover p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
              className={cn(
                "flex min-h-11 items-center rounded-[7px] px-3 text-left text-sm transition-[background-color,color] hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-link disabled:pointer-events-none disabled:opacity-50",
                item.destructive && "text-destructive",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function menuItems(menu: HTMLElement | null): HTMLButtonElement[] {
  return [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
}
