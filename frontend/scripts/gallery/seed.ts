import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { mkdir, rmdir } from "node:fs/promises";
import { resolve } from "node:path";
import profile from "./profile.json";

const CONTAINER_ID = /^[0-9a-f]{12,64}$/;
const CONFIG_LABEL = '{{ index .Config.Labels "com.docker.compose.project.config_files" }}';
const POSTGRES =
  'psql -Xq --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file=- "$@"';

export const galleryDate = profile.now.slice(0, 10);

function docker(args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf8", timeout: 15_000 }).trim();
}

/** Resolve only this checkout's local Nhost database; never accept a user-supplied target. */
export function galleryPostgres(repo: string): string {
  const endpoint =
    (!process.env["DOCKER_CONTEXT"] && process.env["DOCKER_HOST"]) ||
    docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  if (!endpoint.startsWith("unix://")) {
    throw new Error("Gallery fixtures require a local Docker socket");
  }
  const config = realpathSync(resolve(repo, "backend/.nhost/docker-compose.yaml"));
  const id = docker([
    "compose",
    "-f",
    config,
    "--project-directory",
    resolve(repo, "backend"),
    "ps",
    "-q",
    "postgres",
  ]);
  if (!CONTAINER_ID.test(id) || docker(["inspect", "--format", CONFIG_LABEL, id]) !== config) {
    throw new Error("Start this checkout's local Nhost stack before resetting the gallery fixture");
  }
  return id;
}

export function seedGalleryAccount(container: string): void {
  const { account, energyUpdatedTime } = profile;
  const variables = {
    user_id: account.id,
    email: account.email,
    display_name: account.displayName,
    created_at: account.createdAt,
    marker: account.marker,
    today: galleryDate,
    energy_time: energyUpdatedTime,
  };
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "sh",
      "-c",
      POSTGRES,
      "gallery-seed",
      ...Object.entries(variables).map(([key, value]) => `--set=${key}=${value}`),
    ],
    {
      input: readFileSync(new URL("./seed.sql", import.meta.url)),
      stdio: ["pipe", "ignore", "inherit"],
      timeout: 30_000,
    },
  );
}

/** Both layouts reuse the reserved account serially. Guard against overlapping captures. */
export async function lockGallery(repo: string): Promise<() => Promise<void>> {
  const parent = resolve(repo, ".nhost-code/tmp");
  const lock = resolve(parent, "web-gallery.lock");
  await mkdir(parent, { recursive: true });
  try {
    await mkdir(lock);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`Gallery capture is already locked: ${lock}`);
    }
    throw error;
  }
  return () => rmdir(lock);
}
