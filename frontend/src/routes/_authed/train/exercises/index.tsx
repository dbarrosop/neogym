import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Check, ChevronDown, ChevronRight, Dumbbell, Globe2, Search, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { AreaTabs } from "@/components/shell/area-tabs";
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
      strength { doubleWeight }
      primaryMuscleGroup
      category
      equipment
      level
      isPublic
      secondaryMuscleGroups {
        muscleGroup
      }
    }
  }
`);

const visibilityValues = ["mine", "public"] as const;
type Visibility = (typeof visibilityValues)[number];

const exercisesSearchSchema = z.object({
  q: z.string().optional(),
  muscle: z.string().optional(),
  category: z.string().optional(),
  equipment: z.string().optional(),
  level: z.string().optional(),
  visibility: z.enum(visibilityValues).optional(),
});

const RecentExercisesQuery = graphql(`
  query RecentlyLoggedExercises {
    workoutSessionExercises(
      where: { _or: [{ workoutSessionStrengthSets: {} }, { workoutSessionCardioEntries: {} }] }
      order_by: { workoutSession: { startedAt: desc } }
      limit: 80
    ) {
      id
      exerciseId
      workoutSession {
        id
        startedAt
      }
    }
  }
`);

export const Route = createFileRoute("/_authed/train/exercises/")({
  validateSearch: exercisesSearchSchema,
  component: ExercisesRoute,
});

type Exercise = {
  id: string;
  name: string;
  strength?: { doubleWeight: boolean } | null;
  primaryMuscleGroup: string;
  category?: string | null;
  equipment?: string | null;
  level?: string | null;
  isPublic: boolean;
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
  visibility: Visibility | null,
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
  if (visibility === "mine" && ex.isPublic) {
    return false;
  }
  if (visibility === "public" && !ex.isPublic) {
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
  visibility: Visibility | null,
  searchMatchIds: Set<string> | null,
  columnKey: FilterKey,
): Array<{ value: string; count: number }> {
  // Apply every filter EXCEPT the one this column owns, plus the search.
  // That way each column shows what would still be reachable if the user
  // changed their pick within it.
  const otherFilters: Filters = { ...filters, [columnKey]: null };
  const counts = new Map<string, number>();
  for (const ex of exercises) {
    if (!matchesFilters(ex, otherFilters, visibility, searchMatchIds)) {
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
  const visibility: Visibility | null = searchParams.visibility ?? null;
  const search = searchParams.q ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["exercises", "index"],
    queryFn: () => gqlRequest(ExercisesIndexQuery),
  });

  const exercises = useMemo<Exercise[]>(() => data?.exercises ?? [], [data]);
  const isFiltered =
    search.trim() !== "" || visibility !== null || Object.values(filters).some((v) => v !== null);

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
    const matched = exercises.filter((ex) =>
      matchesFilters(ex, filters, visibility, searchMatchIds),
    );
    if (searchScores) {
      // Fuzzy match: rank by score (lower = better) so the closest hits float up.
      return matched.slice().sort((a, b) => {
        const sa = searchScores.get(a.id) ?? Number.POSITIVE_INFINITY;
        const sb = searchScores.get(b.id) ?? Number.POSITIVE_INFINITY;
        return sa - sb;
      });
    }
    return matched;
  }, [exercises, filters, visibility, searchMatchIds, searchScores]);

  function setFilter(key: FilterKey, value: string | null) {
    navigate({
      search: (prev) => ({ ...prev, [key]: value ?? undefined }),
      replace: true,
    });
    setActivePanel(null);
  }

  function setVisibility(value: Visibility | null) {
    navigate({
      search: (prev) => ({ ...prev, visibility: value ?? undefined }),
      replace: true,
    });
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

  const { data: recentData } = useQuery({
    queryKey: ["exercises", "recent"],
    queryFn: () => gqlRequest(RecentExercisesQuery),
  });
  const lastLogged = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of recentData?.workoutSessionExercises ?? []) {
      if (!map.has(row.exerciseId)) {
        map.set(row.exerciseId, row.workoutSession.startedAt);
      }
    }
    return map;
  }, [recentData]);

  function renderResults() {
    if (isLoading) {
      return <ExercisesSkeleton />;
    }
    if (error) {
      return <ErrorState title="Couldn't load exercises" message={error.message} />;
    }
    if (filteredExercises.length === 0) {
      return (
        <EmptyState
          title="No exercises match"
          description="Try a different search or remove a filter."
        >
          {isFiltered ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm font-medium text-link hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </EmptyState>
      );
    }
    if (search.trim() !== "") {
      // Fuzzy search ranks by relevance; grouping by muscle would bucket the
      // best match alphabetically and hide it under unrelated groups.
      return <FlatResults exercises={filteredExercises} lastLogged={lastLogged} />;
    }
    return <GroupedResults exercises={filteredExercises} lastLogged={lastLogged} />;
  }

  const activeChips = [
    ...(visibility
      ? [{ key: "visibility", label: visibility === "mine" ? "Mine" : "Public" }]
      : []),
    ...COLUMN_ORDER.flatMap((key) =>
      filters[key] ? [{ key, label: formatEnumValue(filters[key] ?? "") }] : [],
    ),
  ];

  return (
    <PageShell maxWidth="6xl">
      <PageHeader title="Train" tabs={<AreaTabs area="train" />} />
      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:block">
          <FilterRail
            filters={filters}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            onSelect={setFilter}
            exercises={exercises}
            searchMatchIds={searchMatchIds}
          />
        </aside>
        <section aria-label="Results" className="flex min-w-0 flex-col gap-3">
          <SearchBar value={search} onChange={setSearchText} count={exercises.length} />
          <div className="min-[1100px]:hidden">
            <FilterStrip
              filters={filters}
              visibility={visibility}
              onVisibilityChange={setVisibility}
              activePanel={activePanel}
              onToggle={(key) => setActivePanel((cur) => (cur === key ? null : key))}
              onClear={(key) => setFilter(key, null)}
              onSelect={setFilter}
              exercises={exercises}
              searchMatchIds={searchMatchIds}
            />
          </div>
          {isFiltered ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft pr-1 pl-3 font-medium text-accent-soft-foreground"
                >
                  {chip.label}
                  <button
                    type="button"
                    className="grid size-5 place-items-center rounded-full hover:bg-primary/20"
                    aria-label={`Clear ${chip.label} filter`}
                    onClick={() =>
                      chip.key === "visibility"
                        ? setVisibility(null)
                        : setFilter(chip.key as FilterKey, null)
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <span className="tabular-nums">
                {filteredExercises.length} match{filteredExercises.length === 1 ? "" : "es"}
              </span>
              <button
                type="button"
                onClick={clearAll}
                className="font-medium text-link hover:underline"
              >
                Clear all
              </button>
            </div>
          ) : null}
          {renderResults()}
        </section>
      </div>
    </PageShell>
  );
}

function SearchBar({
  value,
  onChange,
  count,
}: {
  value: string;
  onChange: (v: string) => void;
  count: number;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={count > 0 ? `Search ${count} exercises` : "Search exercises"}
        aria-label="Search exercises"
        className="h-11 rounded-xl bg-card pr-10 pl-10"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

interface FilterRailProps {
  filters: Filters;
  visibility: Visibility | null;
  onVisibilityChange: (value: Visibility | null) => void;
  onSelect: (key: FilterKey, value: string | null) => void;
  exercises: Exercise[];
  searchMatchIds: Set<string> | null;
}

/** Desktop filter column: every facet visible at once, one pick per facet. */
function FilterRail({
  filters,
  visibility,
  onVisibilityChange,
  onSelect,
  exercises,
  searchMatchIds,
}: FilterRailProps) {
  return (
    <nav
      aria-label="Exercise filters"
      className="flex flex-col gap-5 rounded-xl border bg-card p-4"
    >
      <RailGroup title="Show">
        <RailOption selected={visibility === null} onClick={() => onVisibilityChange(null)}>
          All exercises
        </RailOption>
        <RailOption selected={visibility === "mine"} onClick={() => onVisibilityChange("mine")}>
          Only mine
        </RailOption>
        <RailOption selected={visibility === "public"} onClick={() => onVisibilityChange("public")}>
          Public library
        </RailOption>
      </RailGroup>
      {COLUMN_ORDER.map((key) => (
        <RailFacet
          key={key}
          title={FILTER_LABELS[key]}
          options={computeOptions(exercises, filters, visibility, searchMatchIds, key)}
          selected={filters[key]}
          onSelect={(value) => onSelect(key, value)}
        />
      ))}
    </nav>
  );
}

function RailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="px-2 pb-1 text-[13px] font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function RailOption({
  selected,
  onClick,
  count,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted/60",
        selected && "font-semibold text-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count === undefined ? null : (
        <span className="text-[12px] text-muted-foreground tabular-nums">{count}</span>
      )}
    </button>
  );
}

const RAIL_VISIBLE_OPTIONS = 6;

function RailFacet({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: Array<{ value: string; count: number }>;
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (options.length === 0) {
    return null;
  }
  const ranked = [...options].sort((a, b) => b.count - a.count);
  let visible = showAll ? options : ranked.slice(0, RAIL_VISIBLE_OPTIONS);
  if (!showAll && selected && !visible.some((o) => o.value === selected)) {
    const picked = options.find((o) => o.value === selected);
    visible = picked ? [picked, ...visible.slice(0, RAIL_VISIBLE_OPTIONS - 1)] : visible;
  }
  return (
    <RailGroup title={title}>
      {visible.map((option) => (
        <RailOption
          key={option.value}
          selected={selected === option.value}
          count={option.count}
          onClick={() => onSelect(selected === option.value ? null : option.value)}
        >
          {formatEnumValue(option.value)}
        </RailOption>
      ))}
      {options.length > RAIL_VISIBLE_OPTIONS ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="self-start px-2 pt-1 text-[13px] font-medium text-link hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${options.length}`}
        </button>
      ) : null}
    </RailGroup>
  );
}

