import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Scale, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const BodyMetricsQuery = graphql(`
  query BodyMetrics {
    bodyMetrics(order_by: { measuredOn: asc }) {
      id
      measuredOn
      weightKg
      fatPct
      notes
    }
  }
`);

const InsertBodyMetricMutation = graphql(`
  mutation InsertBodyMetric($object: bodyMetrics_insert_input!) {
    insertBodyMetric(object: $object) {
      id
      measuredOn
      weightKg
      fatPct
      notes
    }
  }
`);

const DeleteBodyMetricMutation = graphql(`
  mutation DeleteBodyMetric($id: uuid!) {
    deleteBodyMetric(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/body/")({
  component: BodyRoute,
});

function BodyRoute() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["body-metrics"],
    queryFn: () => gqlRequest(BodyMetricsQuery),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteBodyMetricMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-metrics"] });
      toast.success("Measurement deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const metrics = data?.bodyMetrics ?? [];

  const chartData = metrics.map((m) => ({
    date: m.measuredOn,
    weight: m.weightKg == null ? null : Number(m.weightKg),
    fat: m.fatPct == null ? null : Number(m.fatPct),
  }));

  const hasWeight = metrics.some((m) => m.weightKg != null);
  const hasFat = metrics.some((m) => m.fatPct != null);

  function renderContent() {
    if (isLoading) {
      return <BodySkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    return (
      <div className="space-y-6">
        {metrics.length > 1 && (
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    }
                  />
                  {hasWeight && (
                    <YAxis
                      yAxisId="weight"
                      orientation="left"
                      tick={{ fontSize: 11 }}
                      domain={["auto", "auto"]}
                      tickFormatter={(v: number) => `${v} kg`}
                      width={56}
                    />
                  )}
                  {hasFat && (
                    <YAxis
                      yAxisId="fat"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      domain={["auto", "auto"]}
                      tickFormatter={(v: number) => `${v}%`}
                      width={44}
                    />
                  )}
                  <Tooltip
                    formatter={(value, name) =>
                      name === "Weight" ? [`${value} kg`, name] : [`${value}%`, name]
                    }
                    labelFormatter={(label) =>
                      typeof label === "string"
                        ? new Date(label).toLocaleDateString(undefined, {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : String(label)
                    }
                  />
                  <Legend />
                  {hasWeight && (
                    <Line
                      yAxisId="weight"
                      type="monotone"
                      dataKey="weight"
                      name="Weight"
                      stroke="hsl(var(--primary))"
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  )}
                  {hasFat && (
                    <Line
                      yAxisId="fat"
                      type="monotone"
                      dataKey="fat"
                      name="Body fat %"
                      stroke="hsl(var(--destructive))"
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {metrics.length === 0 ? (
          <Card className="border-border/60 border-dashed">
            <CardContent className="space-y-3 py-10 text-center">
              <Scale className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No measurements yet.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {[...metrics].reverse().map((m) => (
              <li key={m.id}>
                <Card className="border-border/60 py-0 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                  <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-center">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {new Date(m.measuredOn).toLocaleDateString(undefined, {
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </span>
                        <span className="-mt-0.5 text-base font-semibold leading-none">
                          {new Date(m.measuredOn).toLocaleDateString(undefined, {
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-medium">
                          {m.weightKg == null ? null : `${m.weightKg} kg`}
                          {m.weightKg == null || m.fatPct == null ? null : " · "}
                          {m.fatPct == null ? null : `${m.fatPct}% fat`}
                        </p>
                        {m.notes ? (
                          <p className="truncate text-xs text-muted-foreground">{m.notes}</p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(m.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Progress
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Body</h1>
            <p className="text-sm text-muted-foreground">
              Track your weight and body fat percentage over time.
            </p>
          </div>
          <AddMeasurementDialog />
        </header>
        {renderContent()}
      </div>
    </section>
  );
}

function AddMeasurementDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");

  const insertMutation = useMutation({
    mutationFn: () =>
      gqlRequest(InsertBodyMetricMutation, {
        object: {
          measuredOn: date,
          weightKg: weight === "" ? null : Number.parseFloat(weight),
          fatPct: fat === "" ? null : Number.parseFloat(fat),
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-metrics"] });
      toast.success("Measurement saved");
      setOpen(false);
      setWeight("");
      setFat("");
      setNotes("");
      setDate(new Date().toISOString().slice(0, 10));
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = (weight !== "" || fat !== "") && !insertMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Add measurement</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add measurement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bm-date">Date</Label>
            <Input
              id="bm-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-weight">Weight (kg)</Label>
            <Input
              id="bm-weight"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 75.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-fat">Body fat %</Label>
            <Input
              id="bm-fat"
              type="number"
              min="0"
              max="99"
              step="0.1"
              placeholder="e.g. 18.5"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm-notes">Notes (optional)</Label>
            <Input
              id="bm-notes"
              placeholder="e.g. morning, after workout…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!canSubmit} onClick={() => insertMutation.mutate()}>
            {insertMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BodySkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Card className="border-border/60 py-0">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-11 w-11 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
