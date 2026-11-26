import { zodResolver } from "@hookform/resolvers/zod";
import { generatePKCEPair } from "@nhost/nhost-js/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { McpConnectCard } from "@/components/mcp-connect-card";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { Segmented } from "@/components/patterns/segmented";
import { AreaTabs } from "@/components/shell/area-tabs";
import { ThemeSegmented } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/lib/nhost/auth-provider";
import { PKCE_VERIFIER_STORAGE_KEY } from "@/lib/nhost/pkce";
import { formatRestPreset, REST_PRESETS, useRestTimer } from "@/lib/rest-timer";

const changeEmailSchema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
});

type ChangeEmailValues = z.infer<typeof changeEmailSchema>;

export const Route = createFileRoute("/_authed/me/account")({
  component: ProfileRoute,
});

function ProfileRoute() {
  const { user, session, nhost } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    if (session?.refreshToken) {
      try {
        await nhost.auth.signOut({ refreshToken: session.refreshToken });
      } catch {
        // ignore — the local session is cleared regardless
      }
    }
    navigate({ to: "/" });
  }

  if (!user) {
    return null;
  }

  // One initial, as in the sidebar account row.
  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  return (
    <PageShell maxWidth="3xl">
      <PageHeader title="Me" tabs={<AreaTabs area="me" />} />
      <section
        aria-label="Profile"
        className="flex items-center gap-3.5 rounded-xl border bg-card px-5 py-4"
      >
        {/* No AvatarImage: Auth's default Gravatar URL (d=blank) loads a transparent image that would hide the initial. */}
        <span
          aria-hidden="true"
          className="grid size-13 shrink-0 place-items-center rounded-full bg-accent-soft text-[22px] font-bold text-accent-soft-foreground"
        >
          {initial}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-lg font-bold">{user.displayName || "Athlete"}</h2>
          <p className="truncate text-[13px] text-muted-foreground">
            {user.email} · signs in with an email code
          </p>
        </div>
      </section>

      <SettingsGroup title="Account">
        <SettingsRow label="Email">
          <span className="truncate">{user.email}</span>
          <ChangeEmailDialog currentEmail={user.email} />
        </SettingsRow>
        <SettingsRow label="Member since">
          {new Date(user.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </SettingsRow>
        <SettingsRow label="Language">{user.locale ?? "—"}</SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsRow label="Appearance">
          <ThemeSegmented />
        </SettingsRow>
        <SettingsRow label="Rest timer" hint="Starts after each logged set">
          <RestDefaultSegmented />
        </SettingsRow>
      </SettingsGroup>

      <McpConnectCard />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          onClick={handleSignOut}
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut />
          Sign out
        </Button>
        <p className="text-[12px] text-muted-foreground tabular-nums">
          User ID <span title={user.id}>{shortUserId(user.id)}</span>
        </p>
      </div>
    </PageShell>
  );
}

/** "6f1c…a92e": the first and last four characters of the user ID. */
function shortUserId(id: string) {
  return id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function RestDefaultSegmented() {
  const { defaultSeconds, setDefaultSeconds } = useRestTimer();
  return (
    <Segmented
      label="Default rest"
      options={REST_PRESETS.map((seconds) => ({
        value: seconds,
        label: formatRestPreset(seconds),
      }))}
      value={defaultSeconds}
      onChange={setDefaultSeconds}
    />
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`settings-${title}`} className="flex flex-col gap-2">
      <h2 id={`settings-${title}`} className="text-[13px] font-semibold text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y rounded-xl border bg-card">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {children}
      </div>
    </div>
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
        <Button type="button" variant="outline" size="sm">
          Change
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
          <div className="rounded-md border border-border bg-surface-inset px-3 py-2 text-sm">
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
