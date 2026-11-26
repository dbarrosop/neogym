# Private progress photos — backend API

These endpoints are available to signed-in users once deployed, even without a UI. This phase adds no web, iPhone, Watch or agent photo screens. Verify hosted privacy and operations before enabling production writes.

## Reserve, upload, read

1. On explicit submit, call `insertProgressPhoto(object: { label: front, takenOn: "2024-02-29" }) { id }`. The backend assigns a UUID and presets the signed-in owner. The `label` field uses the Hasura enum `progressPhotoLabel_enum` (`front`, `back`); the admin-managed `progressPhotoLabels` query returns `value` and optional `comment` (Front and Back). Display order is a client choice. After changing enum values, reload Hasura metadata and regenerate client types. `takenOn` is a calendar date (`YYYY-MM-DD`, years 0001–9999), independent of upload time. Separate reservations can share a date and label.
2. Send one file to authenticated Storage `POST /v1/files` with `bucket-id=progress_photos`, multipart `file[]` named `progress-photo.jpg`, and a `metadata[]` part containing `{"id":"<reservation UUID>"}`. Use the canonical lowercase, hyphenated ID exactly as returned. Storage accepts only a current, unused reservation owned by the uploader; its insert permission follows the reservation relationship, and the database binds and locks the reservation before any bytes are written. The reservation expires after one hour if unused. Storage checks MIME from bytes and accepts 1 byte–5 MiB. Official clients must re-encode without source metadata; a JPEG MIME check neither validates a full decode nor strips EXIF.
3. A Storage response with that ID and `isUploaded: true` in `processedFiles` confirms the upload. No link mutation is needed. `progressPhoto(id: ...) { file { id isUploaded } }` reports a missing file before initialization, a pending file during upload, and a ready file after completion. List only ready photos with `where: { file: { isUploaded: { _eq: true } } }`; page by `(takenOn DESC, createdAt DESC, id DESC)`, continuing strictly after the entire last tuple. To correct the date or angle, call `updateProgressPhoto`; the owner and file association are immutable to app users.

If an upload response is lost, read the reservation before retrying: a ready file is success, a pending file can be polled within a bounded budget, and an existing reservation with no file can retry with its original ID. A missing reservation cannot be reused. If a reserve response is lost before the app knows its ID, the unused reservation will expire; do not silently create another submission. On cancel, leave unused reservations to expire and don't delete an in-flight upload.

## Private reads and deletion

The dedicated bucket requests `Cache-Control: private, no-store` and disables presigning. GraphQL photo and file reads and Storage GET/HEAD/transforms require the owner's bearer; the file permission also checks that the Auth account exists. Nothing grants access to other users or the public. Public reads of `exercise_images` are unchanged. A delegated credential with the ordinary `user` role has the same access for its owner.

There is no app-role file update or replacement. The generic `insertFile` mutation can initialize a pending file for a valid reservation but cannot set `isUploaded`, the file owner, `etag` or custom metadata. It cannot make a photo ready. The app should send bytes via Storage REST, not a generic GraphQL file mutation.

After confirmation, delete a completed photo with authenticated `DELETE /v1/files/<id>`. The Storage row deletion cascades to the reservation. Reconcile an uncertain response by checking the photo and offer retry if it's still visible. Generic GraphQL `deleteFile` removes metadata and relies on Storage's asynchronous byte cleanup; no app role deletes reservation rows directly. A 404 or missing record confirms inaccessibility, not physical deletion.

## PostgreSQL cleanup

- `neogym-progress-photo-expiry` runs daily at midnight in the `pg_cron` timezone (UTC by default). It removes reservations older than one hour with no file, and Storage rows of the same age that are incomplete or have no associated reservation. A reservation can no longer be used for a new upload after one hour, even if its row has not yet been removed. The job preserves completed photos with a reservation.
- `neogym-progress-photo-deleted-owners` runs daily at 00:05 in the same timezone. Auth deletion immediately nulls the reservation owner and revokes photo and file access, including through an otherwise valid old JWT. This job removes files whose uploader no longer exists and any reservation without an owner or file. Both jobs are scoped to progress photos.

Postgres `DELETE` on `storage.files` queues cleanup through Storage's existing `storage.files_to_delete` trigger. The jobs have no webhook, application secret or object-store client. Ordinary queue drain is an accepted provider assumption, not a removal SLA. Storage 0.17.0 can leave bytes if a noncanonical request ID is used as the object key, or if an in-flight object write finishes after incomplete-file deletion and queue acknowledgement. Neither case restores access; use the server-issued canonical ID and reconcile pending uploads instead of deleting them.

On the hosted target, check real bearer isolation through the CDN (including an owner-warmed transformed response), private cache headers, presign denial, both jobs in `cron.job_run_details`, ordinary Storage queue behavior and deletion with independent byte checks. A successful cron run only shows that the SQL ran. Backup retention is separate from live-object cleanup.

## Rollback

Close photo reservation and file inserts first. Keep cleanup running while you purge the dedicated bucket with authorization, drain queued deletes, and independently verify byte absence. Apply matching Hasura metadata without the photo tables and permissions. Roll back `1795597210000_progress_photo_writes` first: it refuses to stop cleanup while progress file rows exist, then removes the Storage triggers and only the two NeoGym jobs, leaving the shared `pg_cron` extension installed. Roll back `1795597200000_progress_photos` next to remove the reservation table, label enum table, and bucket. Do not reset existing developer volumes to validate the migrations.
