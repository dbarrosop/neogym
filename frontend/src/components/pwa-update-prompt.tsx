import { useRegisterSW } from "virtual:pwa-register/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const UPDATE_TOAST_ID = "pwa-update";

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error: unknown) {
      console.error("SW registration failed", error);
    },
  });

  useEffect(() => {
    if (!needRefresh) {
      return;
    }

    // The update toast stays until the person reloads or dismisses it.
    const id = toast("A new version of NeoGym is available.", {
      id: UPDATE_TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
      action: (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            className="h-[34px]"
            onClick={() => {
              updateServiceWorker(true);
            }}
          >
            Reload
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            className="text-muted-foreground"
            onClick={() => setNeedRefresh(false)}
          >
            <X />
          </Button>
        </span>
      ),
      onDismiss: () => setNeedRefresh(false),
      onAutoClose: () => setNeedRefresh(false),
    });

    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
