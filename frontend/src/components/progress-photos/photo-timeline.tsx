import { Link } from "@tanstack/react-router";
import { photosByDate, type ReadyPhoto } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import { photoLabelName } from "./photo-fields";
import { PhotoImage } from "./photo-image";

export function PhotoTimeline({ photos }: { photos: ReadyPhoto[] }) {
  return (
    <ol aria-label="Progress photos" className="border-t">
      {photosByDate(photos).map(([date, items]) => {
        const dateLabel = photoDateLabel(date);
        return (
          <li key={date} className="grid border-b md:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="relative flex items-baseline gap-x-3 pl-5 pt-4 md:col-start-2 md:row-start-1 md:flex-col md:gap-y-1 md:border-l md:pt-5">
              <span
                aria-hidden="true"
                className="absolute top-6 left-0 size-2 rounded-full bg-link md:top-7 md:-translate-x-1/2 md:ring-4 md:ring-background"
              />
              <h2 className="font-semibold">
                <time dateTime={date}>{dateLabel}</time>
              </h2>
              <span className="text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? "photo" : "photos"}
              </span>
            </div>
            <ul
              aria-label={`Photos from ${dateLabel}`}
              className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] items-start gap-3 py-4 md:col-start-1 md:row-start-1 md:py-5 md:pr-6"
            >
              {items.map((photo) => (
                <li key={photo.id} className="min-w-0">
                  <Link
                    to="/progress/body/photos/$photoId"
                    params={{ photoId: photo.id }}
                    preload={false}
                    className="block overflow-hidden rounded-xl border bg-card hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <PhotoImage id={photo.file.id} thumbnail alt="" />
                    <p className="px-3 py-2 text-sm font-medium wrap-anywhere">
                      {photoLabelName(photo.label)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
