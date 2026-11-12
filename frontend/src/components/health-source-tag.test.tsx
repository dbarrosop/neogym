import { describe, expect, it } from "bun:test";
import { HEALTH_IMPORT_NOTE, isHealthImport, visibleNotes } from "./health-source-tag";

describe("Apple Health source", () => {
  it("recognises the import note written by the iPhone and watch apps", () => {
    expect(isHealthImport(HEALTH_IMPORT_NOTE)).toBe(true);
    expect(isHealthImport(` ${HEALTH_IMPORT_NOTE} `)).toBe(true);
    expect(isHealthImport("Imported from Apple Health, then edited")).toBe(false);
    expect(isHealthImport(null)).toBe(false);
  });

  it("hides only the import marker from notes", () => {
    expect(visibleNotes(HEALTH_IMPORT_NOTE)).toBe("");
    expect(visibleNotes("After a long run")).toBe("After a long run");
    expect(visibleNotes(undefined)).toBe("");
  });
});
