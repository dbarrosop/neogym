// Run in a subprocess so browser globals cannot leak into other tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window as TestWindow } from "happy-dom";
import { act } from "react";

const dom = new TestWindow({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  ResizeObserver: window.ResizeObserver,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});

const { createRoot } = await import("react-dom/client");
const { ResponsiveContainer } = await import("recharts");
const { BodyMetricsChart } = await import("@/components/body-metrics-chart");

// Resolve rendered token references against both checked-in palettes.
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
type RGB = [number, number, number];
const HEX_COLOR = /^#[\da-f]{6}$/i;
const LIGHT_PALETTE = /:root \{([^}]+)\}/;
const DARK_PALETTE = /\.dark \{([^}]+)\}/;
const COLOR_TOKEN = /^var\(--color-([\w-]+)\)$/;
const PALETTE_TOKEN = /--([\w-]+):\s*(#[\da-f]+);/g;
function rgb(hex: string): RGB {
  assert.match(hex, HEX_COLOR);
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as RGB;
}
function luminance(color: RGB) {
  const [r, g, b] = color.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  assert(r !== undefined && g !== undefined && b !== undefined);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a: RGB, b: RGB) {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}
function palette(theme: "light" | "dark") {
  const block = styles.match(theme === "light" ? LIGHT_PALETTE : DARK_PALETTE)?.[1];
  assert(block);
  const tokens = new Map([...block.matchAll(PALETTE_TOKEN)].map((m) => [m[1], m[2]]));
  return (reference: string | null | undefined) => {
    const token = reference?.match(COLOR_TOKEN)?.[1] ?? reference;
    assert(token, "Missing colour reference");
    const hex = tokens.get(token);
    assert(hex, `Missing ${theme} ${token}`);
    return rgb(hex);
  };
}

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function waitFor(condition: () => boolean, what: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Let real Recharts resolve dimensions and state.
    await settle();
    if (condition()) {
      return;
    }
  }
  throw new Error(`Timed out waiting for ${what}: ${container.textContent}`);
}
function all(selector: string) {
  return [...container.querySelectorAll(selector)];
}

async function checkBodyChart() {
  const points = [
    { date: Date.UTC(2026, 9, 1), weightKg: 82.4, bodyFatPct: null },
    { date: Date.UTC(2026, 9, 8), weightKg: 81.7, bodyFatPct: 18.2 },
    { date: Date.UTC(2026, 9, 15), weightKg: 80.9, bodyFatPct: 17.5 },
  ];
  await settle(() =>
    root.render(
      <ResponsiveContainer width={640} height={224}>
        <BodyMetricsChart points={points} />
      </ResponsiveContainer>,
    ),
  );
  await waitFor(() => all(".recharts-line-curve").length === 2, "body chart");
  assert(!container.innerHTML.includes("chart-2"), "Body chart must not draw orange lines or text");

  const lines = all(".recharts-line-curve").map((line) => line.getAttribute("stroke"));
  assert.deepEqual(lines, ["var(--color-chart-1)", "var(--color-chart-3)"]);
  const ticks = [
    ...new Set(all(".recharts-cartesian-axis-tick-value").map((tick) => tick.getAttribute("fill"))),
  ];
  assert(ticks.includes("var(--color-chart-3)"), "Body fat axis labels follow their series");
  const legend = all(".recharts-legend-item-text").map((item) => (item as HTMLElement).style.color);
  assert.equal(legend.length, 2);

  for (const theme of ["light", "dark"] as const) {
    const color = palette(theme);
    const card = color("card");
    for (const line of lines) {
      assert(contrast(color(line), card) >= 3, `${theme}: ${line} line contrast`);
    }
    for (const fill of ticks) {
      assert(contrast(color(fill), card) >= 4.5, `${theme}: ${fill} axis label contrast`);
    }
    for (const text of legend) {
      assert(contrast(color(text), card) >= 4.5, `${theme}: ${text} legend contrast`);
    }
    assert(contrast(color("popover-foreground"), color("popover")) >= 4.5);
  }

  const chart = container.querySelector('[role="application"]');
  assert(chart, "Keep Recharts keyboard access");
  await settle(() => chart.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
  await settle(() =>
    chart.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
  );
  const tooltip = () => container.querySelector(".recharts-tooltip-wrapper")?.textContent ?? "";
  await waitFor(() => tooltip().includes("Body fat: "), "body tooltip");
  const rows = all(".recharts-tooltip-wrapper p.font-medium");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert(row.classList.contains("text-popover-foreground"));
    assert.equal(row.getAttribute("style"), null, "Tooltip values use neutral text");
  }
}

try {
  await checkBodyChart();
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info("Orange stays fill-only; Body chart lines and labels pass contrast.");
