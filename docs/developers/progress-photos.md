# Progress photos

Progress photos are a private visual-progress stream, separate from Body measurements and workout Progress reports. The additive backend model is in migration `1793528798662_progress_photos`; the authoritative permissions are `public_progress_photos.yaml`, `public_progress_photo_labels.yaml` and `storage_files.yaml`.

## Rollout boundary

The owner-only Storage phase opens authenticated JPEG upload, private metadata/byte reads and exact-file deletion in `progress_photos`, through `storage_files.yaml`. Users cannot update file metadata or replace bytes in-place; replacement attaches a newly uploaded immutable file. Public exercise-image reads are unchanged. This is a **backend API boundary only**: no web/native gallery, upload UI or client image normalization is shipped yet. Backend permission application and live real-JWT verification must precede client rollout.

## Model

- `progress_photo_labels` is an admin-managed **table, not a Hasura enum**. The migration supplies stable IDs `front_1`, `front_2`, `back_1`, `back_2`, displayed as Front 1, Front 2, Back 1, Back 2 in that order. Clients read `name`, `position`, and `isActive` dynamically. Renames change current display names; there is no historical name snapshot.
- Label IDs cannot be updated. Operators must retire (`is_active = false`), not remove/reuse, published IDs. The label FK restricts deletion while referenced. Retired labels remain readable and may be retained on existing photos, including date corrections and image replacement; inserts and actual label changes require an active label. A catalog-row share lock serializes assignment with retirement.
- `progress_photos` has a generated UUID, non-null owner, `taken_on`, label/file FKs, creation/update timestamps and an integer `revision` starting at 1. A domain-table trigger makes ID/owner immutable, preserves creation time, and increments revision on every update, even a no-op or an admin-supplied revision.
- `(user_id, taken_on, label_id)` and `file_id` are independently unique. A slot collision must not overwrite an existing photo. A file cannot back two photos.
- `taken_on` is a local **date**, not a timestamp: ordinary finite Gregorian `0001-01-01` through `9999-12-31`, with no past/future policy. PostgreSQL rejects impossible calendar dates; the CHECK rejects infinities, BC and out-of-range years.
- Inserts and file-reference changes require an existing, completed (`is_uploaded = true`) file in `progress_photos` whose `uploaded_by_user_id` matches the photo owner. An admin REST upload has no uploader preset: integration fixtures explicitly set the uploader through admin GraphQL **after** uploading, rather than weakening this guard.

The bucket is additive: `private, no-store`, presigned URLs disabled, 1-byte minimum and 5 MiB maximum. Sniffed image MIME, successful decoding and EXIF removal are different guarantees; the model does not promise a server-authoritative sanitizer.

## GraphQL contract

CamelCase roots are `progressPhoto` / `progressPhotos` / `progressPhotosAggregate`, `insertProgressPhoto(s)` and `updateProgressPhoto(s)`. Catalog roots are `progressPhotoLabel` / `progressPhotoLabels`. Both tables have no public permissions. Catalog users select only, including retired rows. Photo users select/insert/update only their own rows; insert presets owner from the session, with only `takenOn`, `labelId`, `fileId` writable. ID, owner, timestamps and revision are never user-writable.

There is **no user domain-row delete permission**. Admin deletion exists for maintenance, not as the application lifecycle.

The official-client edit contract is `updateProgressPhotos(where: {id: {_eq: ...}, revision: {_eq: ...}, fileId: {_eq: ...}}, _set: {...})`, checking `affected_rows == 1`. Date, label and replacement reference change atomically. Zero rows means conflict, not success; clients must retain the displayed revision/file and re-read. Hasura's ordinary update roots do not require callers to supply a CAS predicate, so clients must not use the unconditional by-PK update for this workflow. The server owns the revision counter, not a client `_inc`.

## Owner Storage boundary

Storage REST authorizes through the caller's Hasura permissions. Upload initialization allows only `id`, `bucket_id`, `mime_type`, `name`, `size`, presets `uploaded_by_user_id` from the authenticated session, and checks progress bucket, own uploader and `image/jpeg`. Storage byte-sniffs MIME and checks actual multipart size against the bucket's 1-byte–5-MiB limit. Caller-supplied MIME does not establish ownership. Storage 0.15.1's admin `PopulateMetadata` completion write can persist caller-supplied custom `metadata` JSON as untrusted owner-private content, never authority for ownership or the photo date/label; official clients omit custom metadata. The service uses admin-only bucket lookup and upload-completion writes; users have no bucket writes or file update permission.

User file select is the unchanged exercise-image branch OR progress bucket plus own uploader. User file delete requires progress bucket plus own uploader. Anonymous/foreign progress reads and deletes must not expose or remove the owner's file. Owner GET, HEAD and transformed responses use both `Cache-Control: private, no-store` and `Surrogate-Control: private, no-store`; progress presigned URLs are disabled. Local headers do not establish production CDN behavior.