interface FilterStripProps {
  filters: Filters;
  visibility: Visibility | null;
  onVisibilityChange: (value: Visibility | null) => void;
  activePanel: FilterKey | null;
  onToggle: (key: FilterKey) => void;
  onClear: (key: FilterKey) => void;
  onSelect: (key: FilterKey, value: string | null) => void;
  exercises: Exercise[];
  searchMatchIds: Set<string> | null;
}

function FilterStrip({
  filters,
  visibility,
  onVisibilityChange,
  activePanel,
  onToggle,
  onClear,
  onSelect,
  exercises,
  searchMatchIds,
}: FilterStripProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <VisibilityPill
          value="mine"
          active={visibility === "mine"}
          onClick={() => onVisibilityChange(visibility === "mine" ? null : "mine")}
        />
        <VisibilityPill
          value="public"
          active={visibility === "public"}
          onClick={() => onVisibilityChange(visibility === "public" ? null : "public")}
        />
      </div>
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
          options={computeOptions(exercises, filters, visibility, searchMatchIds, activePanel)}
          selected={filters[activePanel]}
          onSelect={(value) => onSelect(activePanel, value)}
        />
      ) : null}
    </div>
  );
}

function VisibilityPill({
  value,
  active,
  onClick,
}: {
  value: Visibility;
  active: boolean;
  onClick: () => void;
}) {
  const label = value === "mine" ? "Mine" : "Public";
  const Icon = value === "mine" ? User : Globe2;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-accent-soft text-accent-soft-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
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
      <div className="flex h-9 items-center justify-between gap-1 rounded-lg bg-accent-soft px-2 text-xs font-medium text-accent-soft-foreground">
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
        "flex h-9 items-center justify-between gap-1 rounded-lg border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60",
        isActive && "bg-muted",
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
      <div className="rounded-xl border bg-card p-3 text-center text-xs text-muted-foreground">
        No options available with the current filters.
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card p-2">
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
                isSelected
                  ? "bg-accent-soft text-accent-soft-foreground"
                  : "text-foreground hover:bg-muted/60",
              )}
            >
              <span className="truncate font-medium">{formatEnumValue(option.value)}</span>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  isSelected ? "text-accent-soft-foreground/80" : "text-muted-foreground",
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

