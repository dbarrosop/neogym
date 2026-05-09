import { zodResolver } from "@hookform/resolvers/zod";
import { generatePKCEPair } from "@nhost/nhost-js/auth";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/nhost/auth-provider";
import { PKCE_VERIFIER_STORAGE_KEY } from "@/lib/nhost/pkce";

const changeEmailSchema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
});

type ChangeEmailValues = z.infer<typeof changeEmailSchema>;

export const Route = createFileRoute("/_authed/profile")({
  component: ProfileRoute,
});

function ProfileRoute() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  const initials = (user.displayName || user.email || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/60 shadow-xl shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <Avatar className="h-16 w-16 border border-border/60">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName ?? user.email} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">
                {user.displayName || "Athlete"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <DetailRow label="Email">
              <span>{user.email}</span>
              <ChangeEmailDialog currentEmail={user.email} />
            </DetailRow>
            <DetailRow label="Locale">{user.locale ?? "—"}</DetailRow>
            <DetailRow label="Default role">{user.defaultRole ?? "—"}</DetailRow>
            <DetailRow label="User ID">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{user.id}</code>
            </DetailRow>
            <DetailRow label="Member since">
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </DetailRow>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ChangeEmailDialog({ currentEmail }: { currentEmail: string | undefined }) {
  const { nhost } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const form = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: "" },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setPendingEmail(null);
    }
  }

  async function onSubmit({ newEmail }: ChangeEmailValues) {
    if (newEmail === currentEmail) {
      form.setError("newEmail", {
        message: "That's already your email address",
      });
      return;
    }
    try {
      const { verifier, challenge } = await generatePKCEPair();
      localStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
      await nhost.auth.changeUserEmail({
        newEmail,
        codeChallenge: challenge,
        options: { redirectTo: `${window.location.origin}/verify` },
      });
      setPendingEmail(newEmail);
      form.reset();
    } catch (err) {
      localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
      toast.error("Couldn't request the change", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Change email"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>
            We'll send a verification link to the new address. Open it on this device to finish the
            swap.
          </DialogDescription>
        </DialogHeader>
        {pendingEmail ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            Verification link sent to{" "}
            <span className="font-medium text-foreground">{pendingEmail}</span>.
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="new@example.com"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending
                    </>
                  ) : (
                    "Send verification"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium text-foreground">{children}</span>
    </div>
  );
}
