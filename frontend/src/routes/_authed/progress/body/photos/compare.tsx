import { createFileRoute, Link } from "@tanstack/react-router";
import { Columns2 } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";
import { StatTile } from "@/components/patterns/metrics";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import {
  catalogLabelValue,
  PhotoLabelChips,
  PhotoLabelsState,
  PhotoMeasurementText,
  photoLabelName,
  usePhotoLabels,
} from "@/components/progress-photos/photo-fields";
import { PhotoImage } from "@/components/progress-photos/photo-image";
import { usePhotoMeasurements, usePosePhotos } from "@/components/progress-photos/photo-session";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSignedDelta } from "@/lib/metric-format";
import type { ReadyPhoto } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import {
  compareSelection,
  daysBetween,
  measurementChange,
  type PhotoMeasurement,
} from "@/lib/progress-photos/sheet";

const searchSchema = z.object({
  label: z.string().max(64).optional(),
  from: z.string().max(64).optional(),
  to: z.string().max(64).optional(),
});

export const Route = createFileRoute("/_authed/progress/body/photos/compare")({
  validateSearch: searchSchema,
  component: ComparePage,
});

/** Date options for one label, newest first; several uploads on a date are numbered. */
function photoOptions(pose: readonly ReadyPhoto[]) {
  const perDate = new Map<string, number>();
  for (const photo of pose) {
    perDate.set(photo.takenOn, (perDate.get(photo.takenOn) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return pose.map((photo) => {
    const count = perDate.get(photo.takenOn) ?? 1;
    const index = (seen.get(photo.takenOn) ?? 0) + 1;
    seen.set(photo.takenOn, index);
    const date = photoDateLabel(photo.takenOn);
    return { id: photo.id, text: count > 1 ? `${date} (${index} of ${count})` : date };
  });
}

function PhotoChoice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; text: string }[];
  onChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="block min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm focus-visible:outline-2 focus-visible:outline-ring"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.text}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Days between the photos and, when they resolve to two different readings, the body
 * changes (one reading shared by both photos measures no change).
 */
function ChangeSummary({
  before,
  after,
  measurements,
}: {
  before: ReadyPhoto;
  after: ReadyPhoto;
  measurements: { before: PhotoMeasurement | null; after: PhotoMeasurement | null };
}) {
  const days = daysBetween(before.takenOn, after.takenOn);
  const delta = measurementChange(measurements.before, measurements.after);
  const weight = delta?.weightKg ?? null;
  const bodyFat = delta?.bodyFatPct ?? null;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3">
      <StatTile
        label="Time between"
        value={days === 0 ? "Same day" : `${days.toLocaleString()} ${days === 1 ? "day" : "days"}`}
      />
      {weight === null ? null : (
        <StatTile label="Weight change" value={`${formatSignedDelta(weight)} kg`} />
      )}
      {bodyFat === null ? null : (
        <StatTile label="Body fat change" value={`${formatSignedDelta(bodyFat)} %`} />
      )}
    </div>
  );
}

function PhotoCaption({
  side,
  photo,
  measurement,
}: {
  side: "Before" | "After";
  photo: ReadyPhoto;
  measurement: PhotoMeasurement | null;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>
        <span className="font-semibold">{side}</span>
        {" · "}
        <time dateTime={photo.takenOn}>{photoDateLabel(photo.takenOn)}</time>
      </span>
      <PhotoMeasurementText measurement={measurement} date={photo.takenOn} />
    </span>
  );
}

/** Below 768 px: the two photos stacked in one frame, with a slider to reveal either. */
function CompareSlider({
  before,
  after,
  name,
}: {
  before: ReadyPhoto;
  after: ReadyPhoto;
  name: string;
}) {
  const [split, setSplit] = useState(50);
  const sliderId = useId();
  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border bg-surface-inset">
        <div className="absolute inset-0">
          <PhotoImage
            id={before.file.id}
            fill
            alt={`${name} before, ${photoDateLabel(before.takenOn)}`}
          />
        </div>
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
          <PhotoImage
            id={after.file.id}
            fill
            alt={`${name} after, ${photoDateLabel(after.takenOn)}`}
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/80"
          style={{ left: `${split}%` }}
        />
        <span className="absolute top-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-xs font-semibold">
          Before
        </span>
        <span className="absolute top-2 right-2 rounded-full bg-background/85 px-2 py-0.5 text-xs font-semibold">
          After
        </span>
      </div>
      <label htmlFor={sliderId} className="sr-only">
        Divider position between the before and after photos
      </label>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(event) => setSplit(Number(event.currentTarget.value))}
        className="h-11 w-full accent-primary"
      />
    </div>
  );
}

