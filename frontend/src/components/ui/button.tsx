import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    // A label in [data-slot=action-label] (patterns/page-shell `ActionLabel`) is screen-reader
    // only below 768 px, where the button becomes a 44 px icon button.
    "max-md:has-[>[data-slot=action-label]]:size-11 max-md:has-[>[data-slot=action-label]]:px-0",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive-fill text-white hover:bg-destructive-fill/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        /** Destructive text on the surface with a tinted red border (delete cards, Sign out). */
        "destructive-outline":
          "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline: "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-3.5 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 text-[13px] has-[>svg]:px-2.5",
        lg: "h-11 px-5 text-[15px] has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
