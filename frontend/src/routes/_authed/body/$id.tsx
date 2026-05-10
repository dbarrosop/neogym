import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { formatDateLong } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

const BodyMeasurementByIdQuery = graphql(`
  query BodyMeasurementById($id: uuid!) {
    bodyMeasurement(id: $id) {
      id
      measuredOn
      weightKg
      bodyFatPct
      notes
      updatedAt
    }
  }
`);

export const Route = createFileRoute("/_authed/body/$id")({
  component: BodyMeasurementDetailRoute,
});

function BodyMeasurementDetailRoute() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["body_measurements", id],
    queryFn: () => gqlRequest(BodyMeasurementByIdQuery, { id }),
  });

  function renderContent() {
    if (isLoading) {
      return <DetailSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data?.bodyMeasurement) {
      return <p className="text-sm text-muted-foreground">Measurement not found.</p>;
    }
    const m = data.bodyMeasurement;
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Measurement
              </p>
              <CardTitle className="text-2xl tabular-nums tracking-tight">
                {formatDateLong(m.measuredOn)}
              </CardTitle>
            </div>
            <Button asChild size="icon" variant="ghost" aria-label="Edit measurement">
              <Link to="/body/$id/edit" params={{ id: m.id }}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3">
            <Stat
              label="Weight"
              value={
                m.weightKg !== null && m.weightKg !== undefined
                  ? `${Number(m.weightKg).toFixed(2)} kg`
                  : "—"
              }
            />
            <Stat
              label="Body fat"
              value={
                m.bodyFatPct !== null && m.bodyFatPct !== undefined
                  ? `${Number(m.bodyFatPct).toFixed(1)} %`
                  : "—"
              }
            />
          </dl>
          {m.notes ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Notes
              </p>
              <p className="whitespace-pre-wrap text-sm">{m.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">{renderContent()}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 rounded-md border border-border/40 bg-muted/30 p-3">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</dt>
      <dd className="text-xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}
