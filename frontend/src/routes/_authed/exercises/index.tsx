import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { ChevronDown, ChevronRight, Dumbbell, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { cn } from "@/lib/utils";

const ExercisesIndexQuery = graphql(`
  query ExercisesIndex {
    exercises(order_by: { name: asc }) {
      id
      name
      doubleWeight
      primaryMuscleGroup
      category
      equipment
      level
      secondaryMuscleGroups {
        muscleGroup
      }
    }
  }
`);

const exercisesSearchSchema = z.object({
  q: z.string().optional(),
  muscle: z.string().optional(),
  category: z.string().optional(),
  equipment: z.string().optional(),
  level: z.string().optional(),
});

export const Route = createFileRoute("/_authed/exercises/")({
  validateSearch: exercisesSearchSchema,
  component: ExercisesRoute,
});

type Exercise = {
  id: string;
  name: string;
  doubleWeight: boolean;
  primaryMuscleGroup: string;
  category?: string | null;
  equipment?: string | null;
  level?: string | null;
  secondaryMuscleGroups: Array<{ muscleGroup: string }>;
};

type FilterKey = "muscle" | "category" | "equipment" | "level";
type Filters = Record<FilterKey, string | null>;

const FILTER_LABELS: Record<FilterKey, string> = {
  muscle: "Muscle",
  category: "Category",
  equipment: "Equipment",
  level: "Level",
};

const COLUMN_ORDER: FilterKey[] = ["muscle", "category", "equipment", "level"];

function formatEnumValue(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function matchesFilters(
  ex: Exercise,
  filters: Filters,
  searchMatchIds: Set<string> | null,
): boolean {
  if (filters.muscle) {
    const involves =
      ex.primaryMuscleGroup === filters.muscle ||
      ex.secondaryMuscleGroups.some((s) => s.muscleGroup === filters.muscle);
    if (!involves) {
      return false;
    }
  }
  if (filters.category && ex.category !== filters.category) {
    return false;
  }
  if (filters.equipment && ex.equipment !== filters.equipment) {
    return false;
  }
  if (filters.level && ex.level !== filters.level) {
    return false;
  }
  if (searchMatchIds && !searchMatchIds.has(ex.id)) {
    return false;
  }
  return true;
}

function getExerciseValuesForColumn(ex: Exercise, key: FilterKey): string[] {
  switch (key) {
    case "muscle":
      return [ex.primaryMuscleGroup, ...ex.secondaryMuscleGroups.map((s) => s.muscleGroup)];
    case "category":
      return ex.category ? [ex.category] : [];
    case "equipment":
      return ex.equipment ? [ex.equipment] : [];
    case "level":
      return ex.level ? [ex.level] : [];
  }
}

function computeOptions(
  exercises: Exercise[],
  filters: Filters,
  searchMatchIds: Set<string> | null,
  columnKey: FilterKey,
): Array<{ value: string; count: number }> {
  // Apply every filter EXCEPT the one this column owns, plus the search.
  // That way each column shows what would still be reachable if the user
  // changed their pick within it.
  const otherFilters: Filters = { ...filters, [columnKey]: null };
  const counts = new Map<string, number>();
  for (const ex of exercises) {
    if (!matchesFilters(ex, otherFilters, searchMatchIds)) {
      continue;
    }
    const seen = new Set<string>();
    for (const value of getExerciseValuesForColumn(ex, columnKey)) {
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

function ExercisesRoute() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [activePanel, setActivePanel] = useState<FilterKey | null>(null);

  const filters: Filters = useMemo(
    () => ({
      muscle: searchParams.muscle ?? null,
      category: searchParams.category ?? null,
      equipment: searchParams.equipment ?? null,
      level: searchParams.level ?? null,
    }),
    [searchParams.muscle, searchParams.category, searchParams.equipment, searchParams.level],
  );
  const search = searchParams.q ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["exercises", "index"],
    queryFn: () => gqlRequest(ExercisesIndexQuery),
  });

  const exercises = useMemo<Exercise[]>(() => data?.exercises ?? [], [data]);
  const isFiltered = search.trim() !== "" || Object.values(filters).some((v) => v !== null);

  const fuse = useMemo(
    () =>
      new Fuse(exercises, {
        keys: ["name"],
        // Names are short, so an unanchored fuzzy match feels more natural
        // than the default location-weighted scoring.
        ignoreLocation: true,
        threshold: 0.4,
        includeScore: true,
      }),
    [exercises],
  );

  const searchScores = useMemo<Map<string, number> | null>(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return null;
    }
    const result = new Map<string, number>();
    for (const r of fuse.search(trimmed)) {
      result.set(r.item.id, r.score ?? 0);
    }
    return result;
  }, [fuse, search]);

  const searchMatchIds = useMemo<Set<string> | null>(
    () => (searchScores ? new Set(searchScores.keys()) : null),
    [searchScores],
  );

  const filteredExercises = useMemo(() => {
    const matched = exercises.filter((ex) => matchesFilters(ex, filters, searchMatchIds));
    if (searchScores) {
      // Fuzzy match: rank by score (lower = better) so the closest hits float up.
      return matched.slice().sort((a, b) => {
        const sa = searchScores.get(a.id) ?? Number.POSITIVE_INFINITY;
        const sb = searchScores.get(b.id) ?? Number.POSITIVE_INFINITY;
        return sa - sb;
      });
    }
    return matched;
  }, [exercises, filters, searchMatchIds, searchScores]);

  function setFilter(key: FilterKey, value: string | null) {
    navigate({
      search: (prev) => ({ ...prev, [key]: value ?? undefined }),
      replace: true,
    });
    setActivePanel(null);
  }

  function setSearchText(value: string) {
    navigate({
      search: (prev) => ({ ...prev, q: value === "" ? undefined : value }),
      replace: true,
    });
  }

  function clearAll() {
    navigate({ search: {}, replace: true });
    setActivePanel(null);
  }

  function renderResults() {
    if (isLoading) {
      return <ExercisesSkeleton />;
    }
    if (error) {
      return <ErrorCard message={error.message} />;
    }
    if (filteredExercises.length === 0) {
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-2 py-8 text-center text-sm text-muted-foreground">
            <p>No exercises match these filters.</p>
            {isFiltered ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </CardContent>
        </Card>
      );
    }
    if (isFiltered) {
      return <FlatResults exercises={filteredExercises} />;
    }
    return <GroupedResults exercises={filteredExercises} />;
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Catalog
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Exercises</h1>
          <p className="text-sm text-muted-foreground">
            Search by name, or narrow the catalog by muscle, category, equipment, and level.
          </p>
        </header>

        <div className="space-y-3">
          <SearchBar value={search} onChange={setSearchText} />
          <FilterStrip
            filters={filters}
            activePanel={activePanel}
            onToggle={(key) => setActivePanel((cur) => (cur === key ? null : key))}
            onClear={(key) => setFilter(key, null)}
            onSelect={setFilter}
            exercises={exercises}
            searchMatchIds={searchMatchIds}
          />
          {isFiltered ? (
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span>
                {filteredExercises.length} match{filteredExercises.length === 1 ? "" : "es"}
              </span>
              <button
                type="button"
                onClick={clearAll}
                className="font-medium text-primary hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>

        {renderResults()}
      </div>
    </section>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search exercises…"
        className="pr-9 pl-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

interface FilterStripProps {
  filters: Filters;
  activePanel: FilterKey | null;
  onToggle: (key: FilterKey) => void;
  onClear: (key: FilterKey) => void;
  onSelect: (key: FilterKey, value: string | null) => void;
  exercises: Exercise[];
  searchMatchIds: Set<string> | null;
}

function FilterStrip({
  filters,
  activePanel,
  onToggle,
  onClear,
  onSelect,
  exercises,
  searchMatchIds,
}: FilterStripProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {COLUMN_ORDER.map((key) => (
          <FilterColumnHeader
            key={key}
            label={FILTER_LABELS[key]}
            value={filters[key]}
            isActive={activePanel === key}
            onToggle={() => onToggle(key)}
            onClear={() => onClear(key)}
          />
        ))}
      </div>
      {activePanel ? (
        <FilterPanel
          options={computeOptions(exercises, filters, searchMatchIds, activePanel)}
          selected={filters[activePanel]}
          onSelect={(value) => onSelect(activePanel, value)}
        />
      ) : null}
    </div>
  );
}

interface FilterColumnHeaderProps {
  label: string;
  value: string | null;
  isActive: boolean;
  onToggle: () => void;
  onClear: () => void;
}

function FilterColumnHeader({
  label,
  value,
  isActive,
  onToggle,
  onClear,
}: FilterColumnHeaderProps) {
  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 text-xs font-medium text-primary">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 truncate text-left"
          title={formatEnumValue(value)}
        >
          {formatEnumValue(value)}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded p-0.5 hover:bg-primary/20"
          aria-label={`Clear ${label} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex h-9 items-center justify-between gap-1 rounded-md border border-border/60 bg-card/60 px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent/50",
        isActive && "border-primary/40 bg-accent/40",
      )}
    >
      <span className="truncate">{label}</span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
          isActive && "rotate-180",
        )}
      />
    </button>
  );
}

interface FilterPanelProps {
  options: Array<{ value: string; count: number }>;
  selected: string | null;
  onSelect: (value: string | null) => void;
}

function FilterPanel({ options, selected, onSelect }: FilterPanelProps) {
  if (options.length === 0) {
    return (
      <div className="rounded-md border border-border/60 bg-card/80 p-3 text-center text-xs text-muted-foreground backdrop-blur">
        No options available with the current filters.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border/60 bg-card/80 p-2 backdrop-blur">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(isSelected ? null : option.value)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                isSelected ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent/50",
              )}
            >
              <span className="truncate font-medium">{formatEnumValue(option.value)}</span>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  isSelected ? "text-primary/80" : "text-muted-foreground",
                )}
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GroupedResults({ exercises }: { exercises: Exercise[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of exercises) {
      const list = map.get(ex.primaryMuscleGroup);
      if (list) {
        list.push(ex);
      } else {
        map.set(ex.primaryMuscleGroup, [ex]);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises]);

  return (
    <div className="space-y-4">
      {grouped.map(([muscle, items]) => (
        <Card
          key={muscle}
          className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-lg tracking-tight">{formatEnumValue(muscle)}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {items.length} exercise{items.length === 1 ? "" : "s"}
            </span>
          </CardHeader>
          <CardContent className="px-2 pt-0 pb-2">
            <ul className="divide-y divide-border/50">
              {items.map((ex) => (
                <ExerciseRow key={ex.id} exercise={ex} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FlatResults({ exercises }: { exercises: Exercise[] }) {
  return (
    <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <CardContent className="px-2 py-2">
        <ul className="divide-y divide-border/50">
          {exercises.map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} showMuscle />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ExerciseRow({ exercise, showMuscle }: { exercise: Exercise; showMuscle?: boolean }) {
  return (
    <li>
      <Link
        to="/exercises/$exerciseId"
        params={{ exerciseId: exercise.id }}
        className="group flex min-h-12 items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent/50"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-sm font-medium">{exercise.name}</span>
          {showMuscle ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {formatEnumValue(exercise.primaryMuscleGroup)}
            </span>
          ) : null}
          {exercise.doubleWeight ? (
            <Badge variant="outline" className="hidden sm:inline-flex">
              Two-handed
            </Badge>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function ExercisesSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="border-border/60">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-4">
        <p className="text-sm text-destructive">Failed to load: {message}</p>
      </CardContent>
    </Card>
  );
}