function lastLoggedLabel(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  return `last ${new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}`;
}

function GroupedResults({
  exercises,
  lastLogged,
}: {
  exercises: Exercise[];
  lastLogged: Map<string, string>;
}) {
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
  const recent = useMemo(
    () =>
      exercises
        .filter((ex) => lastLogged.has(ex.id))
        .sort((a, b) => (lastLogged.get(b.id) ?? "").localeCompare(lastLogged.get(a.id) ?? ""))
        .slice(0, 6),
    [exercises, lastLogged],
  );

  return (
    <div className="flex flex-col gap-4">
      {recent.length > 0 ? (
        <ResultGroup title="Recently logged" count={null}>
          {recent.map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} lastLogged={lastLogged.get(ex.id)} showMuscle />
          ))}
        </ResultGroup>
      ) : null}
      {grouped.map(([muscle, items]) => (
        <ResultGroup key={muscle} title={formatEnumValue(muscle)} count={items.length}>
          {items.map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} lastLogged={lastLogged.get(ex.id)} />
          ))}
        </ResultGroup>
      ))}
    </div>
  );
}

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-xl border bg-card p-2">
      <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2 pb-1.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {count === null ? null : (
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {count} exercise{count === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <ul className="grid gap-0.5 sm:grid-cols-2">{children}</ul>
    </section>
  );
}

function FlatResults({
  exercises,
  lastLogged,
}: {
  exercises: Exercise[];
  lastLogged: Map<string, string>;
}) {
  return (
    <ResultGroup title="Best matches" count={exercises.length}>
      {exercises.map((ex) => (
        <ExerciseRow key={ex.id} exercise={ex} lastLogged={lastLogged.get(ex.id)} showMuscle />
      ))}
    </ResultGroup>
  );
}

function ExerciseRow({
  exercise,
  showMuscle,
  lastLogged,
}: {
  exercise: Exercise;
  showMuscle?: boolean;
  lastLogged?: string | undefined;
}) {
  const VisibilityIcon = exercise.isPublic ? Globe2 : User;
  const meta = [
    showMuscle ? formatEnumValue(exercise.primaryMuscleGroup) : null,
    exercise.equipment ? formatEnumValue(exercise.equipment) : null,
    lastLoggedLabel(lastLogged),
  ].filter(Boolean);
  return (
    <li className="min-w-0">
      <Link
        to="/train/exercises/$exerciseId"
        params={{ exerciseId: exercise.id }}
        className="group flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-inset text-muted-foreground">
          <Dumbbell className="size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{exercise.name}</span>
            <VisibilityIcon
              className={cn(
                "size-3 shrink-0",
                exercise.isPublic ? "text-link/70" : "text-muted-foreground/70",
              )}
              aria-label={exercise.isPublic ? "Public" : "Mine"}
            />
          </span>
          {meta.length > 0 ? (
            <span className="truncate text-[13px] text-muted-foreground">{meta.join(" · ")}</span>
          ) : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function ExercisesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
