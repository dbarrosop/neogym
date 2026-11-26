import type { APIRequestContext } from "@playwright/test";

// Deliberately not configurable: capture must never seed a cloud project.
export const LOCAL_GRAPHQL = "https://local.graphql.local.nhost.run/v1";
export const LOCAL_AUTH = "https://local.auth.local.nhost.run/v1";
export const LOCAL_MAIL = "https://local.mailhog.local.nhost.run";
export const LOCAL_STORAGE = "https://local.storage.local.nhost.run/v1";

export function captureOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid gallery origin");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Gallery requires an http://127.0.0.1:PORT origin (no path or credentials)");
  }
  return url.origin;
}

interface Envelope<T> {
  data?: T;
  errors?: { message: string }[];
}

export class CaptureBackend {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await this.request.post(LOCAL_GRAPHQL, {
      headers: { authorization: `Bearer ${this.token}` },
      data: { query, variables },
    });
    if (!response.ok()) {
      throw new Error(`Local gallery GraphQL returned HTTP ${response.status()}`);
    }
    const result = (await response.json()) as Envelope<T>;
    if ((result.errors?.length ?? 0) > 0 || !result.data) {
      // No variables, response bodies or credentials enter published evidence.
      throw new Error(
        `Local gallery GraphQL operation failed: ${result.errors?.map((error) => error.message).join("; ") ?? "missing data"}`,
      );
    }
    return result.data;
  }
}

interface MailMessage {
  To: { Mailbox: string; Domain: string }[];
  Content: { Headers: Record<string, string[]>; Body: string };
}

const OTP_PATTERN = /\b(\d{6})\b/;
const OTP_HTML = />\s*(\d{6})\s*</;
const QUOTED_PRINTABLE_SOFT_BREAK = /=\r?\n/g;
const QUOTED_PRINTABLE_BYTE = /=([0-9a-f]{2})/gi;

export function otpFromMail(subject: string, body: string): string | null {
  const decoded = body
    .replace(QUOTED_PRINTABLE_SOFT_BREAK, "")
    .replace(QUOTED_PRINTABLE_BYTE, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  // A generic six-digit search in HTML mistakes colors such as #484848 for
  // credentials. The local template puts the ticket alone in an HTML element.
  return OTP_PATTERN.exec(subject)?.[1] ?? OTP_HTML.exec(decoded)?.[1] ?? null;
}

export async function readOTP(
  request: APIRequestContext,
  email: string,
  deadline = Date.now() + 30_000,
): Promise<string> {
  const response = await request.get(`${LOCAL_MAIL}/api/v2/messages?limit=100`);
  if (!response.ok()) {
    throw new Error(`Local MailHog returned HTTP ${response.status()}`);
  }
  const messages = (await response.json()) as { items: MailMessage[] };
  for (const message of messages.items) {
    if (!message.To.some((to) => `${to.Mailbox}@${to.Domain}` === email)) {
      continue;
    }
    const subject = message.Content.Headers["Subject"]?.join(" ") ?? "";
    const code = otpFromMail(subject, message.Content.Body);
    if (code) {
      return code;
    }
  }
  if (Date.now() >= deadline) {
    throw new Error("No OTP arrived for the new local capture account");
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  return readOTP(request, email, deadline);
}
