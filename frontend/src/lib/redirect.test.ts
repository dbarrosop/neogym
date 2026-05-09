import { describe, expect, it } from "bun:test";
import { isSafeInternalRedirect } from "./redirect";

describe("isSafeInternalRedirect", () => {
  it("accepts a normal absolute internal path", () => {
    expect(isSafeInternalRedirect("/profile")).toBe(true);
    expect(isSafeInternalRedirect("/workouts/123")).toBe(true);
    expect(isSafeInternalRedirect("/sessions/new?from=home")).toBe(true);
    expect(isSafeInternalRedirect("/")).toBe(true);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isSafeInternalRedirect("//evil.com")).toBe(false);
    expect(isSafeInternalRedirect("//evil.com/profile")).toBe(false);
  });

  it("rejects backslash-prefixed paths the browser resolves as external", () => {
    expect(isSafeInternalRedirect("/\\evil.com")).toBe(false);
    expect(isSafeInternalRedirect("/\\\\evil.com")).toBe(false);
  });

  it("rejects absolute external URLs", () => {
    expect(isSafeInternalRedirect("https://evil.com")).toBe(false);
    expect(isSafeInternalRedirect("http://evil.com/profile")).toBe(false);
  });

  it("rejects javascript: and data: scheme URLs", () => {
    expect(isSafeInternalRedirect("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalRedirect("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects relative paths and empty input", () => {
    expect(isSafeInternalRedirect("profile")).toBe(false);
    expect(isSafeInternalRedirect("./profile")).toBe(false);
    expect(isSafeInternalRedirect("../profile")).toBe(false);
    expect(isSafeInternalRedirect("")).toBe(false);
  });
});
