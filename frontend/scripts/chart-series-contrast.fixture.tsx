// Run in a subprocess so browser globals cannot leak into other tests.
// Renders the Body, Energy and Calories charts and checks every colour they
// draw against both checked-in palettes: series use only Chart 1 (blue) and
// Chart 2 (orange) by metric, never a grey series, at 3:1 against the card;
// axis labels use tertiary text and legends secondary text at 4.5:1.
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
const { BodyMetricTrendColumn } = await import("@/components/body-metrics-chart");
const { EnergyTrendSummary } = await import("@/components/daily-energy-chart");
const { CalorieCharts } = await import("@/components/calories-card");
const { buildBodyTrend } = await import("@/lib/body-trend");
const { buildEnergyTrend } = await import("@/lib/energy-trend");
const { buildCalorieTrend } = await import("@/lib/calorie-trend");

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

const today = "2026-11-12";
const domain = { start: "2026-11-01", end: today };
const days = Array.from(
  { length: 12 },
  (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`,
);
const body = buildBodyTrend(
  days.map((date, index) => ({
    measuredOn: date,
    weightKg: 72 - index * 0.1,
    bodyFatPct: index % 3 === 0 ? null : 13 - index * 0.05,
  })),
  { today, ...domain },
);
const energy = buildEnergyTrend(
  days.map((date, index) => ({
    energyOn: date,
    activeKcal: date === today ? 300 : 600 + index * 40,
    restingKcal: date === today ? 700 : 1_800 + index * 5,
  })),
  { today, ...domain },
);
const calories = buildCalorieTrend(
  {
    nutritionDays: days.map((date, index) => ({
      logDate: date,
      nutritionLogEntries: [{ grams: 100, snapshotKcalPer100g: 2_100 + index * 20 }],
    })),
    dailyEnergyEntries: days.map((date, index) => ({
      energyOn: date,
      activeKcal: 600 + index * 40,
      restingKcal: 1_800,
    })),
  },
  { today, ...domain },
);

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
function all(selector: string, within: ParentNode = container) {
  return [...within.querySelectorAll(selector)];
}

const SERIES_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)"];
/** The chart's root (chart + legend) for the SVG whose summary starts with `title`. */
function chartRoot(title: string) {
  const svg = all('svg[role="application"]').find((item) =>
    item.getAttribute("aria-label")?.startsWith(title),
  );
  assert(svg, `Missing chart: ${title}`);
  const rootElement = svg.closest(".flex.min-w-0.flex-col");
  assert(rootElement, `Missing chart root: ${title}`);
  return rootElement;
}
/** Every colour a chart's series marks use: lines, reading dots, open dots, legend keys. */
function seriesColors(within: ParentNode) {
  return [
    ...all(".recharts-line-curve", within).map((line) => line.getAttribute("stroke")),
    ...all("circle.trend-chart-dot", within).map((dot) => dot.getAttribute("fill")),
    ...all(".trend-chart-open-dot", within).map((dot) => dot.getAttribute("stroke")),
    ...all("[data-swatch] span, [data-swatch='line']", within).map(
      (swatch) => (swatch as HTMLElement).style.backgroundColor,
    ),
  ].filter((color): color is string => !!color);
}

try {
  await settle(() =>
    root.render(
      <ResponsiveContainer width={640} height={1200}>
        <div>
          <BodyMetricTrendColumn kind="weight" metric={body.weight} domain={domain} />
          <BodyMetricTrendColumn kind="bodyFat" metric={body.bodyFat} domain={domain} />
          <EnergyTrendSummary trend={energy} domain={domain} periodControl={null} />
          <CalorieCharts trend={calories} domain={domain} />
        </div>
      </ResponsiveContainer>,
    ),
  );
  for (let attempt = 0; attempt < 50 && all('svg[role="application"]').length < 5; ) {
    attempt += 1;
    // biome-ignore lint/performance/noAwaitInLoops: Let Recharts resolve dimensions and state.
    await settle();
  }
  assert.equal(all('svg[role="application"]').length, 5, "Body ×2, energy, consumed and net");

  // Colour follows the metric, never its position.
  const byMetric: [string, string][] = [
    ["Weight, daily readings", "var(--color-chart-1)"],
    ["Body fat, daily readings", "var(--color-chart-2)"],
    ["Calories consumed", "var(--color-chart-1)"],
    ["Net calories", "var(--color-chart-2)"],
  ];
  for (const [title, color] of byMetric) {
    const colors = new Set(seriesColors(chartRoot(title)));
    assert.deepEqual([...colors], [color], `${title} is drawn in ${color} only`);
  }
  const energyLines = all(".recharts-line-curve", chartRoot("Active and resting energy")).map(
    (line) => line.getAttribute("stroke"),
  );
  assert.deepEqual(energyLines.slice(0, 2), ["var(--color-chart-2)", "var(--color-chart-1)"]);

  // No grey series anywhere; every mark is one of the chart pair.
  const marks = seriesColors(container);
  assert(marks.length > 0);
  for (const color of marks) {
    assert(SERIES_COLORS.includes(color), `Unexpected series colour ${color}`);
  }
  const openDots = all(".trend-chart-open-dot");
  assert(openDots.length >= 3, "Energy and consumed draw today's open dots");
  assert(openDots.every((dot) => dot.getAttribute("fill") === "var(--color-card)"));

  const axisLabels = [
    ...new Set(
      all(".recharts-yAxis-tick-labels text, .recharts-xAxis-tick-labels text").map((tick) =>
        tick.getAttribute("fill"),
      ),
    ),
  ];
  assert.deepEqual(axisLabels, ["var(--color-tertiary-foreground)"], "Axis labels are tertiary");
  const grid = [
    ...new Set(all(".recharts-cartesian-grid line").map((line) => line.getAttribute("stroke"))),
  ];
  assert.deepEqual(grid, ["var(--color-chart-grid)"], "Grid lines use the separator token");
  const legends = all("ul");
  assert.equal(legends.length, 5);
  assert(legends.every((legend) => legend.classList.contains("text-muted-foreground")));

  for (const theme of ["light", "dark"] as const) {
    const color = palette(theme);
    const card = color("card");
    for (const series of SERIES_COLORS) {
      assert(contrast(color(series), card) >= 3, `${theme}: ${series} against the card`);
    }
    for (const label of axisLabels) {
      assert(contrast(color(label), card) >= 4.5, `${theme}: ${label} axis labels`);
    }
    assert(contrast(color("muted-foreground"), card) >= 4.5, `${theme}: legend text`);
    assert.deepEqual(color("chart-grid"), color("border"), `${theme}: grid is the separator`);
    for (const text of ["popover-foreground", "muted-foreground"]) {
      assert(contrast(color(text), color("popover")) >= 4.5, `${theme}: tooltip ${text}`);
    }
  }

  // Tooltip values stay neutral text, never series-coloured.
  const chart = all('svg[role="application"]')[0];
  assert(chart);
  await settle(() => chart.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
  const rows = all(".recharts-tooltip-wrapper p.font-medium");
  assert(rows.length > 0, "Tooltip rows render");
  for (const row of rows) {
    assert(row.classList.contains("text-popover-foreground"));
    assert.equal(row.getAttribute("style"), null, "Tooltip values use neutral text");
  }
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info(
  "Body, Energy and Calories charts colour series by metric in Chart 1/2 with legible labels; no grey series.",
);
