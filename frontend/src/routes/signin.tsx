import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  AUTH_INPUT_CLASS,
  AUTH_SUBMIT_CLASS,
  AuthCard,
  AuthFooterLink,
} from "@/components/auth-card";
import { OtpCodeStep } from "@/components/otp-code-step";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/nhost/auth-provider";
import { isSafeInternalRedirect } from "@/lib/redirect";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const searchSchema = z.object({
  redirect: z.string().optional(),
});

type EmailValues = z.infer<typeof emailSchema>;

export const Route = createFileRoute("/signin")({
  validateSearch: searchSchema,
  component: SignInRoute,
});

const signUpPrompt = (
  <>
    New to NeoGym? <AuthFooterLink to="/signup">Create an account</AuthFooterLink>
  </>
);

function errorDescription(err: unknown) {
  return err instanceof Error ? err.message : "Unexpected error";
}

function SignInRoute() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const leftRef = useRef(false);
  const focusEmailRef = useRef(false);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  // Signed in (by the code below, or already): continue to a safe internal
  // redirect such as the OAuth consent page, else home (which opens Today).
  const leave = useCallback(() => {
    if (leftRef.current) {
      return;
    }
    leftRef.current = true;
    if (redirect && isSafeInternalRedirect(redirect)) {
      window.location.assign(redirect);
      return;
    }
    navigate({ to: "/" });
  }, [navigate, redirect]);

  useEffect(() => {
    if (isAuthenticated) {
      leave();
    }
  }, [isAuthenticated, leave]);

  // "Change" returns to the email step with the address still filled in.
  useEffect(() => {
    if (sentTo === null && focusEmailRef.current) {
      focusEmailRef.current = false;
      emailForm.setFocus("email");
    }
  }, [sentTo, emailForm]);

  async function onRequestCode(values: EmailValues) {
    try {
      await nhost.auth.signInOTPEmail({ email: values.email });
      setSentTo(values.email);
    } catch (err) {
      toast.error("Couldn't send code", { description: errorDescription(err) });
    }
  }

  async function verifyCode(code: string) {
    if (!sentTo) {
      return false;
    }
    try {
      const response = await nhost.auth.verifySignInOTPEmail({ email: sentTo, otp: code });
      if (response.body?.session) {
        leave();
        return true;
      }
      toast.error("Sign in failed", {
        description: "We couldn't verify that code. Try again.",
      });
    } catch (err) {
      toast.error("Sign in failed", { description: errorDescription(err) });
    }
    return false;
  }

  async function resendCode() {
    if (!sentTo) {
      return false;
    }
    try {
      await nhost.auth.signInOTPEmail({ email: sentTo });
      // Same wording whether or not the account exists.
      toast.success("Code requested", {
        description: "If an account exists for this email, a new code is on its way.",
      });
      return true;
    } catch (err) {
      toast.error("Couldn't send code", { description: errorDescription(err) });
      return false;
    }
  }

  if (sentTo) {
    return (
      <AuthCard
        title="Sign in"
        description="If an account exists for this email, we sent it a 6-digit code."
        footer={signUpPrompt}
      >
        <OtpCodeStep
          email={sentTo}
          onChangeEmail={() => {
            focusEmailRef.current = true;
            setSentTo(null);
          }}
          onVerify={verifyCode}
          onResend={resendCode}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Enter your email and we’ll send you a one-time code."
      footer={signUpPrompt}
    >
      <Form {...emailForm}>
        <form onSubmit={emailForm.handleSubmit(onRequestCode)} className="flex flex-col gap-4">
          <FormField
            control={emailForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    className={AUTH_INPUT_CLASS}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className={AUTH_SUBMIT_CLASS}
            disabled={emailForm.formState.isSubmitting}
          >
            {emailForm.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Sending code
              </>
            ) : (
              "Send code"
            )}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
