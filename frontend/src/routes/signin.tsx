import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AuthCard } from "@/components/auth-card";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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

function SignInRoute() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (redirect && isSafeInternalRedirect(redirect)) {
      window.location.assign(redirect);
      return;
    }
    navigate({ to: "/profile" });
  }, [isAuthenticated, navigate, redirect]);

  async function onRequestCode(values: EmailValues) {
    try {
      await nhost.auth.signInOTPEmail({ email: values.email });
      setSentTo(values.email);
    } catch (err) {
      toast.error("Couldn't send code", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  }

  async function onVerifyCode(code: string) {
    if (!sentTo) {
      return;
    }
    setIsVerifying(true);
    try {
      const response = await nhost.auth.verifySignInOTPEmail({
        email: sentTo,
        otp: code,
      });
      if (response.body?.session) {
        navigate({ to: "/profile" });
      } else {
        toast.error("Sign in failed", {
          description: "We couldn't verify that code. Try again.",
        });
        setOtp("");
      }
    } catch (err) {
      toast.error("Sign in failed", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard
        title="Enter your code"
        description={`If an account exists for ${sentTo}, you'll receive a 6-digit code shortly.`}
        footer={
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setOtp("");
            }}
            className="font-medium text-foreground hover:underline"
          >
            Use a different email
          </button>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <InputOTP
            maxLength={6}
            autoFocus
            value={otp}
            onChange={setOtp}
            onComplete={onVerifyCode}
            disabled={isVerifying}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          {isVerifying && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying
            </div>
          )}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Enter your email and we'll send you a one-time code."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Form {...emailForm}>
        <form onSubmit={emailForm.handleSubmit(onRequestCode)} className="space-y-4">
          <FormField
            control={emailForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
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
          <Button type="submit" className="w-full" disabled={emailForm.formState.isSubmitting}>
            {emailForm.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
