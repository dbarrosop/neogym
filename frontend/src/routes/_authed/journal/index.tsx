import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Plus, Tag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const LABEL_SWATCHES = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
];

const JournalIndexQuery = graphql(`
  query JournalIndex {
    journalEntries(order_by: { entryDate: desc }) {
      id
      entryDate
      title
      content
      journalEntryLabels {
        journalLabel {
          id
          name
          color
        }
      }
    }
    journalLabels(order_by: { name: asc }) {
      id
      name
      color
    }
  }
`);

const InsertJournalLabelMutation = graphql(`
  mutation InsertJournalLabel($name: String!, $color: String!) {
    insertJournalLabel(object: { name: $name, color: $color }) {
      id
      name
      color
    }
  }
`);

const DeleteJournalLabelMutation = graphql(`
  mutation DeleteJournalLabel($id: uuid!) {
    deleteJournalLabel(id: $id) {
      id
    }
  }
`);

const searchSchema = z.object({
  labelId: z.string().optional(),
});

export const Route = createFileRoute("/_authed/journal/")({
  validateSearch: searchSchema,
  component: JournalIndexRoute,
});

function JournalIndexRoute() {
  const navigate = useNavigate();
  const { labelId } = Route.useSearch();

  const { data, isLoading, error } = useQuery({
    queryKey: ["journal"],
    queryFn: () => gqlRequest(JournalIndexQuery),
  });

  const entries = data?.journalEntries ?? [];
  const labels = data?.journalLabels ?? [];

  const filtered = useMemo(() => {
    if (!labelId) {
      return entries;
    }
    return entries.filter((e) =>
      e.journalEntryLabels.some((jel) => jel.journalLabel?.id === labelId),
    );
  }, [entries, labelId]);

  const grouped = useMemo(() => {
    type Entry = (typeof filtered)[number];
    const groups = new Map<string, Entry[]>();
    for (const e of filtered) {
      const key = new Date(e.entryDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        timeZone: "UTC",
      });
      const existing = groups.get(key);
      if (existing) {
        existing.push(e);
      } else {
        groups.set(key, [e]);
      }
    }
    return groups;
  }, [filtered]);

  function renderContent() {
    if (isLoading) {
      return <JournalSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (filtered.length === 0) {
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-3 py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {labelId ? "No entries with this label." : "No journal entries yet."}
            </p>
            {!labelId && (
              <Button asChild size="sm">
                <Link to="/journal/new">
                  <Plus className="mr-1 h-4 w-4" />
                  Write first entry
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {[...grouped.entries()].map(([month, monthEntries]) => (
          <div key={month} className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {month}
            </h2>
            <ul className="space-y-2">
              {monthEntries.map((e) => (
                <li key={e.id}>
                  <Link to="/journal/$entryId" params={{ entryId: e.id }} className="group block">
                    <Card className="border-border/60 py-0 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                      <CardContent className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-baseline gap-2">
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {new Date(e.entryDate).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  timeZone: "UTC",
                                })}
                              </span>
                              {e.title ? (
                                <span className="truncate font-medium">{e.title}</span>
                              ) : null}
                            </div>
                            {e.content ? (
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {e.content.slice(0, 160)}
                              </p>
                            ) : null}
                            {e.journalEntryLabels.length > 0 ? (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {e.journalEntryLabels.map((jel) =>
                                  jel.journalLabel ? (
                                    <Badge
                                      key={jel.journalLabel.id}
                                      variant="outline"
                                      className="h-5 px-1.5 text-[10px]"
                                      style={{
                                        borderColor: jel.journalLabel.color,
                                        color: jel.journalLabel.color,
                                      }}
                                    >
                                      {jel.journalLabel.name}
                                    </Badge>
                                  ) : null,
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  const activeLabel = labels.find((l) => l.id === labelId);

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Personal
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Journal</h1>
            <p className="text-sm text-muted-foreground">Dated entries, your thoughts and notes.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <ManageLabelsDialog labels={labels} />
            <Button asChild size="sm">
              <Link to="/journal/new">
                <Plus className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">New entry</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          </div>
        </header>

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/journal", search: {} })}
              className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors ${
                labelId
                  ? "bg-muted text-muted-foreground hover:text-foreground"
                  : "bg-foreground text-background"
              }`}
            >
              All
            </button>
            {labels.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/journal",
                    search: { labelId: l.id === labelId ? undefined : l.id },
                  })
                }
                className="inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: l.color,
                  color: l.id === labelId ? "#fff" : l.color,
                  backgroundColor: l.id === labelId ? l.color : "transparent",
                }}
              >
                {l.name}
                {l.id === labelId && <X className="h-3 w-3" />}
              </button>
            ))}
          </div>
        )}

        {activeLabel && (
          <p className="text-sm text-muted-foreground">
            Showing entries tagged{" "}
            <span className="font-medium" style={{ color: activeLabel.color }}>
              {activeLabel.name}
            </span>
          </p>
        )}

        {renderContent()}
      </div>
    </section>
  );
}

function ManageLabelsDialog({
  labels,
}: {
  labels: Array<{ id: string; name: string; color: string }>;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_SWATCHES[0] ?? "#6366f1");

  const insertMutation = useMutation({
    mutationFn: () => gqlRequest(InsertJournalLabelMutation, { name: name.trim(), color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      setName("");
      setColor(LABEL_SWATCHES[0] ?? "#6366f1");
      toast.success("Label created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteJournalLabelMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      toast.success("Label deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Tag className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Labels</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage labels</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {labels.length > 0 && (
            <ul className="space-y-1">
              {labels.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="text-sm">{l.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(l.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">New label</p>
            <div className="space-y-1.5">
              <Label htmlFor="label-name">Name</Label>
              <Input
                id="label-name"
                placeholder="e.g. Gratitude"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2">
                {LABEL_SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="h-6 w-6 rounded-full ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    style={{
                      backgroundColor: s,
                      outline: color === s ? `2px solid ${s}` : "none",
                      outlineOffset: 2,
                    }}
                    onClick={() => setColor(s)}
                    aria-label={s}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || insertMutation.isPending}
            onClick={() => insertMutation.mutate()}
          >
            {insertMutation.isPending ? "Creating…" : "Create label"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JournalSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Card className="border-border/60 py-0">
            <CardContent className="px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
