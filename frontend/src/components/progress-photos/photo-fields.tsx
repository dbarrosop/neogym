import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { ErrorState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProgressPhotoLabel_Enum } from "@/gql/graphql";
import { listAngles, type PhotoAngle } from "@/lib/progress-photos/api";
import { usePhotoScope } from "./photo-boundary";

export function photoAngleName(angle: PhotoAngle) {
  return angle.comment?.trim() || angle.value;
}

export function photoLabel(value: string, angles: PhotoAngle[] | undefined) {
  const row = angles?.find((angle) => angle.value === value);
  // Hasura validates its current enum. The deployed catalog can be newer than
  // the generated TS snapshot; only convert values returned in that catalog.
  return row ? (row.value as ProgressPhotoLabel_Enum) : null;
}

export function usePhotoAngles() {
  const scope = usePhotoScope();
  return useQuery({
    queryKey: ["photo-angles", scope.owner],
    queryFn: ({ signal }) => listAngles(scope, signal),
  });
}

export function AngleSelect({
  angles,
  value,
  onChange,
  includeAll,
}: {
  angles: PhotoAngle[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  const id = useId();
  const unavailable = Boolean(value && !photoLabel(value, angles));
  const noAngles = !includeAll && angles.length === 0;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{includeAll ? "Filter by angle" : "Angle"}</Label>
      <select
        id={id}
        className="block min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={!includeAll}
        aria-describedby={unavailable || noAngles ? `${id}-status` : undefined}
        autoComplete="off"
      >
        {unavailable ? (
          <option value={value} disabled>
            Angle unavailable
          </option>
        ) : null}
        <option value="" disabled={!includeAll}>
          {includeAll ? "All angles" : "Choose an angle"}
        </option>
        {angles.map((angle) => (
          <option key={angle.value} value={angle.value}>
            {photoAngleName(angle)}
          </option>
        ))}
      </select>
      {unavailable || noAngles ? (
        <p id={`${id}-status`} role="alert" className="text-sm text-destructive">
          {noAngles
            ? "No photo angles are available."
            : "This angle is no longer available. Choose another option."}
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

export function PhotoLoadError({ title, retry }: { title: string; retry: () => void }) {
  return (
    <ErrorState
      title={title}
      message={
        <Button type="button" variant="outline" onClick={retry}>
          Retry
        </Button>
      }
    />
  );
}
