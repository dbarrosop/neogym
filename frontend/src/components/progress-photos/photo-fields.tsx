import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useId } from "react";
import { FilterChip } from "@/components/patterns/filter-chip";
import { ErrorState } from "@/components/patterns/query-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProgressPhotoLabel_Enum } from "@/gql/graphql";
import { metricFormat } from "@/lib/metric-format";
import { listLabels, type PhotoLabel, photoKeys } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import { type PhotoMeasurement, sortPhotoLabels } from "@/lib/progress-photos/sheet";
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
    // Front before back everywhere: chips, selects, sheet columns and check-in slots.
    select: sortPhotoLabels,
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
  placeholder,
}: {
  labels: ReturnType<typeof usePhotoLabels>;
  children: (catalog: PhotoLabel[]) => ReactNode;
  /** Loading placeholder; defaults to a labelled field. */
  placeholder?: ReactNode;
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
    placeholder ?? (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full rounded-md" />
      </div>
    )
  );
}

/** "All" plus one chip per label; `""` means all. */
export function PhotoLabelChips({
  labels,
  value,
  onChange,
  includeAll = true,
}: {
  labels: PhotoLabel[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  return (
    <fieldset className="flex min-w-0 flex-wrap gap-2">
      <legend className="sr-only">Filter by label</legend>
      {includeAll ? (
        <FilterChip selected={value === ""} onClick={() => onChange("")}>
          All
        </FilterChip>
      ) : null}
      {labels.map((label) => (
        <FilterChip
          key={label.value}
          selected={value === label.value}
          onClick={() => onChange(label.value)}
        >
          {photoLabelName(label)}
        </FilterChip>
      ))}
    </fieldset>
  );
}

export function PhotoLabelSelect({
  labels,
  value,
  onChange,
}: {
  labels: PhotoLabel[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const unavailable = Boolean(value && !catalogLabelValue(value, labels));
  const noLabels = labels.length === 0;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Label</Label>
      <select
        id={id}
        className="block min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm focus-visible:outline-2 focus-visible:outline-ring"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        required
        aria-describedby={unavailable || noLabels ? `${id}-status` : undefined}
        autoComplete="off"
      >
        {unavailable ? (
          <option value={value} disabled>
            Label unavailable
          </option>
        ) : null}
        <option value="" disabled>
          Choose a label
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
  disabled,
}: {
  value: string;
  today: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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
        disabled={disabled}
        required
      />
    </div>
  );
}

/** A reading's formatted values ("81.2 kg", "19.5 %"), skipping missing ones. */
function measurementValues(measurement: PhotoMeasurement) {
  return [
    measurement.weightKg === null ? null : metricFormat.weight(measurement.weightKg),
    measurement.bodyFatPct === null ? null : metricFormat.bodyFat(measurement.bodyFatPct),
  ].filter((value) => value !== null);
}

/**
 * `PhotoMeasurementText` as plain text for an accessible name ("81.2 kg, 19.5 %", plus
 * " on Jan 10, 2025" for an earlier reading); `null` without a measurement.
 */
export function photoMeasurementLabel(measurement: PhotoMeasurement | null, date: string) {
  if (!measurement) {
    return null;
  }
  const values = measurementValues(measurement).join(", ");
  return measurement.measuredOn === date
    ? values
    : `${values} on ${photoDateLabel(measurement.measuredOn)}`;
}

/**
 * "81.2 kg · 19.5 %" for a photo date, with the reading's own date when it was taken
 * earlier ("81.2 kg on Jan 10, 2025"). Renders nothing without a measurement.
 */
export function PhotoMeasurementText({
  measurement,
  date,
  className = "text-sm text-muted-foreground tabular-nums",
}: {
  measurement: PhotoMeasurement | null;
  date: string;
  className?: string;
}) {
  if (!measurement) {
    return null;
  }
  return (
    <span className={className}>
      {measurementValues(measurement).join(" · ")}
      {measurement.measuredOn === date ? null : (
        <>
          {" on "}
          <time dateTime={measurement.measuredOn}>{photoDateLabel(measurement.measuredOn)}</time>
        </>
      )}
    </span>
  );
}
