import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { ProgressPhotoLabel_Enum } from "@/gql/graphql";
import { galleryWhere, type Photo } from "./api";
import { PhotoUploadAttempt } from "./attempt";
import { photoDateLabel, validPhotoDate } from "./date";
import { inspectImage } from "./image-headers";
import { stripJpegMetadata } from "./jpeg";

const id = "558e5143-0f20-4014-970e-50ed9e0a32a8";
const fields = { label: ProgressPhotoLabel_Enum.FrontA, date: "2024-02-29" };
const photo: Photo = {
  id,
  takenOn: fields.date,
  createdAt: "2026-11-25T10:00:00.123456+00:00",
  label: { value: fields.label, comment: "Front A" },
  file: null,
};
const pending: Photo = { ...photo, file: { id, isUploaded: false } };
const ready: Photo = { ...photo, file: { id, isUploaded: true } };

function protocol(overrides: {
  reserve?: () => Promise<string>;
  upload?: (id: string) => Promise<boolean>;
  read?: () => Promise<Photo | null>;
}) {
  const controller = new AbortController();
  const calls: string[] = [];
  const bytes = new Blob(["test"]);
  const attempt = new PhotoUploadAttempt(
    {
      reserve: (input) => {
        calls.push("reserve");
        expect(input).toEqual(fields);
        return overrides.reserve?.() ?? Promise.resolve(id);
      },
      upload: (sent, jpeg) => {
        calls.push("upload");
        expect(sent).toBe(id);
        expect(jpeg).toBe(bytes);
        return overrides.upload?.(sent) ?? Promise.resolve(false);
      },
      read: (sent) => {
        calls.push("read");
        expect(sent).toBe(id);
        return overrides.read?.() ?? Promise.resolve(photo);
      },
    },
    controller.signal,
    fields,
    bytes,
    [1, 1],
  );
  return { calls, attempt, controller };
}

describe("progress photo reservation", () => {
  test("never reserves again when the first reservation response is lost", async () => {
    const { calls, attempt } = protocol({ reserve: () => Promise.reject(new Error("network")) });
    expect((await attempt.run()).status).toBe("stopped");
    expect((await attempt.run()).status).toBe("stopped");
    expect(calls).toEqual(["reserve"]);
  });

  test("probes a lost upload and retries bytes only with the original unused reservation", async () => {
    let uploads = 0;
    const { calls, attempt } = protocol({ upload: () => Promise.resolve(++uploads > 1) });
    expect((await attempt.run()).status).toBe("retry");
    expect(await attempt.run()).toEqual({ status: "ready", id });
    expect(calls).toEqual(["reserve", "upload", "read", "read", "upload"]);
  });

  test("polls pending uploads without uploading and recognizes a completed file", async () => {
    let reads = 0;
    const { calls, attempt } = protocol({
      read: () => Promise.resolve(++reads < 4 ? pending : ready),
    });
    expect((await attempt.run()).status).toBe("retry");
    expect(await attempt.run()).toEqual({ status: "ready", id });
    expect(calls).toEqual(["reserve", "upload", "read", "read", "read", "read"]);
  });

  test("a vanished reservation does not start over, even after a network retry", async () => {
    let reads = 0;
    const { calls, attempt } = protocol({
      read: () => (++reads === 1 ? Promise.reject(new Error("network")) : Promise.resolve(null)),
    });
    expect((await attempt.run()).status).toBe("retry");
    expect((await attempt.run()).status).toBe("stopped");
    expect((await attempt.run()).status).toBe("stopped");
    expect(calls).toEqual(["reserve", "upload", "read", "read"]);
  });

  test("duplicate submit or owner invalidation cannot upload a delayed reservation", async () => {
    const deferred = Promise.withResolvers<string>();
    const { calls, attempt, controller } = protocol({ reserve: () => deferred.promise });
    const first = attempt.run();
    expect((await attempt.run()).status).toBe("retry");
    controller.abort();
    deferred.resolve(id);
    await expect(first).rejects.toThrow();
    await expect(attempt.run()).rejects.toThrow();
    expect(calls).toEqual(["reserve"]);
  });
});

