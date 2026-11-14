import { Loader2 } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Delete Lower A?" */
  title: ReactNode;
  /** Consequences; end with "This can't be undone." when true. */
  description?: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  isPending: boolean;
  cancelLabel?: ReactNode;
  pendingLabel?: ReactNode;
  /** Filled red confirm button (deletes, removals); otherwise the primary fill. */
  destructive?: boolean;
}

/**
 * Confirmation alert dialog (Web · Dialogs): no close button and no dismissal
 * by clicking outside, focus starts on Cancel, Escape still cancels.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
  cancelLabel = "Cancel",
  pendingLabel = "Working…",
  destructive = false,
}: ConfirmActionDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="alertdialog"
        showClose={false}
        className="max-w-[420px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
