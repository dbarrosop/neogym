import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/lib/theme/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Neutral toasts: every type shares the surface, border and text colours, and
 * only the leading icon carries the status colour (use without `richColors`).
 */
function Toaster({ toastOptions, style, ...props }: ToasterProps) {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
          ...style,
        } as CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn(
            "gap-3 px-3.5 py-3 text-sm shadow-xl shadow-black/30",
            toastOptions?.classNames?.toast,
          ),
          title: cn("font-medium", toastOptions?.classNames?.title),
          description: cn("text-muted-foreground", toastOptions?.classNames?.description),
          success: cn("[&_[data-icon]]:text-positive", toastOptions?.classNames?.success),
          error: cn("[&_[data-icon]]:text-destructive", toastOptions?.classNames?.error),
          warning: cn(
            "[&_[data-icon]]:text-warning-soft-foreground",
            toastOptions?.classNames?.warning,
          ),
          info: cn("[&_[data-icon]]:text-link", toastOptions?.classNames?.info),
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