test("the next page preserves the exact local date, timestamp precision and UUID tie-break", () => {
  expect(galleryWhere("owner", fields.label, photo)).toEqual({
    userId: { _eq: "owner" },
    labelValue: { _eq: fields.label },
    file: { isUploaded: { _eq: true } },
    _or: [
      { takenOn: { _lt: fields.date } },
      { takenOn: { _eq: fields.date }, createdAt: { _lt: photo.createdAt } },
      { takenOn: { _eq: fields.date }, createdAt: { _eq: photo.createdAt }, id: { _lt: id } },
    ],
  });
});

test("dates enforce Gregorian calendar dates through local today without shifting the day", () => {
  const today = "2024-03-01";
  expect(validPhotoDate(today, today)).toBe(true);
  expect(validPhotoDate("0001-01-01", today)).toBe(true);
  expect(validPhotoDate("2024-02-29", today)).toBe(true);
  for (const date of ["2023-02-29", "2024-04-01", "0000-01-01", "2024-2-29", "infinity"]) {
    expect(validPhotoDate(date, today)).toBe(false);
  }
  expect(photoDateLabel(fields.date)).toBe(
    new Intl.DateTimeFormat(undefined, {
      timeZone: "UTC",
      dateStyle: "medium",
    }).format(Date.UTC(2024, 1, 29, 0)),
  );
});

test("image signatures and declared header dimensions are checked before decode", () => {
  const jpeg = Uint8Array.of(255, 216, 255, 192, 0, 8, 8, 0, 8, 0, 16, 1);
  expect(inspectImage(jpeg.buffer)).toBe("image/jpeg");
  jpeg[7] = 255;
  expect(() => inspectImage(jpeg.buffer)).toThrow("40 megapixels");
  const png = Uint8Array.of(
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    0,
    0,
    0,
    13,
    73,
    72,
    68,
    82,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    8,
  );
  expect(inspectImage(png.buffer)).toBe("image/png");
  png[20] = 128;
  expect(() => inspectImage(png.buffer)).toThrow("40 megapixels");
  expect(() => inspectImage(new ArrayBuffer(80))).toThrow("JPEG, PNG");
});

test("canonical JPEG keeps coding data, not application/comment segments or appended bytes", async () => {
  const fixture = Uint8Array.of(
    0xff,
    0xd8, // Start of image
    0xff,
    0xe1,
    0,
    3,
    42, // Application metadata
    0xff,
    0xda,
    0,
    3,
    10,
    22,
    0xff,
    0,
    0xff,
    0xd0,
    8, // Scan incl. stuffed byte and restart
    0xff,
    0xfe,
    0,
    3,
    43, // Comment
    0xff,
    0xd9,
    99, // End of image and stray data
  );
  const jpeg = stripJpegMetadata(fixture.buffer);
  expect(jpeg.type).toBe("image/jpeg");
  expect(new Uint8Array(await jpeg.arrayBuffer())).toEqual(
    Uint8Array.of(0xff, 0xd8, 0xff, 0xda, 0, 3, 10, 22, 0xff, 0, 0xff, 0xd0, 8, 0xff, 0xd9),
  );
});

test("progress photo route, gallery and owner lifetime in an isolated DOM", () => {
  const fixture = fileURLToPath(
    new URL("../../../scripts/progress-photos.fixture.tsx", import.meta.url),
  );
  const result = Bun.spawnSync([process.execPath, fixture], {
    env: { ...process.env, TZ: "Pacific/Honolulu" },
    timeout: 10_000,
  });
  if (result.exitCode !== 0) {
    throw new Error(`${result.stdout.toString()}${result.stderr.toString()}`);
  }
}, 12_000);
