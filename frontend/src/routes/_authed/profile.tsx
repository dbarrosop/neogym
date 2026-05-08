import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/nhost/auth-provider";

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
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Pending verification
                </span>
              )}
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium text-foreground">{children}</span>
    </div>
  );
}