These permissions also expose direct GraphQL file insert/select/delete through Hasura and Constellation. A direct insert can create **incomplete metadata**, but cannot set uploader/completion/etag or finish an upload; the domain guard rejects attaching it. GraphQL MIME/size fields alone are declarations, not byte validation. Direct GraphQL file deletion is metadata-only and still cascades photo rows; it is not a byte-erasure API. Official clients must use Storage REST DELETE. Sniffed JPEG bytes are not proof of decoding, orientation correction or EXIF removal; those bounded client responsibilities remain unshipped.

## Authoritative deletion and limitations

`progress_photos.file_id → storage.files.id ON DELETE CASCADE` makes file **metadata** deletion and the photo-row deletion one SQL transaction. The normal FK serializes attach/delete races; there are no custom lifecycle triggers or locks on Storage-managed tables. A concurrent attach either commits before the cascade or fails, never creating a dangling row. A detached old file can be deleted without affecting a replacement row.

The chosen application deletion path is **Storage REST DELETE of the exact confirmed file ID**, not photo-row deletion. Replacement uses a new immutable file ID and revision/old-file CAS; only a confirmed successful replacement permits best-effort REST deletion of the old file. An uncertain write must not be compensated by deleting its staged file merely because a reconciliation read found no row: the earlier write may still commit and the cascade would destroy it. No worker, outbox, sweep or automatic reclamation is provided.

Storage deletes metadata before object bytes. S3 removal is not part of the SQL transaction; a later byte-delete error may leave unreadable bytes even though the photo is already gone. Error responses require reconciliation and are not proof of either row survival or byte erasure. A successful admin GET/404 checks API visibility, **not independent evidence of physical byte removal**.

Direct GraphQL/SQL metadata deletion bypasses Storage's byte deletion and still cascades photo rows. Bucket deletion or separately approved operator broken-metadata maintenance may also cascade them. Do not invoke global Storage cleanup from application code or tests. Only user-approved operator maintenance may remove leftovers.

`user_id → auth.users.id ON DELETE CASCADE` follows other private streams. Account deletion removes photo rows, but may leave private file metadata and/or object bytes; this feature neither redesigns account deletion nor blocks it. Do not promise complete erasure or automatic cleanup.

The down migration refuses a bucket containing **any** file metadata, including unattached or incomplete files, before destructive statements. An empty metadata bucket does not prove that S3 has no orphan bytes. Validate only the refusal block in a rollback-only probe on a populated fixture; do not run a destructive down/up cycle on a shared database without operator approval.

## Verification

`backend/tests/progress-photos.test.ts` uses isolated users, labels, dates and file UUIDs, admin REST upload/delete, explicit uploader assignment and scoped fixture cleanup. Direct admin `auth.users` fixtures must supply `locale` and `defaultRole`; unlike Auth signup, GraphQL does not fill these required fields. The suite covers owner presets/isolation via Hasura and Constellation, immutable inputs, finite dates, retired/unknown labels, duplicate slots/files, invalid attachments/replacements, revision CAS/races, metadata cascade, account-deletion leftovers, rollback refusal and unchanged exercise-image access. Unavailable services fail rather than skip.

Database-error presentation differs between the two endpoints: Hasura exposes the named constraint; Constellation may return only `internal server error (trace id: <uuid>)` without extensions. Endpoint-specific negative assertions must also verify unchanged persisted state, not treat a generic server error alone as authorization proof. Directly inserted incomplete file metadata can also produce a Storage GET/HEAD server error: the service's metadata DTO dereferences a nullable `etag` before checking completion. Do not grant users completion/etag writes to work around this; verify `isUploaded = false`, the rejected photo attachment and unchanged persisted state independently.

For independent local byte-removal evidence, verify a fresh fixture's exact object exists in MinIO before REST deletion and is absent afterward using scoped, read-only object-store inspection, alongside the file/photo metadata checks. The minimal local MinIO image may lack `find`; shell-builtin `test` probes against the exact fixture object directory and its `xl.meta` avoid extra tooling or namespace-wide operations. Do not substitute an authorization-filtered API 404 or run global cleanup. Keep local versions and probe results in execution evidence, not this durable contract.

`backend/tests/progress-photos-storage.test.ts` uses actual Auth-issued owner/other-user JWTs without admin-secret headers on tested requests. Admin-created, verified password fixtures bootstrap those sessions without changing the app's email-OTP flow. Repeated suite/probe runs share the local Auth rate limit and may receive 429; wait for the configured cooldown and rerun rather than disabling limits or skipping fixture setup. The suite covers forged session/uploader inputs, other buckets, spoofed/unsupported bytes, actual oversize uploads, incomplete GraphQL inserts, private GET/HEAD/transforms and cache headers, presigned/PUT denial, unchanged bytes/etag after denial, owner deletion/cascade, GraphQL metadata-delete scope and replacement/delete races. Fixture setup/state checks/cleanup remain administrative and exact-ID scoped; GraphQL delete tests use incomplete metadata with no S3 bytes to avoid creating leftovers.

Schema snapshots and TypeScript contracts must be regenerated through the full frontend `bun run codegen` pipeline after permission application; do not hand-edit them. The Storage gate must also prove live metadata matches YAML, public SDL is unchanged, and independently repeat owner REST byte-removal verification. Keep exact observed endpoint status/error contracts and local versions in execution evidence, not durable docs. Cloud/CDN privacy is not established by local tests.
