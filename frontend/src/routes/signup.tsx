import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const requestSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(60),
  email: z.string().email("Enter a valid email address"),
});

type RequestValues = z.infer<typeof requestSchema>;

export const Route = createFileRoute("/signup")({
  component: SignUpRoute,
});

const signInPrompt = (
  <>
    Already have an account? <AuthFooterLink to="/signin">Sign in</AuthFooterLink>
  </>
);

function errorDescription(err: unknown) {
  return err instanceof Error ? err.message : "Unexpected error";
}

function SignUpRoute() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [sentTo, setSentTo] = useState<RequestValues | null>(null);
  const focusEmailRef = useRef(false);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { displayName: "", email: "" },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  // "Change" returns to the form with both fields still filled in.
  useEffect(() => {
    if (sentTo === null && focusEmailRef.current) {
      focusEmailRef.current = false;
      requestForm.setFocus("email");
    }
  }, [sentTo, requestForm]);

  async function onRequestCode(values: RequestValues) {
    try {
      await nhost.auth.signUpOTPEmail({
        email: values.email,
        options: { displayName: values.displayName },
      });
      setSentTo(values);
    } catch (err) {
      toast.error("Sign up failed", { description: errorDescription(err) });
    }
  }

  async function verifyCode(code: string) {
    if (!sentTo) {
      return false;
    }
    try {
      const response = await nhost.auth.verifySignInOTPEmail({ email: sentTo.email, otp: code });
      if (response.body?.session) {
        navigate({ to: "/" });
        return true;
      }
      toast.error("Verification failed", {
        description: "We couldn't verify that code. Try again.",
      });
    } catch (err) {
      toast.error("Verification failed", { description: errorDescription(err) });
    }
    return false;
  }

  // Auth's sign-up endpoint answers OK without emailing anyone once the address
  // has an account, and the first request already created this (unverified)
  // one, so a resend goes through the sign-in endpoint, which emails a fresh
  // code to existing accounts, verified or not.
  async function resendCode() {
    if (!sentTo) {
      return false;
    }
    try {
      await nhost.auth.signInOTPEmail({
        email: sentTo.email,
        options: { displayName: sentTo.displayName },
      });
      toast.success("Code sent", {
        description: "Check your email for a new 6-digit code.",
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
        title="Create your account"
        description="Enter the 6-digit code we sent to your email."
        footer={signInPrompt}
      >
        <OtpCodeStep
          email={sentTo.email}
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
      title="Create your account"
      description="We’ll email you a one-time code — no password needed."
      footer={signInPrompt}
    >
      <Form {...requestForm}>
        <form onSubmit={requestForm.handleSubmit(onRequestCode)} className="flex flex-col gap-4">
          <FormField
            control={requestForm.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input
                    className={AUTH_INPUT_CLASS}
                    autoComplete="name"
                    placeholder="Alex Rivera"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={requestForm.control}
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
            disabled={requestForm.formState.isSubmitting}
          >
            {requestForm.formState.isSubmitting ? (
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
