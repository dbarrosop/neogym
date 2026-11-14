import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2, Mail } from "lucide-react";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import { AUTH_SUBMIT_CLASS } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 60;

const SLOT_INDEXES = Array.from({ length: OTP_LENGTH }, (_, index) => index);

/** Whole seconds left until `availableAt`, rounded up so the countdown never shows 0:00 early. */
export function secondsUntil(availableAt: number, now: number): number {
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}

/** `m:ss`, as in "Resend in 0:42". */
export function formatCooldown(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

interface OtpCodeStepProps {
  /** The address the code was requested for, shown in the email chip. */
  email: string;
  /** Back to the email step ("Change"). */
  onChangeEmail: () => void;
  /**
   * Verifies a complete code. Resolve `true` once signed in (the step stays
   * busy while the page navigates away) or `false` to clear the boxes for
   * another try; report errors (toasts) in the page and don't throw.
   */
  onVerify: (code: string) => Promise<boolean>;
  /** Requests a new code. Resolve `true` when it was sent, which restarts the cooldown. */
  onResend: () => Promise<boolean>;
  resendCooldownSeconds?: number;
}

/**
 * The 6-digit code step shared by sign in and sign up: the email chip with
 * Change, the code boxes in a "Verification code" fieldset, a resend link after
 * a cooldown, and Verify. A complete code submits on its own; Verify (or Enter)
 * submits too, and a request already in flight is never sent twice.
 */
export function OtpCodeStep({
  email,
  onChangeEmail,
  onVerify,
  onResend,
  resendCooldownSeconds = RESEND_COOLDOWN_SECONDS,
}: OtpCodeStepProps) {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const legendId = useId();

  async function verify(value: string) {
    if (verifyingRef.current || value.length !== OTP_LENGTH) {
      return;
    }
    verifyingRef.current = true;
    setIsVerifying(true);
    let signedIn = false;
    try {
      signedIn = await onVerify(value);
    } finally {
      if (!signedIn) {
        verifyingRef.current = false;
        setIsVerifying(false);
        setCode("");
      }
    }
  }

  // The input is disabled while a code is checked, which drops focus; give it
  // back after a failed attempt so the next code can be typed straight away.
  useEffect(() => {
    if (!isVerifying) {
      inputRef.current?.focus();
    }
  }, [isVerifying]);

  return (
    <div className="flex flex-col gap-6">
      <EmailChip email={email} onChange={onChangeEmail} disabled={isVerifying} />
      <form
        className="flex flex-col gap-6"
        onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
          event.preventDefault();
          void verify(code);
        }}
      >
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend id={legendId} className="mb-2.5 p-0 font-semibold text-sm">
            Verification code
          </legend>
          <InputOTP
            ref={inputRef}
            maxLength={OTP_LENGTH}
            pattern={REGEXP_ONLY_DIGITS}
            autoFocus
            aria-labelledby={legendId}
            value={code}
            onChange={setCode}
            onComplete={(value: string) => void verify(value)}
            disabled={isVerifying}
            containerClassName="w-full"
          >
            <InputOTPGroup className="w-full justify-between">
              {SLOT_INDEXES.map((index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <ResendCode
            onResend={onResend}
            onSent={() => inputRef.current?.focus()}
            cooldownSeconds={resendCooldownSeconds}
          />
        </fieldset>
        <Button
          type="submit"
          className={AUTH_SUBMIT_CLASS}
          disabled={isVerifying || code.length !== OTP_LENGTH}
        >
          {isVerifying ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Verifying
            </>
          ) : (
            "Verify"
          )}
        </Button>
      </form>
    </div>
  );
}

function EmailChip({
  email,
  onChange,
  disabled,
}: {
  email: string;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex h-[46px] items-center gap-2.5 rounded-[10px] border border-border bg-card pr-1.5 pl-3.5">
      <Mail aria-hidden="true" className="size-[18px] shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-[15px]">
        <span className="sr-only">Email: </span>
        {email}
      </span>
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        aria-label="Change email"
        className="grid h-9 shrink-0 place-items-center rounded-md px-2.5 font-semibold text-link text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      >
        Change
      </button>
    </div>
  );
}

function ResendCode({
  onResend,
  onSent,
  cooldownSeconds,
}: {
  onResend: () => Promise<boolean>;
  /** The Resend button gives way to the countdown, so focus moves back to the code. */
  onSent: () => void;
  cooldownSeconds: number;
}) {
  const [availableAt, setAvailableAt] = useState(() => Date.now() + cooldownSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [isResending, setIsResending] = useState(false);
  const remaining = secondsUntil(availableAt, now);
  const coolingDown = remaining > 0;

  useEffect(() => {
    if (!coolingDown) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  async function resend() {
    if (isResending) {
      return;
    }
    setIsResending(true);
    try {
      if (await onResend()) {
        const sentAt = Date.now();
        setNow(sentAt);
        setAvailableAt(sentAt + cooldownSeconds * 1000);
        onSent();
      }
    } finally {
      setIsResending(false);
    }
  }

  return (
    <p className="text-[13px] text-muted-foreground">
      Didn’t get it?{" "}
      {coolingDown ? (
        <>
          Resend in <span className="tabular-nums">{formatCooldown(remaining)}</span>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={isResending}
          className="rounded-sm font-semibold text-link underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {isResending ? "Sending code…" : "Resend code"}
        </button>
      )}
    </p>
  );
}
