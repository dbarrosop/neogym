import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthCard({ title, description, footer, children }: AuthCardProps) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? (
          <div className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
