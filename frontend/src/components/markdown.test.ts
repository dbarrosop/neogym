import { describe, expect, it } from "bun:test";
import { stripMarkdown } from "./markdown";

describe("stripMarkdown", () => {
  it("leaves plain text untouched aside from whitespace collapse", () => {
    expect(stripMarkdown("A simple description.")).toBe("A simple description.");
  });

  it("strips heading markers (h1–h6)", () => {
    expect(stripMarkdown("# Title")).toBe("Title");
    expect(stripMarkdown("###### Tiny")).toBe("Tiny");
    expect(stripMarkdown("# Day 1\n## Warmup\nDo it")).toBe("Day 1 Warmup Do it");
  });

  it("strips emphasis (bold, italic, both syntaxes)", () => {
    expect(stripMarkdown("**bold** and *italic*")).toBe("bold and italic");
    expect(stripMarkdown("__bold__ and _italic_")).toBe("bold and italic");
    expect(stripMarkdown("***both***")).toBe("both");
  });

  it("strips inline code backticks", () => {
    expect(stripMarkdown("Use `npm install` first")).toBe("Use npm install first");
  });

  it("removes fenced code blocks entirely", () => {
    expect(stripMarkdown("Before\n```js\nconst x = 1;\n```\nAfter")).toBe("Before After");
  });

  it("flattens links to their text and images to their alt", () => {
    expect(stripMarkdown("See [the docs](https://example.com).")).toBe("See the docs.");
    expect(stripMarkdown("![logo](https://example.com/a.png) hi")).toBe("logo hi");
  });

  it("strips list markers (ordered and unordered)", () => {
    expect(stripMarkdown("- one\n- two\n- three")).toBe("one two three");
    expect(stripMarkdown("* one\n+ two")).toBe("one two");
    expect(stripMarkdown("1. first\n2. second")).toBe("first second");
  });

  it("strips blockquote markers", () => {
    expect(stripMarkdown("> a quote\n> across lines")).toBe("a quote across lines");
  });

  it("strips raw HTML tags", () => {
    expect(stripMarkdown("Hello <b>world</b><br/>")).toBe("Hello world");
  });

  it("collapses repeated whitespace and trims", () => {
    expect(stripMarkdown("  too    many\n\nspaces  ")).toBe("too many spaces");
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    expect(stripMarkdown("")).toBe("");
    expect(stripMarkdown("   \n\t  ")).toBe("");
  });

  it("handles a realistic mixed-markdown description", () => {
    const input = [
      "# Push Day",
      "",
      "Focus on **chest** and _triceps_.",
      "",
      "- Bench press",
      "- Incline dumbbell press",
      "",
      "See [program notes](https://example.com).",
    ].join("\n");
    expect(stripMarkdown(input)).toBe(
      "Push Day Focus on chest and triceps. Bench press Incline dumbbell press See program notes.",
    );
  });
});
