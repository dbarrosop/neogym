import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

    const id = toast("A new version of NeoGym is available.", {
      duration: Number.POSITIVE_INFINITY,
      action: (
        <Button
          size="sm"
          onClick={() => {
            updateServiceWorker(true);
          }}
        >
          Reload
        </Button>
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
