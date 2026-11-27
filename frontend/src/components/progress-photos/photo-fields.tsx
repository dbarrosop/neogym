import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useId } from "react";
import { ErrorState } from "@/components/patterns/query-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProgressPhotoLabel_Enum } from "@/gql/graphql";
import { listLabels, type PhotoLabel, photoKeys } from "@/lib/progress-photos/api";
import { usePhotoOwner } from "./photo-session";

export function photoLabelName(label: PhotoLabel) {
  return label.comment?.trim() || label.value;
}

export function catalogLabelValue(value: string, labels: PhotoLabel[] | undefined) {
  const row = labels?.find((label) => label.value === value);
  // Hasura validates its current enum. The deployed catalog can be newer than
  // the generated TS snapshot; only convert values returned in that catalog.
  return row ? (row.value as ProgressPhotoLabel_Enum) : null;
}

export function usePhotoLabels() {
  const owner = usePhotoOwner();
  return useQuery({
    queryKey: photoKeys.labels(owner),
    queryFn: ({ signal }) => listLabels(signal),
    // The admin-managed catalog rarely changes; reuse it across photo screens.
    staleTime: 5 * 60_000,
  });
}

/**
 * Renders `children` with the loaded label catalog, a field placeholder while it
 * loads, or an error with Retry.
 */
export function PhotoLabelsState({
  labels,
  children,
}: {
  labels: ReturnType<typeof usePhotoLabels>;
  children: (catalog: PhotoLabel[]) => ReactNode;
}) {
  if (labels.data) {
    return children(labels.data);
  }
  if (labels.isError) {
    return (
      <ErrorState
        title="Couldn't load photo labels"
        message={labels.error.message}
        onRetry={() => void labels.refetch()}
        isRetrying={labels.isFetching}
      />
    );
  }
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11 w-full rounded-md" />
    </div>
  );
}

export function PhotoLabelSelect({
  labels,
  value,
  onChange,
  includeAll,
}: {
  labels: PhotoLabel[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  const id = useId();
  const unavailable = Boolean(value && !catalogLabelValue(value, labels));
  const noLabels = !includeAll && labels.length === 0;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{includeAll ? "Filter by label" : "Label"}</Label>
      <select
        id={id}
        className="block min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={!includeAll}
        aria-describedby={unavailable || noLabels ? `${id}-status` : undefined}
        autoComplete="off"
      >
        {unavailable ? (
          <option value={value} disabled>
            Label unavailable
          </option>
        ) : null}
        <option value="" disabled={!includeAll}>
          {includeAll ? "All labels" : "Choose a label"}
        </option>
        {labels.map((label) => (
          <option key={label.value} value={label.value}>
            {photoLabelName(label)}
          </option>
        ))}
      </select>
      {unavailable || noLabels ? (
        <p id={`${id}-status`} role="alert" className="text-sm text-destructive">
          {noLabels
            ? "No photo labels are available."
            : "This label is no longer available. Choose another option."}
        </p>
      ) : null}
    </div>
  );
}

export function PhotoDateInput({
  value,
  today,
  onChange,
}: {
  value: string;
  today: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Date taken</Label>
      <Input
        id={id}
        type="date"
        className="min-h-11"
        min="0001-01-01"
        max={today}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        autoComplete="off"
        required
      />
    </div>
  );
}
