import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { PhotoLabel, ReadyPhoto } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import { buildContactSheet, type PhotoMeasurement } from "@/lib/progress-photos/sheet";
import { PhotoMeasurementText, photoLabelName } from "./photo-fields";
import { PhotoImage } from "./photo-image";

type MeasurementFor = (date: string) => PhotoMeasurement | null;

function PhotoTile({
  photo,
  count = 1,
  caption,
  detail,
  name,
}: {
  photo: ReadyPhoto;
  count?: number;
  caption: ReactNode;
  detail?: ReactNode;
  /** The link's accessible name, e.g. "Front A, Jan 8, 2025, 2 photos". */
  name: string;
}) {
  return (
    <Link
      to="/progress/body/photos/$photoId"
      params={{ photoId: photo.id }}
      preload={false}
      aria-label={name}
      className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="relative overflow-hidden rounded-xl border bg-card group-hover:border-primary">
        <PhotoImage id={photo.file.id} thumbnail alt="" />
        {count > 1 ? (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 rounded-full bg-background/85 px-2 py-0.5 text-xs font-semibold tabular-nums"
          >
            {count}
          </span>
        ) : null}
      </div>
      <span className="mt-1.5 block text-sm font-medium wrap-anywhere">{caption}</span>
      {detail ? <span className="block">{detail}</span> : null}
    </Link>
  );
}

function AddPhotoSlot({ date, label }: { date: string; label: PhotoLabel }) {
  const name = photoLabelName(label);
  return (
    <>
      <Link
        to="/progress/body/photos/new"
        search={{ date, label: label.value }}
        preload={false}
        aria-label={`Add ${name} photo for ${photoDateLabel(date)}`}
        className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-border-strong border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Plus aria-hidden="true" className="size-5" />
        <span>Add</span>
      </Link>
      <span aria-hidden="true" className="mt-1.5 block text-sm font-medium text-muted-foreground">
        {name}
      </span>
    </>
  );
}

/**
 * One row per date taken, newest first, with one column per label in catalog order so
 * the same label lines up down the page. A missing label is a dashed "Add" slot for
 * that date; several uploads of a label on one date show their count.
 */
export function PhotoContactSheet({
  photos,
  labels,
  measurementFor,
}: {
  photos: readonly ReadyPhoto[];
  labels: readonly PhotoLabel[];
  measurementFor: MeasurementFor;
}) {
  const sheet = buildContactSheet(photos, labels);
  const columns = { "--photo-columns": String(sheet.columns.length) } as CSSProperties;
  return (
    <ol aria-label="Progress photos" className="flex flex-col">
      {sheet.rows.map((row) => {
        const dateLabel = photoDateLabel(row.date);
        return (
          <li
            key={row.date}
            className="grid gap-3 border-t py-5 first:border-t-0 first:pt-0 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 md:flex-col">
              <h2 className="font-semibold">
                <time dateTime={row.date}>{dateLabel}</time>
              </h2>
              <PhotoMeasurementText measurement={measurementFor(row.date)} date={row.date} />
            </div>
            <ul
              aria-label={`Photos from ${dateLabel}`}
              style={columns}
              className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[repeat(var(--photo-columns),minmax(0,11rem))]"
            >
              {row.cells.map(({ label, photos: cell }) => (
                <li key={label.value} className="min-w-0">
                  {cell[0] ? (
                    <PhotoTile
                      photo={cell[0]}
                      count={cell.length}
                      caption={photoLabelName(label)}
                      name={`${photoLabelName(label)}, ${dateLabel}${cell.length > 1 ? `, ${cell.length} photos` : ""}`}
                    />
                  ) : (
                    <AddPhotoSlot date={row.date} label={label} />
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** One label over time: a grid of its photos, newest first, captioned by date. */
export function PhotoPoseGrid({
  photos,
  labelName,
  measurementFor,
}: {
  photos: readonly ReadyPhoto[];
  labelName: string;
  measurementFor: MeasurementFor;
}) {
  return (
    <ul
      aria-label={`${labelName} photos`}
      className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"
    >
      {photos.map((photo) => (
        <li key={photo.id} className="min-w-0">
          <PhotoTile
            photo={photo}
            name={`${labelName}, ${photoDateLabel(photo.takenOn)}`}
            caption={<time dateTime={photo.takenOn}>{photoDateLabel(photo.takenOn)}</time>}
            detail={
              <PhotoMeasurementText
                measurement={measurementFor(photo.takenOn)}
                date={photo.takenOn}
                className="text-xs text-muted-foreground tabular-nums"
              />
            }
          />
        </li>
      ))}
    </ul>
  );
}
