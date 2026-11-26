import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";
import { type ComponentProps, useContext } from "react";
import { cn } from "@/lib/utils";

function InputOTP({ className, containerClassName, ...props }: ComponentProps<typeof OTPInput>) {
  return (
    <OTPInput
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2", className)} {...props} />;
}

/**
 * One digit box: 44×54 px on phones and 52×60 px from 768 px, radius 12, 24 px
 * semibold digits. The active box gets a 2 px accent border (border plus an
 * inset ring, so the digit doesn't shift).
 */
function InputOTPSlot({
  index,
  className,
  ...props
}: ComponentProps<"div"> & { index: number }) {
  const ctx = useContext(OTPInputContext);
  const slot = ctx.slots[index];
  const char = slot?.char;
  const hasFakeCaret = slot?.hasFakeCaret ?? false;
  const isActive = slot?.isActive ?? false;

  return (
    <div
      className={cn(
        "relative flex h-[54px] w-11 min-w-0 items-center justify-center rounded-[12px] border border-input bg-card font-semibold text-2xl text-foreground tabular-nums transition-[border-color,box-shadow] md:h-[60px] md:w-[52px]",
        isActive && "z-10 border-primary ring-1 ring-primary ring-inset",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator(props: ComponentProps<"div">) {
  return (
    <div role="separator" {...props}>
      <Minus className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
