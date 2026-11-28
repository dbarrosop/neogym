# Private progress photos — backend API

These endpoints are available to signed-in users once deployed. The web and signed-in iPhone clients expose them under **Progress › Body › Progress photos**. iPhone demo has separate offline, read-only photo screens for fictional samples. There are no Watch, widget or agent photo screens. Verify hosted privacy and operations before enabling production writes.

The web client has four screens:

- **Body card** (beside the measurements, under Log measurement): counts ready photos and shows their latest date taken through the same owner filter as the gallery, then up to four thumbnails from that date (front labels first), with **View all** and **Add photos**.
- **Gallery** (`/progress/body/photos`): a contact sheet with one row per date taken, newest first, and one column per label used by the loaded photos, in display order, so a label lines up down the page. A missing label on a date is a dashed **Add** slot that opens the check-in form on that date with that label outlined; several uploads of one label on a date show their count and open the newest. Each row shows that date's weight and body fat when a measurement exists for the same date. Label chips (kept in `?label=`, so Back preserves them) switch to one label's photos over time. “Load older photos” appends by the full server sort key and merges any continued date into the existing row.
- **Photo viewer** (`/progress/body/photos/$photoId`): the label as title, the date and same-day measurement, **Older**/**Newer** within the label (also the arrow keys and horizontal swipes; stepping replaces the history entry, so Back returns to the gallery), **Edit** (a dialog for the label and date, with the photo visible), **Compare**, and Delete at the end of the page. A photo already in a loaded list (gallery pages, the label's history or a date) renders at once from that row while it revalidates, so stepping keeps the viewer and its focus; a failed delete's error stays with its own photo.
- **Compare** (`/progress/body/photos/compare?label=&from=&to=`): two photos of one label, oldest first; by default the oldest and newest. Opened from the viewer (which passes `from`), it shows that photo against the newest, or the oldest against it when the opened photo is the newest. Side by side from 768 px, a before/after slider below. It shows the days between and, when the two photos resolve to different readings (each the latest within seven days up to its date), the weight and body-fat change (neutral colours: no goal is implied). Photos that fall back to the same reading show no change, because none was measured between them.

**Check-in** (`/progress/body/photos/new?date=&label=`) takes one date and one drop zone per catalog label. Each chosen photo is prepared, then uploaded one after another as its own immutable reservation-and-upload attempt; a failed upload is retried with its original reservation, the others are not repeated, and the date locks once an upload starts. While the form is open, a file dragged anywhere a slot hasn't accepted it (a busy slot, the gaps) is refused rather than opened in the tab, which would discard the draft. Labels display in a fixed client order (front, side, back, then others), since Hasura enum tables can't store one. The older/newer list and compare read up to 500 photos of one label (`POSE_HISTORY_LIMIT`).

The web filters and forms accept values from the current server catalog even if a value is newer than the generated client types. Attempts live only in the check-in form's component state; after a lost reservation response that photo can't be retried in the form, and the user must leave it before choosing to start a new submission. Browser uploads read JPEG, PNG and supported HEIC stills up to 25 MiB, 40 megapixels and 12,000 px per edge, check declared dimensions before decode, and re-encode oriented pixels to a JPEG up to 2,560 px per edge and 5 MiB without source metadata. Incompatible HEIC files must be exported to JPEG or PNG.

Photo requests are client-only. GraphQL goes through the app's `gqlRequest` and bytes through the SDK's `nhost.storage` client (`uploadFiles`, `getFile`, `deleteFile`), all with `cache: "no-store"`; the SDK attaches the bearer token and refreshes the session as for every other request. Gallery tiles load near the viewport through a private Storage transform (`w=480&h=600`); the viewer fetches the original prepared JPEG.

The web app keeps photo rows and image bytes only in its in-memory query cache, under owner-scoped `progress_photos` keys (`photoKeys` in `frontend/src/lib/progress-photos/api.ts`). Returning to the gallery reuses loaded pages and thumbnails; image bytes are never refetched because files are not replaced, and inactive entries are evicted after the cache's usual five minutes. Uploads, edits and deletes invalidate rows (a delete drops every cached photo list, so none shows the deleted photo while reloading, and forgets its row and bytes once the viewer has unmounted). `PhotoCacheGuard`, mounted at the root, drops every entry that isn't the signed-in user's on sign-out and account switches, cancelling in-flight reads; the photo routes remount per user, so drafts don't carry over. Object URLs belong to the component that displays them and are revoked on unmount. Leaving the check-in form aborts its in-flight preparation or upload; the browser may suspend work in a hidden tab, and this is not a background upload queue. Hiding the tab or `pagehide` does not clear anything: on a real unload the page's memory is released, and a back-forward cache restore returns the same signed-in user to the same page. The app's service worker does not cache photo API traffic.

## iPhone client

- **Body card:** sits below the Body fat chart (or below Weight if only that
  chart is present) and shows the ready-photo count, latest date taken and up to
  four thumbnails in angle order. **View all** and **Add photos** remain
  available without measurement data.
- **Gallery:** shows date cards with the same front/side/back angle order as
  web. A filled slot opens its newest upload and shows the count for
  duplicates; a dashed Add slot opens that date with its angle highlighted.
  Selecting an angle shows individual photos, including duplicates. **Load
  older photos** appends 16 ready records by the full server cursor and
  continues the same date card across pages. Back to the same gallery preserves
  the angle, not the loaded photos. A fresh gallery starts at All photos;
  pull-to-refresh starts at the newest page.
- **Viewer:** fits the original without cropping inside a fixed 4:5 detail slot,
  with dedicated space for measurements and Older/Newer controls. Those buttons
  change the selection in place rather than pushing a new route or reopening the
  detail query; the detail page has no photo swipe gesture. Tap the photo for a full-screen view with no visible
  controls and an overlay with angle, date, weight, body fat and position in
  the angle's history. Swipe left or right to step through that history;
  swipe up or down to return to the photo now shown, without adding Back
  entries. VoiceOver also offers Older, Newer and Close actions. Edit uses
  a pushed native Cancel/Save form for the date and angle only. Delete stays
  at the end of the detail with a system confirmation dialog.
- **Compare:** uses the phone-sized before/after slider and native date
  pickers for two photos of one angle. It shows the days between and neutral
  changes for metrics with two distinct readings. As on the web, the
  measurement for each date can fall back by up to seven days; sharing one
  reading produces no change. Viewer navigation and comparison read up to
  500 photos per angle. Measurement reads are scoped to the relevant dates
  and never trigger HealthKit or change a reading.
- **Check-in:** uses one date (local today by default) and one native
  PhotosPicker per catalog angle. It uploads prepared slots one at a time
  with separate immutable reservations. Each upload has a 45-second idle timeout
  and a five-minute total budget; other photo requests still have a 45-second
  total budget. The date locks when uploads start;
  retry reuses the original reservation and never repeats a successful
  slot. A lost reservation response cannot be retried in the same form.
  Completing the check-in or tapping Done after partial success opens the
  gallery. Separate check-ins may still share an angle and date.

**Demo:** the same Body card, gallery, viewer and Compare use a separate repository.
It serves five read-only samples on three fictional check-in dates, using the
demo store's prepared date and matching Body measurements. The three bundled
480 × 600 PNGs use the [web gallery's SVG artwork](../../frontend/scripts/gallery/progress-photos.ts):
the original blue and amber palettes and a green variant, not photographs of
people. Demo never opens PhotosPicker, writes photos, or reads live photo data
or credentials. See the [demo walkthrough](../ios/README.md#demo-progress-photos).

The system PhotosPicker transfers one provider-owned file per slot without
requesting library-wide permission. The app reads at most 25 MiB plus an
overflow byte; it accepts JPEG, PNG and common HEIC/HEIF stills and checks
dimensions (40 megapixels, 12,000 px per edge) before decoding. ImageIO orients
and resamples into a fresh JPEG up to 2,560 px per edge and 5 MiB without copying
source metadata. There is no app-owned media file, persistent photo cache or
background queue. Visible thumbnails load 480 × 600 Storage transforms, at most
three at a time on the active surface.

Metadata and drafts stay in the active photo surface's memory. A bounded decoded
image cache (48 MiB, up to 48 entries) belongs to the current iPhone account
shell, so the Body card, gallery, detail, full screen and Compare can reuse
pixels while foregrounded. Thumbnail and original entries have separate keys
and validators; the detail can start from the same photo's thumbnail while
loading a larger preview. Originals decode to at most 1,600 pixels per edge for
display; the upload is unchanged. The active viewer opportunistically warms its
immediate neighbors. On reuse within 30 seconds of a successful validation the
image needs no second request. On an older hit the image displays while an
authenticated Storage GET revalidates with `If-None-Match` if an ETag was
provided. A 304 keeps the same decoded image; a successful 200 replaces it,
and an unsuccessful validation evicts the image instead of offering stale
fallback. Source data, visual previews and validators are never written to disk.
Deletion evicts both renditions and prevents an in-flight load of that photo
from publishing. Sign-out, account changes and actual backgrounding clear or
retire photo work and the cache. Memory pressure purges the cache without
stopping still-visible loads; those older loads cannot repopulate it.

HTTPS requests bypass Foundation caching and the SDK's persistent GraphQL
cache, disable redirects, and use only the matching SDK-managed bearer. Route
cancellation can stop waiting for an issued SDK refresh without discarding a
rotated token. Navigation and tab changes retire photo work and drafts; actual
backgrounding also closes full screen. Scene deactivation covers the content
early for the App Switcher; a transient inactive PhotosPicker keeps its host.
Returning from background re-reads the current browse screen and does not
restore a create/edit draft. A write already received by the server may finish:
check the gallery before starting over. Verify real HEIC transfers and App Switcher snapshots on
physical iPhone before publication; simulator behavior is not device acceptance.

## Reserve, upload, read

1. On explicit submit, call `insertProgressPhoto(object: { labelValue: front_a, takenOn: "2024-02-29" }) { id }`. The backend assigns a UUID and presets the signed-in owner. `labelValue` uses the Hasura enum `progressPhotoLabel_enum` (`front_a`, `front_b`, `back_a`, `back_b`) for reads, writes, and filters. Read `label { value comment }` on a photo to get its catalog row; the admin-managed `progressPhotoLabels` query returns all catalog rows. Display order is a client choice. After changing enum values, reload Hasura metadata and regenerate client types. `takenOn` is a calendar date (`YYYY-MM-DD`, years 0001–9999), independent of upload time. Separate reservations can share a date and label.
2. Send one file to authenticated Storage `POST /v1/files` with `bucket-id=progress_photos`, multipart `file[]` named `progress-photo.jpg`, and a `metadata[]` part containing `{"id":"<reservation UUID>"}`. Use the canonical lowercase, hyphenated ID exactly as returned. Storage accepts only a current, unused reservation owned by the uploader; its insert permission follows the reservation relationship, and the database binds and locks the reservation before any bytes are written. The reservation expires after one hour if unused. Storage checks MIME from bytes and accepts 1 byte–5 MiB. Official clients must re-encode without source metadata; a JPEG MIME check neither validates a full decode nor strips EXIF.
3. A Storage response with that ID and `isUploaded: true` in `processedFiles` confirms the upload. No link mutation is needed. `progressPhoto(id: ...) { file { id isUploaded } }` reports a missing file before initialization, a pending file during upload, and a ready file after completion. List only ready photos with `where: { file: { isUploaded: { _eq: true } } }`; page by `(takenOn DESC, createdAt DESC, id DESC)`, continuing strictly after the entire last tuple. To correct the date or label, call `updateProgressPhoto` with `takenOn` or `labelValue`; the owner and file association are immutable to app users.

If an upload response is lost, read the reservation before retrying: a ready file is success, a pending file can be polled within a bounded budget, and an existing reservation with no file can retry with its original ID. A missing reservation cannot be reused. If a reserve response is lost before the app knows its ID, the unused reservation will expire; do not silently create another submission. On cancel, leave unused reservations to expire and don't delete an in-flight upload.

## Private reads and deletion

The dedicated bucket requests `Cache-Control: private, no-store` and disables presigning. Photo rows are filtered by reservation owner. GraphQL file reads and Storage GET/HEAD/transforms are filtered by the stored uploader ID. Nothing grants access to other users or the public. Public reads of `exercise_images` are unchanged. A delegated credential with the ordinary `user` role has the same access for its owner.

Account deletion nulls the reservation owner and hides the photo row immediately. File read and delete permissions do not check whether the uploader still has an Auth account. An already-issued access token can still read or delete that uploader's files until the token expires (access tokens are configured for 15 minutes) or the deleted-owner cleanup removes the file row, whichever comes first. Immediate revocation of Storage file access remains a release gate.

There is no app-role file update or replacement. The generic `insertFile` mutation can initialize a pending file for a valid reservation but cannot set `isUploaded`, the file owner, `etag` or custom metadata. It cannot make a photo ready. The bucket enforces the 1 byte–5 MiB range on Storage REST uploads; the GraphQL insert permission does not enforce that range on the declared `size`. Apps should send bytes via Storage REST, not a generic GraphQL file mutation.

After confirmation, delete a completed photo with authenticated `DELETE /v1/files/<id>`. The Storage row deletion cascades to the reservation. Reconcile an uncertain response by checking the photo and offer retry if it's still visible. Generic GraphQL `deleteFile` removes metadata and relies on Storage's asynchronous byte cleanup; no app role deletes reservation rows directly. A 404 or missing record confirms inaccessibility, not physical deletion.

## PostgreSQL cleanup

- `neogym-progress-photo-expiry` runs daily at midnight in the `pg_cron` timezone (UTC by default). It removes reservations older than one hour with no file, and Storage rows of the same age that are incomplete or have no associated reservation. A reservation can no longer be used for a new upload after one hour, even if its row has not yet been removed. The job preserves completed photos with a reservation.
- `neogym-progress-photo-deleted-owners` runs daily at 00:05 in the same timezone. It deletes file rows whose uploader no longer exists and reservations with neither an owner nor a file. Both jobs are scoped to progress photos.

Postgres `DELETE` on `storage.files` queues cleanup through Storage's existing `storage.files_to_delete` trigger. The jobs have no webhook, application secret or object-store client. Ordinary queue drain is an accepted provider assumption, not a removal SLA. Storage 0.17.0 can leave bytes if a noncanonical request ID is used as the object key, or if an in-flight object write finishes after incomplete-file deletion and queue acknowledgement. Neither case restores access; use the server-issued canonical ID and reconcile pending uploads instead of deleting them.

On the hosted target, check real bearer isolation through the CDN (including an owner-warmed transformed response and a repeated `If-None-Match` request from a different user), private cache headers, owner 304 responses for originals and thumbnails, presign denial, both jobs in `cron.job_run_details`, ordinary Storage queue behavior and deletion with independent byte checks. A successful cron run only shows that the SQL ran. Backup retention is separate from live-object cleanup.

## Catalog migration and rollback

`1795597220000_progress_photo_labels_ab` moves existing `front` and `back` reservations (including pending uploads) to `front_a` and `back_a`, without changing owners, dates, or linked files. Rollback maps both A and B variants back to their original `front`/`back` labels without deleting photos; it loses the A/B distinction. Reload the Hasura enum metadata and refresh the GraphQL proxy when applying or rolling back the migration. Clients should use catalog values rather than hard-coded labels.

## Backend rollback

Close photo reservation and file inserts first. Keep cleanup running while you purge the dedicated bucket with authorization, drain queued deletes, and independently verify byte absence. Apply matching Hasura metadata without the photo tables and permissions. Roll back the label migration before rolling back `1795597210000_progress_photo_writes`, which refuses to stop cleanup while progress file rows exist. It then removes the Storage triggers and only the two NeoGym jobs, leaving the shared `pg_cron` extension installed. Roll back `1795597200000_progress_photos` next to remove the reservation table, label enum table, and bucket. Do not reset existing developer volumes to validate the migrations.
