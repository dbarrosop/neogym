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

const requestSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(60),
  email: z.string().email("Enter a valid email address"),
});

type RequestValues = z.infer<typeof requestSchema>;

export const Route = createFileRoute("/signup")({
  component: SignUpRoute,
});

function SignUpRoute() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { displayName: "", email: "" },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/profile" });
    }
  }, [isAuthenticated, navigate]);

  async function onRequestCode(values: RequestValues) {
    try {
      await nhost.auth.signUpOTPEmail({
        email: values.email,
        options: { displayName: values.displayName },
      });
      setSentTo(values.email);
    } catch (err) {
      toast.error("Sign up failed", {
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
        toast.error("Verification failed", {
          description: "We couldn't verify that code. Try again.",
        });
        setOtp("");
      }
    } catch (err) {
      toast.error("Verification failed", {
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
        description={`We sent a 6-digit code to ${sentTo}.`}
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
      title="Create your account"
      description="We'll email you a one-time code — no password needed."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Form {...requestForm}>
        <form onSubmit={requestForm.handleSubmit(onRequestCode)} className="space-y-4">
          <FormField
            control={requestForm.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Alex Rivera" {...field} />
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
          <Button type="submit" className="w-full" disabled={requestForm.formState.isSubmitting}>
            {requestForm.formState.isSubmitting ? (
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
