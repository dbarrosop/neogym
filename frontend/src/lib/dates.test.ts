import { describe, expect, it } from "bun:test";
import { formatDateLong, formatDateShort, parseDateOnly, todayLocalISO } from "./dates";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("parseDateOnly", () => {
  it("parses a valid YYYY-MM-DD into a local Date", () => {
    const d = parseDateOnly("2025-09-04");
    expect(d).not.toBeNull();
    // Constructed via `new Date(y, m - 1, d)` so the components are local, not UTC.
    // This is the whole point of the helper — guarding against the UTC-midnight
    // shift that would render Sep 4 as Sep 3 for users west of UTC.
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(4);
  });

  it("returns null for empty input", () => {
    expect(parseDateOnly("")).toBeNull();
  });

  it("returns null for non-date strings", () => {
    expect(parseDateOnly("not-a-date")).toBeNull();
    expect(parseDateOnly("2025/09/04")).toBeNull();
    expect(parseDateOnly("hello")).toBeNull();
  });

  it("returns null when any component is missing or zero", () => {
    expect(parseDateOnly("2025-09")).toBeNull();
    expect(parseDateOnly("2025")).toBeNull();
    expect(parseDateOnly("0000-09-04")).toBeNull();
    expect(parseDateOnly("2025-00-04")).toBeNull();
    expect(parseDateOnly("2025-09-00")).toBeNull();
  });

  it("returns null when a component fails to parse as a number", () => {
    expect(parseDateOnly("2025-09-04T00:00:00")).toBeNull();
    expect(parseDateOnly("abcd-ef-gh")).toBeNull();
  });
});

describe("formatDateLong", () => {
  it("returns a non-empty formatted string for a valid date", () => {
    const out = formatDateLong("2025-09-04");
    expect(out.length).toBeGreaterThan(0);
    // Locale-dependent text, but the year should always appear somewhere.
    expect(out).toContain("2025");
  });

  it("returns the input verbatim when parsing fails", () => {
    expect(formatDateLong("not-a-date")).toBe("not-a-date");
    expect(formatDateLong("")).toBe("");
  });
});

describe("formatDateShort", () => {
  it("returns a non-empty formatted string for a valid date", () => {
    const out = formatDateShort("2025-09-04");
    expect(out.length).toBeGreaterThan(0);
  });

  it("returns the input verbatim when parsing fails", () => {
    expect(formatDateShort("not-a-date")).toBe("not-a-date");
    expect(formatDateShort("")).toBe("");
  });
});

describe("todayLocalISO", () => {
  it("returns today's date as YYYY-MM-DD", () => {
    const out = todayLocalISO();
    expect(out).toMatch(ISO_DATE_RE);
    // Round-trip through parseDateOnly: today's local components should match.
    const parsed = parseDateOnly(out);
    const now = new Date();
    expect(parsed?.getFullYear()).toBe(now.getFullYear());
    expect(parsed?.getMonth()).toBe(now.getMonth());
    expect(parsed?.getDate()).toBe(now.getDate());
  });
});
