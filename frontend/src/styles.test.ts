import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const LIGHT_PALETTE = /:root \{([^}]+)\}/;
const DARK_PALETTE = /\.dark \{([^}]+)\}/;
const COLOR_TOKEN = /--([\w-]+):\s*(#[\da-f]{6});/gi;
type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(color: RGB) {
  const [r, g, b] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  assert(r !== undefined && g !== undefined && b !== undefined);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrast(foreground: RGB, background: RGB) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Composite translucent hover fills in sRGB before calculating WCAG luminance.
function overlay(foreground: RGB, background: RGB, opacity: number): RGB {
  return foreground.map(
    (channel, index) => channel * opacity + (background[index] ?? 0) * (1 - opacity),
  ) as RGB;
}

for (const [theme, pattern] of [
  ["light", LIGHT_PALETTE],
  ["dark", DARK_PALETTE],
] as const) {
  describe(`${theme} semantic text contrast`, () => {
    const palette = styles.match(pattern)?.[1];
    assert(palette, `Missing ${theme} palette`);
    const tokens = new Map([...palette.matchAll(COLOR_TOKEN)].map((match) => [match[1], match[2]]));
    function color(token: string) {
      const hex = tokens.get(token);
      assert(hex, `Missing ${theme} --${token}`);
      return rgb(hex);
    }

    test("Logged pills and success badges meet AA text contrast", () => {
      expect(contrast(color("positive"), color("positive-soft"))).toBeGreaterThanOrEqual(4.5);
    });

    test("accent-soft text meets AA on its accent-soft fill", () => {
      expect(
        contrast(color("accent-soft-foreground"), color("accent-soft")),
      ).toBeGreaterThanOrEqual(4.5);
    });

    test("selected chip and day text meets AA on the accent fill", () => {
      expect(contrast(color("primary-foreground"), color("primary"))).toBeGreaterThanOrEqual(4.5);
    });

    for (const surface of ["background", "card"]) {
      test(`destructive text meets AA on ${surface}`, () => {
        expect(contrast(color("destructive"), color(surface))).toBeGreaterThanOrEqual(4.5);
      });

      test(`destructive text meets AA on its 10% hover tint over ${surface}`, () => {
        const text = color("destructive");
        expect(contrast(text, overlay(text, color(surface), 0.1))).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