function ComparePage() {
  const labels = usePhotoLabels();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const update = (next: {
    label?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  }) => navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  const label = catalogLabelValue(search.label ?? labels.data?.[0]?.value ?? "", labels.data);
  const labelRow = labels.data?.find((row) => row.value === label);
  const name = labelRow ? photoLabelName(labelRow) : "";
  const pose = usePosePhotos(label);
  const pair = pose.data ? compareSelection(pose.data, search.from, search.to) : null;
  const measurementFor = usePhotoMeasurements(7);

  function renderComparison() {
    if (!label) {
      return null;
    }
    if (pose.isPending) {
      return (
        <SkeletonState className="grid gap-4 md:grid-cols-2">
          <Skeleton className="aspect-[4/5] w-full rounded-xl" />
          <Skeleton className="aspect-[4/5] w-full rounded-xl max-md:hidden" />
        </SkeletonState>
      );
    }
    if (pose.isError) {
      return (
        <ErrorState
          title="Couldn't load photos"
          message={pose.error.message}
          onRetry={() => void pose.refetch()}
          isRetrying={pose.isFetching}
        />
      );
    }
    if (!pair) {
      return (
        <EmptyState
          icon={Columns2}
          title={`Add at least two ${name} photos to compare`}
          description="Comparing works best with photos taken the same way, a few weeks apart."
          actions={
            <Button asChild variant="outline">
              <Link to="/progress/body/photos/new" search={{ label }} preload={false}>
                Add photos
              </Link>
            </Button>
          }
        />
      );
    }
    const options = photoOptions(pose.data);
    const measurements = {
      before: measurementFor(pair.before.takenOn),
      after: measurementFor(pair.after.takenOn),
    };
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <PhotoChoice
            label="Before"
            value={pair.before.id}
            options={options}
            onChange={(id) => update({ from: id, to: pair.after.id })}
          />
          <PhotoChoice
            label="After"
            value={pair.after.id}
            options={options}
            onChange={(id) => update({ from: pair.before.id, to: id })}
          />
        </div>
        <div className="grid gap-4 max-md:hidden md:grid-cols-2">
          {(["Before", "After"] as const).map((side) => {
            const photo = side === "Before" ? pair.before : pair.after;
            return (
              <figure key={side} className="flex flex-col gap-2">
                {/* Same-size frames, short enough to keep both captions in view. */}
                <div className="h-[min(60dvh,40rem)] overflow-hidden rounded-xl border bg-surface-inset">
                  <PhotoImage
                    id={photo.file.id}
                    fill
                    alt={`${name} ${side.toLowerCase()}, ${photoDateLabel(photo.takenOn)}`}
                  />
                </div>
                <figcaption className="text-sm">
                  <PhotoCaption
                    side={side}
                    photo={photo}
                    measurement={side === "Before" ? measurements.before : measurements.after}
                  />
                </figcaption>
              </figure>
            );
          })}
        </div>
        <CompareSlider before={pair.before} after={pair.after} name={name} />
        <div className="grid grid-cols-2 gap-3 text-sm md:hidden">
          <PhotoCaption side="Before" photo={pair.before} measurement={measurements.before} />
          <PhotoCaption side="After" photo={pair.after} measurement={measurements.after} />
        </div>
        <ChangeSummary before={pair.before} after={pair.after} measurements={measurements} />
      </>
    );
  }

  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="Compare photos"
        description="Two photos with the same label, oldest on the left."
      />
      <PhotoLabelsState
        labels={labels}
        placeholder={<Skeleton aria-hidden="true" className="h-8 w-64 rounded-full" />}
      >
        {(catalog) => (
          <PhotoLabelChips
            labels={catalog}
            value={label ?? ""}
            includeAll={false}
            onChange={(value) => update({ label: value, from: undefined, to: undefined })}
          />
        )}
      </PhotoLabelsState>
      {renderComparison()}
    </PageShell>
  );
}
